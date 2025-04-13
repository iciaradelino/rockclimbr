from flask import Blueprint, jsonify, request
from datetime import datetime
from bson import ObjectId
import traceback
import json
from pymongo.collection import ReturnDocument
from ..utils.db import db
from ..middleware.auth_middleware import create_access_token, get_current_user, login_required, hash_password, verify_password

# Create Blueprint for auth routes
auth = Blueprint('auth', __name__)

# Helper function to convert MongoDB ObjectIds to strings
def json_serialize_mongodb(obj):
    """Convert MongoDB document to JSON-serializable format, handling ObjectIds."""
    if isinstance(obj, dict):
        return {k: json_serialize_mongodb(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [json_serialize_mongodb(item) for item in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    else:
        return obj

@auth.route('/register', methods=['POST'])
def register():
    """Register a new user."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        # Validate required fields
        required_fields = ["username", "email", "password"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Check if user already exists
        if db.users.find_one({"email": data["email"]}):
            return jsonify({"error": "Email already registered"}), 400
        
        if db.users.find_one({"username": data["username"]}):
            return jsonify({"error": "Username already taken"}), 400
        
        # Create user object
        user_data = {
            "username": data["username"],
            "email": data["email"],
            "password": hash_password(data["password"]),
            "bio": data.get("bio", ""),
            "location": data.get("location", ""),
            "avatar_url": data.get("avatar_url", ""),
            "created_at": datetime.utcnow(),
            "stats": {
                "posts": 0,
                "followers": 0,
                "following": 0
            }
        }
        
        # Insert user into database
        result = db.users.insert_one(user_data)
        user_id = str(result.inserted_id)
        
        # Create access token
        access_token = create_access_token({"sub": user_id})
        
        return jsonify({
            "message": "User registered successfully",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "username": user_data["username"],
                "email": user_data["email"],
                "bio": user_data["bio"],
                "location": user_data["location"],
                "avatar_url": user_data["avatar_url"],
                "created_at": user_data["created_at"],
                "stats": user_data["stats"]
            }
        })
    except Exception as e:
        print("Error registering user:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 400

@auth.route('/login', methods=['POST'])
def login():
    """Login a user."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        data = request.json
        
        # Find user by email
        user = db.users.find_one({"email": data["email"]})
        if not user:
            return jsonify({"error": "Invalid email or password"}), 401
        
        # Verify password
        if not verify_password(data["password"], user["password"]):
            return jsonify({"error": "Invalid email or password"}), 401
        
        # Create access token
        user_id = str(user["_id"])
        access_token = create_access_token({"sub": user_id})
        
        # Return user data without password
        user_data = {
            "id": user_id,
            "username": user["username"],
            "email": user["email"],
            "bio": user.get("bio", ""),
            "location": user.get("location", ""),
            "avatar_url": user.get("avatar_url", ""),
            "created_at": user.get("created_at", datetime.utcnow()),
            "stats": user.get("stats", {"posts": 0, "followers": 0, "following": 0})
        }
        
        return jsonify({
            "access_token": access_token,
            "token_type": "bearer",
            "user": user_data
        })
    except Exception as e:
        print("Error logging in:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 400

@auth.route('/me', methods=['GET'])
@login_required
def get_current_user_profile():
    """Get the current user's profile with recalculated stats."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401
        
        # Process MongoDB document to make it JSON serializable
        json_safe_user = json_serialize_mongodb(current_user)
        
        # Ensure _id is converted to string
        user_id_str = json_safe_user["_id"]
        
        # --- Recalculate Stats --- 
        followers_count = db.follows.count_documents({"following_id": user_id_str})
        following_count = db.follows.count_documents({"follower_id": user_id_str})
        posts_count = db.posts.count_documents({"user_id": user_id_str})
        
        # Update the user object with calculated stats
        json_safe_user["stats"] = {
            "posts": posts_count,
            "followers": followers_count,
            "following": following_count
        }
        # --- End Recalculate Stats ---

        # --- Add climbing gyms data ---
        if "climbing_gym_ids" in json_safe_user and json_safe_user["climbing_gym_ids"]:
            try:
                # Convert string IDs back to ObjectIds for database query
                gym_ids = [ObjectId(gym_id) for gym_id in json_safe_user["climbing_gym_ids"]]
                gyms = list(db.gyms.find({"_id": {"$in": gym_ids}}))
                
                # Format gym data
                climbing_gyms = []
                for gym in gyms:
                    climbing_gyms.append({
                        "id": str(gym["_id"]),
                        "name": gym.get("name", ""),
                        "location": gym.get("location", "")
                    })
                
                json_safe_user["climbing_gyms"] = climbing_gyms
            except Exception as gym_error:
                print(f"Error fetching gym data: {gym_error}")
                json_safe_user["climbing_gyms"] = []
        else:
            json_safe_user["climbing_gyms"] = []
        # --- End Add climbing gyms data ---

        # Remove password from response
        json_safe_user.pop("password", None)
        
        return jsonify(json_safe_user)
    except Exception as e:
        print("Error getting current user profile:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": "Failed to retrieve user profile: " + str(e)}), 500

@auth.route('/me/profile', methods=['PUT'])
@login_required
def update_user_profile():
    """Update the current user's profile."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401
        
        try:
            data = request.json
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            # Fields that can be updated
            allowed_fields = ["username", "bio", "location", "avatar_url"]
            update_data = {k: v for k, v in data.items() if k in allowed_fields}

            # Handle climbing gyms update specifically
            if "climbing_gym_ids" in data:
                # Convert potential string IDs to ObjectId
                try:
                    gym_ids = data["climbing_gym_ids"]
                    if not isinstance(gym_ids, list):
                        return jsonify({"error": "climbing_gym_ids must be a list"}), 400
                    
                    gym_object_ids = []
                    for gym_id in gym_ids:
                        if gym_id:  # Skip empty values
                            try:
                                gym_object_ids.append(ObjectId(gym_id))
                            except Exception as gym_id_error:
                                print(f"Error converting gym ID {gym_id}: {gym_id_error}")
                                # Continue with valid IDs
                    
                    update_data["climbing_gym_ids"] = gym_object_ids
                except Exception as e:
                    print(f"Error processing gym IDs: {e}")
                    return jsonify({"error": "Invalid climbing gym ID format"}), 400
            
            # If username is being updated, check if it's already taken
            if "username" in update_data:
                existing_user = db.users.find_one({
                    "username": update_data["username"],
                    "_id": {"$ne": current_user["_id"]}
                })
                if existing_user:
                    return jsonify({"error": "Username already taken"}), 400
            
            # Update user in database
            result = db.users.update_one(
                {"_id": current_user["_id"]},
                {"$set": update_data}
            )
            
            if result.matched_count == 0:
                return jsonify({"error": "User not found"}), 404
            
            # --- Re-fetch the user data with populated gyms ---
            try:
                updated_user = db.users.find_one({"_id": current_user["_id"]})
                if not updated_user:
                    return jsonify({"error": "Failed to fetch updated user"}), 500
                
                # Process gyms for the response
                user_with_gyms = json_serialize_mongodb(updated_user)
                
                # If user has climbing_gym_ids, fetch the gym details
                if "climbing_gym_ids" in user_with_gyms and user_with_gyms["climbing_gym_ids"]:
                    # The IDs are already converted to strings by json_serialize_mongodb
                    gym_ids = [ObjectId(gym_id) for gym_id in user_with_gyms["climbing_gym_ids"]]
                    gyms = list(db.gyms.find({"_id": {"$in": gym_ids}}))
                    
                    # Convert gyms to the expected format
                    climbing_gyms = []
                    for gym in gyms:
                        climbing_gyms.append({
                            "id": str(gym["_id"]),
                            "name": gym.get("name", ""),
                            "location": gym.get("location", "")
                        })
                    
                    user_with_gyms["climbing_gyms"] = climbing_gyms
                else:
                    user_with_gyms["climbing_gyms"] = []
                
                # Remove password and climbing_gym_ids from response
                user_with_gyms.pop("password", None)
                user_with_gyms.pop("climbing_gym_ids", None)
                
                return jsonify(user_with_gyms)
            except Exception as fetch_error:
                print(f"Error fetching updated user: {fetch_error}")
                print("Traceback:", traceback.format_exc())
                # If we can't fetch the updated user but the update worked, return success with basic info
                return jsonify({
                    "message": "Profile updated successfully",
                    "id": str(current_user["_id"]),
                    "updated_fields": list(update_data.keys())
                })
        except Exception as data_error:
            print(f"Error processing update data: {data_error}")
            print("Traceback:", traceback.format_exc())
            return jsonify({"error": f"Invalid request data: {str(data_error)}"}), 400
    except Exception as e:
        print("Error updating profile:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@auth.route('/me/password', methods=['PUT'])
@login_required
def update_password():
    """Update the current user's password."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401
        
        try:
            data = request.json
            
            # Verify current password
            if not verify_password(data["current_password"], current_user["password"]):
                return jsonify({"error": "Current password is incorrect"}), 401
            
            # Update password in database
            db.users.update_one(
                {"_id": current_user["_id"]},
                {"$set": {"password": hash_password(data["new_password"])}}
            )
            
            return jsonify({"message": "Password updated successfully"})
        except Exception as data_error:
            print(f"Error processing password update: {data_error}")
            print("Traceback:", traceback.format_exc())
            return jsonify({"error": f"Invalid request data: {str(data_error)}"}), 400
    except Exception as e:
        print("Error updating password:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": f"Server error: {str(e)}"}), 500
