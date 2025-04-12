from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient, ReturnDocument
from dotenv import load_dotenv
from datetime import datetime
from models import Workout, Climb, Post, UserCreate, UserLogin, User, Token, FollowRelation, UserPublic, ProfileUpdate, PasswordUpdate, Gym, GymCreate, GymInDB
from auth import hash_password, verify_password, create_access_token, get_current_user
from bson import ObjectId
import os
import traceback
import re

# Load environment variables
load_dotenv()

app = Flask(__name__)
# Update CORS configuration with explicit origins and support for credentials
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:8081", "http://localhost:19006", "exp://localhost:19000"], "supports_credentials": True}})

# MongoDB connection with error handling
try:
    client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
    # Test the connection
    client.server_info()
    db = client.rockclimbing_db
    print("Successfully connected to MongoDB!")
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")
    db = None

# Add CORS headers to all responses
@app.after_request
def after_request(response):
    # Removed manual setting of CORS headers. 
    # Flask-CORS handles this based on the app initialization.
    # origin = request.headers.get('Origin')
    # # If the request has an origin header, use that, otherwise fall back to localhost:8081
    # if origin:
    #     response.headers.add('Access-Control-Allow-Origin', origin)
    # else:
    #     response.headers.add('Access-Control-Allow-Origin', 'http://localhost:8081')
        
    # response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    # response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    # response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Test route
@app.route('/api/test', methods=['GET'])
def test_connection():
    if db is None:
        return jsonify({"message": "Backend is working but MongoDB is not connected!"}), 500
    return jsonify({"message": "Backend is working and MongoDB is connected!"})

# User registration
@app.route('/api/auth/register', methods=['POST'])
def register():
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

# User login
@app.route('/api/auth/login', methods=['POST'])
def login():
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

# Helper function to fetch user profile with populated gyms
def get_user_profile_with_gyms(user_id_str: str):
    if not db:
        return None
    
    pipeline = [
        {
            "$match": {"_id": ObjectId(user_id_str)}
        },
        {
            "$lookup": {
                "from": "gyms",
                "localField": "climbing_gym_ids",
                "foreignField": "_id",
                "as": "populated_gyms"
            }
        },
        {
            "$project": {
                "password": 0, # Exclude password
                "climbing_gym_ids": 0, # Exclude the array of IDs
                # Project only necessary gym fields (_id, name, location)
                "populated_gyms._id": 1,
                "populated_gyms.name": 1,
                "populated_gyms.location": 1
            }
        }
    ]
    
    result = list(db.users.aggregate(pipeline))
    if not result:
        return None
        
    user_doc = result[0]
    # Rename populated_gyms to climbing_gyms for consistency with Pydantic model
    user_doc["climbing_gyms"] = user_doc.pop("populated_gyms", [])
    # Convert gym _ids back to strings for the Gym model
    for gym in user_doc["climbing_gyms"]:
        gym["_id"] = str(gym["_id"])
        
    return user_doc

# Get current user profile
@app.route('/api/auth/me', methods=['GET'])
def get_current_user_profile():
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Missing or invalid token"}), 401
    
    token = auth_header.split(" ")[1]
    # Get user ID from token first
    payload = decode_token(token)
    if payload is None or payload.get("sub") is None:
        return jsonify({"error": "Invalid or expired token"}), 401
    user_id = payload.get("sub")

    # Fetch user profile using the helper function
    user = get_user_profile_with_gyms(user_id)
    if not user:
        # This case should ideally not happen if token is valid, but handle defensively
        return jsonify({"error": "User not found for valid token"}), 404 
    
    # Stats calculation remains the same
    post_count = db.posts.count_documents({"user_id": user_id})
    follower_count = db.follows.count_documents({"following_id": user_id})
    following_count = db.follows.count_documents({"follower_id": user_id})
    stats = {
        "posts": post_count,
        "followers": follower_count,
        "following": following_count
    }
    
    # Prepare final user data using the fetched user doc (which includes gyms)
    user_data = {
        "id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
        "bio": user.get("bio", ""),
        "location": user.get("location", ""),
        "avatar_url": user.get("avatar_url", ""),
        "climbing_gyms": user.get("climbing_gyms", []), # Now populated by the helper
        "created_at": user.get("created_at", datetime.utcnow()),
        "stats": stats
    }
    
    # Validate final structure with Pydantic User model before returning
    try:
        validated_user = User(**user_data)
        return jsonify(validated_user.dict())
    except Exception as e:
        print(f"Error validating user data before response: {e}")
        return jsonify({"error": "Internal server error during data preparation"}), 500

