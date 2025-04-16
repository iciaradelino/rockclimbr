from flask import Blueprint, jsonify, request
from bson import ObjectId, errors as bson_errors
import traceback
import re
from ..utils.db import db
from ..middleware.auth_middleware import login_required, get_current_user
from ..models.user import UserPublic
from datetime import datetime

users = Blueprint('users', __name__)

@users.route('/search', methods=['GET'])
@login_required
def search_users():
    """Search for users by username or location."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401
        
        query = request.args.get('q', '')
        if not query or len(query.strip()) < 2: # Also check min length
            return jsonify([])

        query_stripped = query.strip()
        
        # 1. Find gyms matching the query by name
        matching_gyms_cursor = db.gyms.find(
            {"name": {"$regex": query_stripped, "$options": "i"}},
            {"_id": 1} # Only fetch the ID
        )
        matched_gym_ids = [gym["_id"] for gym in matching_gyms_cursor]

        # 2. Construct the user search query conditions
        or_conditions = [
            {"username": {"$regex": query_stripped, "$options": "i"}},
            {"location": {"$regex": query_stripped, "$options": "i"}}
        ]
        
        # Add gym ID condition only if gyms were found
        if matched_gym_ids:
            or_conditions.append({"climbing_gym_ids": {"$in": matched_gym_ids}})
        
        # Construct the final MongoDB query
        mongo_query = {
            "_id": {"$ne": ObjectId(current_user["_id"])}, # Exclude self
            "$or": or_conditions
        }

        # 3. Find users matching the combined query
        users_cursor = db.users.find(mongo_query).limit(20)
        
        # Make a copy to iterate over (cursors can sometimes be exhausted)
        users_list = list(users_cursor)

        results = []
        current_user_id_str = str(current_user["_id"])
        
        # Get IDs of users the current user is following
        following_cursor = db.follows.find({"follower_id": current_user_id_str}, {"following_id": 1})
        following_ids = {follow["following_id"] for follow in following_cursor}

        # Iterate over the copied list
        for user in users_list: 
            user_id_str = str(user["_id"])
            
            # Fetch climbing gym names based on IDs
            gym_names = []
            gym_ids_str = user.get("climbing_gym_ids", [])
            if gym_ids_str:
                # Convert string IDs to ObjectIds for querying gyms
                try:
                    gym_object_ids = [ObjectId(gid) for gid in gym_ids_str if gid] 
                except bson_errors.InvalidId:
                    print(f"Warning: Invalid ObjectId found in climbing_gym_ids for user {user_id_str}")
                    gym_object_ids = [] # Handle invalid IDs gracefully
                
                if gym_object_ids:
                    gyms_cursor = db.gyms.find({"_id": {"$in": gym_object_ids}}, {"name": 1})
                    gym_names = [gym.get("name", "Unknown Gym") for gym in gyms_cursor]
            
            user_data = {
                "_id": user_id_str,
                "username": user["username"],
                "email": user.get("email", ""),
                "bio": user.get("bio", ""),
                "location": user.get("location", ""),
                "avatar_url": user.get("avatar_url", ""),
                "stats": user.get("stats", {"posts": 0, "followers": 0, "following": 0}),
                "created_at": user.get("created_at", datetime.utcnow()),
                "is_following": user_id_str in following_ids,
                "climbing_gym_names": gym_names
            }
            try:
                # Validate with Pydantic model before appending
                validated_user = UserPublic(**user_data)
                results.append(validated_user.dict(by_alias=True))
            except Exception as validation_error:
                print(f"Error validating user data during search: {validation_error}, User ID: {user_id_str}")
                continue # Skip invalid data

        return jsonify(results)
        
    except Exception as e:
        print("Error searching users:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@users.route('/follow/<string:user_id>', methods=['POST'])
@login_required
def follow_user(user_id):
    """Follow another user."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500

    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401

        current_user_id_str = str(current_user["_id"])

        # Prevent following self
        if user_id == current_user_id_str:
            return jsonify({"error": "Cannot follow yourself"}), 400

        # Check if the user to follow exists
        user_to_follow = db.users.find_one({"_id": ObjectId(user_id)})
        if not user_to_follow:
            return jsonify({"error": "User to follow not found"}), 404

        # Check if already following
        existing_follow = db.follows.find_one({
            "follower_id": current_user_id_str,
            "following_id": user_id
        })
        if existing_follow:
            return jsonify({"message": "Already following this user"}), 200 # Or 409 Conflict

        # Create follow relationship
        follow_data = {
            "follower_id": current_user_id_str,
            "following_id": user_id,
            "created_at": datetime.utcnow()
        }
        db.follows.insert_one(follow_data)

        # Optional: Update follower/following counts (consider performance implications)
        db.users.update_one({"_id": current_user["_id"]}, {"$inc": {"stats.following": 1}})
        db.users.update_one({"_id": ObjectId(user_id)}, {"$inc": {"stats.followers": 1}})

        return jsonify({"message": "User followed successfully"}), 201

    except bson_errors.InvalidId:
         return jsonify({"error": "Invalid user ID format"}), 400
    except Exception as e:
        print(f"Error following user {user_id}:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": "An error occurred while following the user"}), 500