# Update user profile (non-password fields)
@app.route('/api/auth/me/profile', methods=['PUT'])
def update_user_profile():
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Missing or invalid token"}), 401

    token = auth_header.split(" ")[1]
    user = get_current_user(token, db)

    if not user:
        return jsonify({"error": "Invalid or expired token"}), 401

    try:
        # Log the raw JSON received before validation
        print(f"Received profile update request data: {request.json}") 
        # Use ProfileUpdate model for validation
        profile_data = ProfileUpdate(**request.json)
        user_id = user["_id"]

        update_fields = {}
        if profile_data.username is not None:
            # Check if username is already taken by another user
            existing_user = db.users.find_one({"username": profile_data.username, "_id": {"$ne": ObjectId(user_id)}})
            if existing_user:
                return jsonify({"error": "Username already taken"}), 400
            update_fields["username"] = profile_data.username

        if profile_data.bio is not None:
            update_fields["bio"] = profile_data.bio
        if profile_data.location is not None:
            update_fields["location"] = profile_data.location
        if profile_data.avatar_url is not None:
            update_fields["avatar_url"] = profile_data.avatar_url
        
        # Handle climbing_gym_ids
        if profile_data.climbing_gym_ids is not None:
            # Validate ObjectIds and potentially check existence
            valid_gym_ids = []
            invalid_ids = []
            for gym_id_str in profile_data.climbing_gym_ids:
                if ObjectId.is_valid(gym_id_str):
                    # Optional: Check if gym actually exists
                    # if db.gyms.count_documents({"_id": ObjectId(gym_id_str)}) > 0:
                    #     valid_gym_ids.append(ObjectId(gym_id_str))
                    # else:
                    #     invalid_ids.append(gym_id_str)
                    valid_gym_ids.append(ObjectId(gym_id_str)) # Assuming IDs from frontend are valid
                else:
                    invalid_ids.append(gym_id_str)
            
            if invalid_ids:
                return jsonify({"error": f"Invalid gym IDs provided: {', '.join(invalid_ids)}"}), 400
            
            update_fields["climbing_gym_ids"] = valid_gym_ids

        if not update_fields:
            return jsonify({"message": "No profile fields provided for update"}), 200 # Or 400 if preferred

        # Perform the update
        result = db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_fields}
        )

        if result.modified_count == 0 and result.matched_count > 0:
             # Data provided matched existing data, no actual change made
            return jsonify({"message": "Profile data is the same as current data."}), 200
        elif result.modified_count == 0:
             return jsonify({"error": "User not found or update failed"}), 404


        # Fetch updated user data
        updated_user = db.users.find_one({"_id": ObjectId(user_id)})
        # Remove password before sending back
        del updated_user["password"]
        # Convert ObjectId to string for JSON serialization
        updated_user["_id"] = str(updated_user["_id"])
        if 'created_at' in updated_user and isinstance(updated_user['created_at'], datetime):
             updated_user['created_at'] = updated_user['created_at'].isoformat()

        # Recalculate stats to return the most current counts
        post_count = db.posts.count_documents({"user_id": str(user_id)})
        follower_count = db.follows.count_documents({"following_id": str(user_id)})
        following_count = db.follows.count_documents({"follower_id": str(user_id)})
        stats = {
            "posts": post_count,
            "followers": follower_count,
            "following": following_count
        }
        updated_user["stats"] = stats


        return jsonify({"message": "Profile updated successfully", "user": updated_user})

    except Exception as e:
        print("Error updating profile:", str(e))
        print("Traceback:", traceback.format_exc())
        # Consider specific Pydantic validation error handling
        return jsonify({"error": f"An error occurred: {str(e)}"}), 400