@users.route('/unfollow/<string:user_id>', methods=['POST']) # Using POST for simplicity, DELETE is also common
@login_required
def unfollow_user(user_id):
    """Unfollow another user."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401

        current_user_id_str = str(current_user["_id"])

        # Check if the user to unfollow exists (optional, but good practice)
        user_to_unfollow = db.users.find_one({"_id": ObjectId(user_id)})
        if not user_to_unfollow:
            return jsonify({"error": "User to unfollow not found"}), 404

        # Attempt to delete the follow relationship
        delete_result = db.follows.delete_one({
            "follower_id": current_user_id_str,
            "following_id": user_id
        })

        # If a document was deleted, update the counts
        if delete_result.deleted_count > 0:
            db.users.update_one({"_id": current_user["_id"]}, {"$inc": {"stats.following": -1}})
            db.users.update_one({"_id": ObjectId(user_id)}, {"$inc": {"stats.followers": -1}})
            return jsonify({"message": "User unfollowed successfully"}), 200
        else:
            # If no document was deleted, they weren't following them
            return jsonify({"message": "You are not following this user"}), 200 # Or 404

    except bson_errors.InvalidId:
        return jsonify({"error": "Invalid user ID format"}), 400
    except Exception as e:
        print(f"Error unfollowing user {user_id}:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": "An error occurred while unfollowing the user"}), 500

@users.route('/<string:user_id>', methods=['GET'])
@login_required
def get_user_profile(user_id):
    """Get a user's public profile."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500

    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401

        # Find the requested user
        profile_user = db.users.find_one({"_id": ObjectId(user_id)})
        if not profile_user:
            return jsonify({"error": "User not found"}), 404

        current_user_id_str = str(current_user["_id"])
        profile_user_id_str = str(profile_user["_id"])

        # Check if the current user is following this profile
        is_following = False
        if current_user_id_str != profile_user_id_str: # Cannot follow self
            existing_follow = db.follows.find_one({
                "follower_id": current_user_id_str,
                "following_id": profile_user_id_str
            })
            if existing_follow:
                is_following = True
        
        # Check if viewing own profile
        is_self = (current_user_id_str == profile_user_id_str)

        # Fetch user posts (limit for performance, sort by newest first)
        user_posts_cursor = db.posts.find({"user_id": profile_user_id_str}).sort("timestamp", -1).limit(50) # Example limit
        user_posts = []
        for post in user_posts_cursor:
            post["_id"] = str(post["_id"]) # Convert ObjectId to string for JSON
            user_posts.append(post)

        # --- Recalculate Stats --- 
        followers_count = db.follows.count_documents({"following_id": profile_user_id_str})
        following_count = db.follows.count_documents({"follower_id": profile_user_id_str})
        posts_count = len(user_posts)

        print(f"[DEBUG] Calculated Stats for {profile_user_id_str}: Posts={posts_count}, Followers={followers_count}, Following={following_count}")

        # Optional: Update stored stats in the user document for eventual consistency
        # db.users.update_one(
        #     {"_id": ObjectId(profile_user_id_str)},
        #     {"$set": {"stats": {"posts": posts_count, "followers": followers_count, "following": following_count}}}
        # )
        # --- End Recalculate Stats ---

        # Prepare public data using calculated stats
        user_data = {
            "_id": profile_user_id_str,
            "username": profile_user["username"],
            "email": profile_user.get("email", ""), # Added email
            "bio": profile_user.get("bio", ""),
            "location": profile_user.get("location", ""),
            "avatar_url": profile_user.get("avatar_url", ""),
            # "stats": profile_user.get("stats", {"posts": 0, "followers": 0, "following": 0}), # Replaced with calculated stats
            "stats": {
                "posts": posts_count,
                "followers": followers_count,
                "following": following_count
            },
            "created_at": profile_user.get("created_at", datetime.utcnow()), # Added created_at
            "is_following": is_following, 
            "is_self": is_self,
            "posts": user_posts, # Added posts
            "climbing_gym_names": [] # Added climbing_gym_names
        }

        # Return the dictionary directly (validation needs adjustment if UserPublic model used)
        return jsonify(user_data)

    except bson_errors.InvalidId:
        return jsonify({"error": "Invalid user ID format"}), 400
    except Exception as e:
        print(f"Error fetching profile for user {user_id}:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": "An error occurred fetching the profile"}), 500

# --- Add other user routes (profile, follow, unfollow, followers, following) below ---

@users.route('/<string:user_id>/followers', methods=['GET'])
@login_required
def get_followers(user_id):
    """Get a list of users who follow the specified user."""
    if db is None: return jsonify({"error": "DB Error"}), 500
    
    # --- Add ID Validation --- 
    if not user_id or user_id == 'undefined':
        return jsonify({"error": "Invalid or missing user ID"}), 400
    try:
        # Try converting to ObjectId early to validate format
        profile_user_obj_id = ObjectId(user_id)
    except bson_errors.InvalidId:
        return jsonify({"error": "Invalid user ID format"}), 400
    # --- End ID Validation ---

    try:
        # Find follows where the specified user is being followed
        follow_docs = db.follows.find({"following_id": user_id})
        follower_ids = [ObjectId(f["follower_id"]) for f in follow_docs]

        if not follower_ids:
            return jsonify([])

        # Fetch user profiles for follower IDs
        followers = list(db.users.find({"_id": {"$in": follower_ids}}))

        # Prepare and validate data (similar to search, needs UserPublic)
        results = []
        current_user = get_current_user(db)
        current_user_id_str = str(current_user["_id"]) if current_user else None

        # Get IDs of users the current user is following (to mark follow status)
        following_ids_set = set()
        if current_user_id_str:
            following_cursor = db.follows.find({"follower_id": current_user_id_str}, {"following_id": 1})
            following_ids_set = {follow["following_id"] for follow in following_cursor}

        for user in followers:
            user_id_str = str(user["_id"])
            user_data = {
                "_id": user_id_str,
                "username": user["username"],
                "email": user.get("email", ""),
                "bio": user.get("bio", ""),
                "location": user.get("location", ""),
                "avatar_url": user.get("avatar_url", ""),
                "stats": user.get("stats", {"posts": 0, "followers": 0, "following": 0}),
                "created_at": user.get("created_at", datetime.utcnow()),
                "is_following": user_id_str in following_ids_set,
                "is_self": user_id_str == current_user_id_str
            }
            try:
                validated_user = UserPublic(**user_data)
                results.append(validated_user.dict(by_alias=True))
            except Exception as validation_error:
                print(f"Validation error in get_followers for {user_id_str}: {validation_error}")
                continue
        
        return jsonify(results)
    except Exception as e:
        print(f"Error fetching followers for {user_id}: {e}")
        return jsonify({"error": "An error occurred"}), 500

@users.route('/<string:user_id>/following', methods=['GET'])
@login_required
def get_following(user_id):
    """Get a list of users the specified user is following."""
    if db is None: return jsonify({"error": "DB Error"}), 500

    # --- Add ID Validation --- 
    if not user_id or user_id == 'undefined':
        return jsonify({"error": "Invalid or missing user ID"}), 400
    try:
        # Try converting to ObjectId early to validate format
        profile_user_obj_id = ObjectId(user_id)
    except bson_errors.InvalidId:
        return jsonify({"error": "Invalid user ID format"}), 400
    # --- End ID Validation ---

    try:
        # Find follows where the specified user is the follower
        follow_docs = db.follows.find({"follower_id": user_id})
        following_ids = [ObjectId(f["following_id"]) for f in follow_docs]

        if not following_ids:
            return jsonify([])

        # Fetch user profiles for following IDs
        following_users = list(db.users.find({"_id": {"$in": following_ids}}))

        # Prepare and validate data
        results = []
        current_user = get_current_user(db)
        current_user_id_str = str(current_user["_id"]) if current_user else None

        # Get IDs of users the current user is following (to mark follow status)
        following_ids_set = set()
        if current_user_id_str:
            following_cursor = db.follows.find({"follower_id": current_user_id_str}, {"following_id": 1})
            following_ids_set = {follow["following_id"] for follow in following_cursor}

        for user in following_users:
            user_id_str = str(user["_id"])
            user_data = {
                "_id": user_id_str,
                "username": user["username"],
                "email": user.get("email", ""),
                "bio": user.get("bio", ""),
                "location": user.get("location", ""),
                "avatar_url": user.get("avatar_url", ""),
                "stats": user.get("stats", {"posts": 0, "followers": 0, "following": 0}),
                "created_at": user.get("created_at", datetime.utcnow()),
                "is_following": user_id_str in following_ids_set,
                "is_self": user_id_str == current_user_id_str
            }
            try:
                validated_user = UserPublic(**user_data)
                results.append(validated_user.dict(by_alias=True))
            except Exception as validation_error:
                print(f"Validation error in get_following for {user_id_str}: {validation_error}")
                continue

        return jsonify(results)
    except Exception as e:
        print(f"Error fetching following for {user_id}: {e}")
        return jsonify({"error": "An error occurred"}), 500