# Update user password
@app.route('/api/auth/me/password', methods=['PUT'])
def update_password():
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Missing or invalid token"}), 401

    token = auth_header.split(" ")[1]
    user = get_current_user(token, db)

    if not user:
        return jsonify({"error": "Invalid or expired token"}), 401

    try:
        # Use PasswordUpdate model for validation
        password_data = PasswordUpdate(**request.json)
        user_id = user["_id"]

        # Verify current password
        if not verify_password(password_data.current_password, user["password"]):
            return jsonify({"error": "Incorrect current password"}), 400

        # Hash the new password
        new_hashed_password = hash_password(password_data.new_password)

        # Update the password in the database
        result = db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"password": new_hashed_password}}
        )

        if result.modified_count == 0:
            return jsonify({"error": "Password update failed"}), 500

        return jsonify({"message": "Password updated successfully"})

    except Exception as e:
        print("Error updating password:", str(e))
        print("Traceback:", traceback.format_exc())
        # Consider specific Pydantic validation error handling
        return jsonify({"error": f"An error occurred: {str(e)}"}), 400

# Get all workouts
@app.route('/api/workouts', methods=['GET'])
def get_workouts():
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        # Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid token"}), 401
        
        token = auth_header.split(" ")[1]
        user = get_current_user(token, db)
        
        if not user:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        # Get workouts for the current user
        user_id = user["_id"]
        workouts = list(db.workouts.find({"user_id": user_id}))
        # Convert ObjectId to string for JSON serialization
        for workout in workouts:
            workout['_id'] = str(workout['_id'])
        return jsonify(workouts)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Add a new workout
@app.route('/api/workouts', methods=['POST'])
def add_workout():
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        data = request.json
        print("Received workout data:", data)  # Debug log
        
        # Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid token"}), 401
        
        token = auth_header.split(" ")[1]
        user = get_current_user(token, db)
        
        if not user:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        # Get user ID from token
        user_id = user["_id"]
        
        # Handle the date string by removing the 'Z' timezone indicator if present
        date_str = data['date']
        if date_str.endswith('Z'):
            date_str = date_str[:-1] + '+00:00'
        
        # Validate the data using our Pydantic model
        workout = Workout(
            user_id=user_id,
            date=datetime.fromisoformat(date_str),
            duration=data['duration'],
            location=data['location'],
            climbs=[Climb(**climb) for climb in data['climbs']],
            session_feeling=data.get('session_feeling'),
            achievement=data.get('achievement'),
            images=data.get('images', [])
        )
        
        # Convert to dict and insert into MongoDB
        result = db.workouts.insert_one(workout.dict())
        
        return jsonify({
            "message": "Workout added successfully",
            "id": str(result.inserted_id)
        })
    except Exception as e:
        print("Error processing workout:", str(e))  # Debug log
        print("Traceback:", traceback.format_exc())  # Debug log
        return jsonify({"error": str(e)}), 400

# Get a specific workout by ID
@app.route('/api/workouts/<workout_id>', methods=['GET'])
def get_workout(workout_id):
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        # Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid token"}), 401
        
        token = auth_header.split(" ")[1]
        user = get_current_user(token, db)
        
        if not user:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        # Get user ID from token
        user_id = user["_id"]
        
        from bson import ObjectId
        workout = db.workouts.find_one({
            "_id": ObjectId(workout_id),
            "user_id": user_id
        })
        
        if workout:
            workout['_id'] = str(workout['_id'])
            return jsonify(workout)
        return jsonify({"error": "Workout not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Get all posts
@app.route('/api/posts', methods=['GET'])
def get_posts():
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        # Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid token"}), 401
        
        token = auth_header.split(" ")[1]
        user = get_current_user(token, db)
        
        if not user:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        # Get posts for the current user
        user_id = user["_id"]
        posts = list(db.posts.find({"user_id": user_id}))
        # Convert ObjectId to string for JSON serialization
        for post in posts:
            post['_id'] = str(post['_id'])
        return jsonify(posts)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Add a new post
@app.route('/api/posts', methods=['POST'])
def add_post():
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        data = request.json
        print("Received post data:", data)  # Debug log
        
        # Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid token"}), 401
        
        token = auth_header.split(" ")[1]
        user = get_current_user(token, db)
        
        if not user:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        # Get user ID from token
        user_id = user["_id"]
        
        # Create a new post
        post = Post(
            user_id=user_id,
            image_url=data['image_url'],
            caption=data['caption'],
            location=data['location'],
            difficulty=data['difficulty'],
            timestamp=datetime.fromisoformat(data['timestamp'].replace('Z', '+00:00')),
            likes=0,
            comments=0
        )
        
        # Convert to dict and insert into MongoDB
        result = db.posts.insert_one(post.dict())
        
        # Update user stats
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$inc": {"stats.posts": 1}}
        )
        
        return jsonify({
            "message": "Post added successfully",
            "id": str(result.inserted_id)
        })
    except Exception as e:
        print("Error processing post:", str(e))  # Debug log
        print("Traceback:", traceback.format_exc())  # Debug log
        return jsonify({"error": str(e)}), 400

# Get all posts (feed) including following users' posts
@app.route('/api/feed', methods=['GET'])
def get_feed():
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        # Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid token"}), 401
        
        token = auth_header.split(" ")[1]
        user = get_current_user(token, db)
        
        if not user:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        # Get user ID
        user_id = user["_id"]
        
        # Find users the current user is following
        following = list(db.follows.find({"follower_id": str(user_id)}))
        # Get the string IDs directly from the follows collection
        following_ids_str = [follow["following_id"] for follow in following]
        
        # Include user's own ID as a string
        following_ids_str.append(str(user_id))
        
        # Get posts from users the current user is following and their own posts
        pipeline = [
            # Match posts using string user_ids
            {"$match": {"user_id": {"$in": following_ids_str}}}, 
            # Sort by timestamp descending (newest first)
            {"$sort": {"timestamp": -1}},
            # Limit to 50 posts
            {"$limit": 50},
            # Join with users collection using a pipeline for type matching
            {"$lookup": {
                "from": "users",
                "let": { "userIdString": "$user_id" }, # Define variable for the string user_id from post
                "pipeline": [
                    {
                        "$match": {
                            "$expr": { # Use $expr to compare fields
                                # Convert users._id to string and compare with userIdString
                                "$eq": [ { "$toString": "$_id" }, "$$userIdString" ] 
                            }
                        }
                    },
                    {
                        # Optional: Project only needed user fields here if desired
                        "$project": { "username": 1, "avatar_url": 1 } 
                    }
                ],
                "as": "user"
            }},
            # Unwind the user array (there should be only one)
            {"$unwind": "$user"},
            # Project only the fields we need
            {"$project": {
                "_id": 1,
                "image_url": 1,
                "caption": 1,
                "location": 1,
                "difficulty": 1,
                "timestamp": 1,
                "likes": 1,
                "comments": 1,
                "user_id": 1, # Keep user_id (it's already a string in the post doc)
                "username": "$user.username",
                "avatar_url": "$user.avatar_url"
            }}
        ]
        
        posts = list(db.posts.aggregate(pipeline))
        
        # Convert ObjectId _id to string for JSON serialization
        # user_id should already be a string from the database if hypothesis is correct
        for post in posts:
            post['_id'] = str(post['_id'])
            # No need to convert user_id if it's already stored as str
            # post['user_id'] = str(post['user_id'])
        
        return jsonify(posts)
    except Exception as e:
        print("Error getting feed:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# Get users that a user is following
@app.route('/api/users/<user_id>/following', methods=['GET'])
def get_following(user_id):
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        # Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid token"}), 401
        
        token = auth_header.split(" ")[1]
        current_user = get_current_user(token, db)
        
        if not current_user:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        # Get current user ID
        current_user_id = current_user["_id"]
        
        # Check if user_id is valid
        try:
            target_user_id = ObjectId(user_id)
            
            # Get users that target user is following - first get the follow relationships
            follows = list(db.follows.find({"follower_id": str(target_user_id)}).sort("created_at", -1))
            
            # Get the following user details from the users collection
            following = []
            for follow in follows:
                try:
                    # Convert string ID back to ObjectId for lookup
                    following_id = ObjectId(follow["following_id"])
                    followed_user = db.users.find_one({"_id": following_id})
                    
                    if followed_user:
                        # Check if current user is following this user
                        is_following = db.follows.find_one({
                            "follower_id": str(current_user_id),
                            "following_id": str(following_id)
                        })
                        
                        # Create user data with follow status
                        following_data = {
                            "_id": str(followed_user["_id"]),
                            "username": followed_user["username"],
                            "bio": followed_user.get("bio", ""),
                            "location": followed_user.get("location", ""),
                            "avatar_url": followed_user.get("avatar_url", ""),
                            "stats": followed_user.get("stats", {"posts": 0, "followers": 0, "following": 0}),
                            "is_following": bool(is_following),
                            "created_at": follow["created_at"]
                        }
                        
                        following.append(following_data)
                except Exception as e:
                    print(f"Error processing following user {follow['following_id']}: {str(e)}")
                    # Continue with next follower if there's an error with this one
                    continue
            
            return jsonify(following)
            
        except Exception as e:
            return jsonify({"error": f"Invalid user ID: {str(e)}"}), 400
            
    except Exception as e:
        print("Error getting following users:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# Follow a user
@app.route('/api/users/follow/<user_id>', methods=['POST'])
def follow_user(user_id):
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        # Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid token"}), 401
        
        token = auth_header.split(" ")[1]
        current_user = get_current_user(token, db)
        
        if not current_user:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        # Get current user ID
        follower_id = current_user["_id"]
        
        # Check if user_id is valid and exists
        try:
            target_user_id = ObjectId(user_id)
            target_user = db.users.find_one({"_id": target_user_id})
            
            if not target_user:
                return jsonify({"error": "User not found"}), 404
                
            # Can't follow yourself
            if str(follower_id) == user_id:
                return jsonify({"error": "You cannot follow yourself"}), 400
                
            # Check if already following
            existing_follow = db.follows.find_one({
                "follower_id": str(follower_id),
                "following_id": str(target_user_id)
            })
            
            if existing_follow:
                return jsonify({"error": "Already following this user"}), 400
                
            # Create follow relation with string IDs
            follow_relation = {
                "follower_id": str(follower_id),
                "following_id": str(target_user_id),
                "created_at": datetime.utcnow()
            }
            
            # Insert into follows collection
            db.follows.insert_one(follow_relation)
            
            # Calculate updated stats dynamically for the current user
            current_user_following_count = db.follows.count_documents({"follower_id": str(follower_id)})
            current_user_follower_count = db.follows.count_documents({"following_id": str(follower_id)})

            # Return success with dynamically calculated stats for the current user
            return jsonify({
                "message": "Successfully followed user",
                "updated_stats": {
                    "following": current_user_following_count,
                    "followers": current_user_follower_count
                }
            })
            
        except Exception as e:
            return jsonify({"error": f"Invalid user ID: {str(e)}"}), 400
            
    except Exception as e:
        print("Error following user:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# Unfollow a user
@app.route('/api/users/unfollow/<user_id>', methods=['POST'])
def unfollow_user(user_id):
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        # Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid token"}), 401
        
        token = auth_header.split(" ")[1]
        current_user = get_current_user(token, db)
        
        if not current_user:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        # Get current user ID
        follower_id = current_user["_id"]
        
        # Check if user_id is valid and exists
        try:
            target_user_id = ObjectId(user_id)
            target_user = db.users.find_one({"_id": target_user_id})
            
            if not target_user:
                return jsonify({"error": "User not found"}), 404
                
            # Check if already following
            existing_follow = db.follows.find_one({
                "follower_id": str(follower_id),
                "following_id": str(target_user_id)
            })
            
            if not existing_follow:
                return jsonify({"error": "Not following this user"}), 400
                
            # Delete follow relation
            db.follows.delete_one({
                "follower_id": str(follower_id),
                "following_id": str(target_user_id)
            })
            
            # Calculate updated stats dynamically for the current user
            current_user_following_count = db.follows.count_documents({"follower_id": str(follower_id)})
            current_user_follower_count = db.follows.count_documents({"following_id": str(follower_id)})

            # Return success with dynamically calculated stats for the current user
            return jsonify({
                "message": "Successfully unfollowed user",
                "updated_stats": {
                    "following": current_user_following_count,
                    "followers": current_user_follower_count
                }
            })
            
        except Exception as e:
            return jsonify({"error": f"Invalid user ID: {str(e)}"}), 400
            
    except Exception as e:
        print("Error unfollowing user:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# Get followers of a user
@app.route('/api/users/<user_id>/followers', methods=['GET'])
def get_followers(user_id):
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        # Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid token"}), 401
        
        token = auth_header.split(" ")[1]
        current_user = get_current_user(token, db)
        
        if not current_user:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        # Get current user ID
        current_user_id = current_user["_id"]
        
        # Check if user_id is valid
        try:
            target_user_id = ObjectId(user_id)
            
            # Get followers of target user - first get the follow relationships
            follows = list(db.follows.find({"following_id": str(target_user_id)}).sort("created_at", -1))
            
            # Get the follower details from the users collection
            followers = []
            for follow in follows:
                try:
                    # Convert string ID back to ObjectId for lookup
                    follower_id = ObjectId(follow["follower_id"])
                    follower = db.users.find_one({"_id": follower_id})
                    
                    if follower:
                        # Check if current user is following this follower
                        is_following = db.follows.find_one({
                            "follower_id": str(current_user_id),
                            "following_id": str(follower_id)
                        })
                        
                        # Create user data with follow status
                        follower_data = {
                            "_id": str(follower["_id"]),
                            "username": follower["username"],
                            "bio": follower.get("bio", ""),
                            "location": follower.get("location", ""),
                            "avatar_url": follower.get("avatar_url", ""),
                            "stats": follower.get("stats", {"posts": 0, "followers": 0, "following": 0}),
                            "is_following": bool(is_following),
                            "created_at": follow["created_at"]
                        }
                        
                        followers.append(follower_data)
                except Exception as e:
                    print(f"Error processing follower {follow['follower_id']}: {str(e)}")
                    # Continue with next follower if there's an error with this one
                    continue
            
            return jsonify(followers)
            
        except Exception as e:
            return jsonify({"error": f"Invalid user ID: {str(e)}"}), 400
            
    except Exception as e:
        print("Error getting followers:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# Get a user profile
@app.route('/api/users/<user_id>', methods=['GET'])
def get_user_profile(user_id):
    """Get public profile information for a specific user, including populated gyms."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    if not ObjectId.is_valid(user_id):
        return jsonify({"error": "Invalid user ID format"}), 400

    # Check authentication to determine is_following and is_self
    requesting_user_id = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        payload = decode_token(token)
        if payload:
            requesting_user_id = payload.get("sub")

    # Fetch target user profile with gyms using the helper
    target_user = get_user_profile_with_gyms(user_id)
    if not target_user:
        return jsonify({"error": "User not found"}), 404

    # Determine relationship
    is_following = False
    if requesting_user_id and requesting_user_id != user_id:
        is_following = db.follows.count_documents({
            "follower_id": requesting_user_id,
            "following_id": user_id
        }) > 0
    is_self = requesting_user_id == user_id

    # Get user's posts (simplified, assumes Post model handles _id correctly)
    posts_cursor = db.posts.find({"user_id": user_id}).sort("timestamp", -1)
    posts_data = []
    for post in posts_cursor:
        post["_id"] = str(post["_id"])
        posts_data.append(post)
        
    # Calculate stats (can reuse logic from /api/auth/me)
    post_count = len(posts_data) # Count from already fetched posts
    follower_count = db.follows.count_documents({"following_id": user_id})
    following_count = db.follows.count_documents({"follower_id": user_id})
    stats = {
        "posts": post_count,
        "followers": follower_count,
        "following": following_count
    }

    # Prepare final response object
    user_profile_data = {
        "_id": str(target_user["_id"]),
        "username": target_user["username"],
        "bio": target_user.get("bio", ""),
        "location": target_user.get("location", ""),
        "avatar_url": target_user.get("avatar_url", ""),
        "climbing_gyms": target_user.get("climbing_gyms", []), # Populated by helper
        "stats": stats,
        "is_following": is_following,
        "is_self": is_self,
        "posts": posts_data
    }

    # Ideally, validate this with UserProfile model if defined
    return jsonify(user_profile_data)

# Search users
@app.route('/api/users/search', methods=['GET'])
def search_users():
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        # Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid token"}), 401
        
        token = auth_header.split(" ")[1]
        current_user = get_current_user(token, db)
        
        if not current_user:
            return jsonify({"error": "Invalid or expired token"}), 401
        
        # Get current user ID
        current_user_id = current_user["_id"]
        
        # Get query parameter
        query = request.args.get('q', '')
        if not query:
            return jsonify([])
        
        # Search users by username or location
        users = list(db.users.find({
            "$or": [
                {"username": {"$regex": query, "$options": "i"}},
                {"location": {"$regex": query, "$options": "i"}}
            ]
        }).limit(20))
        
        result = []
        for user in users:
            # Skip current user in results
            if user["_id"] == current_user_id:
                continue
                
            # Check if current user is following this user
            is_following = db.follows.find_one({
                "follower_id": str(current_user_id),
                "following_id": str(user["_id"])
            })
            
            user_data = {
                "_id": str(user["_id"]),
                "username": user["username"],
                "bio": user.get("bio", ""),
                "location": user.get("location", ""),
                "avatar_url": user.get("avatar_url", ""),
                "stats": user.get("stats", {"posts": 0, "followers": 0, "following": 0}),
                "is_following": bool(is_following)
            }
            
            result.append(user_data)
        
        return jsonify(result)
        
    except Exception as e:
        print("Error searching users:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# Gym Routes

@app.route('/api/gyms/search', methods=['GET'])
def search_gyms():
    """Search for gyms by name (case-insensitive) for autocomplete."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500

    # Authentication (optional but recommended)
    # auth_header = request.headers.get("Authorization")
    # if not auth_header or not auth_header.startswith("Bearer "):
    #     return jsonify({"error": "Missing or invalid token"}), 401
    # token = auth_header.split(" ")[1]
    # current_user = get_current_user(token, db)
    # if not current_user:
    #     return jsonify({"error": "Invalid or expired token"}), 401

    query = request.args.get('q', '')
    if not query:
        return jsonify([]), 200 # Return empty list if query is empty

    try:
        # Case-insensitive regex search
        regex = re.compile(f'{re.escape(query)}', re.IGNORECASE)
        gym_cursor = db.gyms.find({"name": regex}).limit(10)
        
        gyms_list = []
        for gym_doc in gym_cursor:
            try:
                # Convert _id value to string *in place* before validation
                if '_id' in gym_doc:
                     gym_doc['_id'] = str(gym_doc['_id'])
                gym_model = Gym.model_validate(gym_doc) # Validate the modified doc
                gyms_list.append(gym_model.model_dump(by_alias=True))
            except Exception as validation_error:
                original_id_repr = repr(gym_doc.get('_id', 'MISSING')) # Get representation before potential conversion
                print(f"Error validating gym data during search: {validation_error}, Orig ID repr: {original_id_repr}")
                continue 
            
        return jsonify(gyms_list)
    except Exception as e:
        print(f"Error searching gyms: {e}")
        return jsonify({"error": "Failed to search gyms"}), 500

@app.route('/api/gyms', methods=['POST'])
def add_gym():
    """Add a new gym if it doesn't exist (case-insensitive check)."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500

    # Authentication
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Missing or invalid token"}), 401
    token = auth_header.split(" ")[1]
    current_user = get_current_user(token, db)
    if not current_user:
        return jsonify({"error": "Invalid or expired token"}), 401

    try:
        gym_data = GymCreate(**request.json)
        gym_name_lower = gym_data.name.lower()

        existing_gym_doc = db.gyms.find_one({"name_lower": gym_name_lower})

        if existing_gym_doc:
            # Gym exists, validate and return it
            try:
                # Convert _id value to string *in place* before validation
                if '_id' in existing_gym_doc:
                    existing_gym_doc['_id'] = str(existing_gym_doc['_id'])
                gym_model = Gym.model_validate(existing_gym_doc) # Validate the modified doc
                return jsonify(gym_model.model_dump(by_alias=True)), 200
            except Exception as validation_error:
                original_id_repr = repr(existing_gym_doc.get('_id', 'MISSING'))
                print(f"Error validating existing gym data: {validation_error}, Orig ID repr: {original_id_repr}")
                return jsonify({"error": "Failed to process existing gym data"}), 500
        else:
            # Gym doesn't exist, create it
            new_gym_doc = {
                "name": gym_data.name,
                "name_lower": gym_name_lower,
                "location": gym_data.location,
                "added_by": ObjectId(current_user['_id']),
                "created_at": datetime.utcnow()
            }
            result = db.gyms.insert_one(new_gym_doc)
            
            created_gym_doc = db.gyms.find_one({"_id": result.inserted_id})
            if not created_gym_doc:
                 return jsonify({"error": "Failed to retrieve created gym"}), 500
                 
            try:
                # Convert _id value to string *in place* before validation
                if '_id' in created_gym_doc:
                    created_gym_doc['_id'] = str(created_gym_doc['_id'])
                gym_model = Gym.model_validate(created_gym_doc) # Validate the modified doc
                return jsonify(gym_model.model_dump(by_alias=True)), 201
            except Exception as validation_error:
                original_id_repr = repr(created_gym_doc.get('_id', 'MISSING'))
                print(f"Error validating created gym data: {validation_error}, Orig ID repr: {original_id_repr}")
                return jsonify({"error": "Failed to process created gym data"}), 500

    except Exception as e:
        print(f"Error adding gym: {e}")
        return jsonify({"error": f"Failed to add gym: {str(e)}"}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000) 