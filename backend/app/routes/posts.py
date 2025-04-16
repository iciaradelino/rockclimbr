from flask import Blueprint, jsonify, request
from datetime import datetime
from bson import ObjectId
import traceback
from ..utils.db import db
from ..middleware.auth_middleware import login_required, get_current_user
from ..models.post import Post, PostCreate

posts = Blueprint('posts', __name__)

@posts.route('', methods=['GET'])
@login_required
def get_posts():
    """Get all posts for the current user."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401
        
        # Get posts for the current user
        user_id = str(current_user["_id"])
        posts_cursor = db.posts.find({"user_id": user_id}).sort("timestamp", -1)
        posts_list = []
        
        for post in posts_cursor:
            post["_id"] = str(post["_id"])
            posts_list.append(Post(**post).dict(by_alias=True))
            
        return jsonify(posts_list)
    except Exception as e:
        print("Error getting posts:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@posts.route('', methods=['POST'])
@login_required
def add_post():
    """Add a new post."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401
        
        # Validate request data
        post_data = PostCreate(**request.json)
        
        # Create post document
        post_dict = post_data.dict()
        post_dict.update({
            "user_id": str(current_user["_id"]),
            "timestamp": datetime.utcnow(),
            "likes": 0,
            "comments": 0,
            "username": current_user["username"],
            "avatar_url": current_user.get("avatar_url", "")
        })
        
        # Insert post
        result = db.posts.insert_one(post_dict)
        
        # Update user stats
        db.users.update_one(
            {"_id": current_user["_id"]},
            {"$inc": {"stats.posts": 1}}
        )
        
        # Get the created post
        created_post = db.posts.find_one({"_id": result.inserted_id})
        created_post["_id"] = str(created_post["_id"])
        
        return jsonify(Post(**created_post).dict(by_alias=True))
    except Exception as e:
        print("Error adding post:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 400

@posts.route('/feed', methods=['GET'])
@login_required
def get_feed():
    """Get feed of posts from followed users and users sharing gyms."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401
        
        user_id = str(current_user["_id"])
        
        # 1. Get IDs of users the current user follows
        following_cursor = db.follows.find({"follower_id": user_id}, {"following_id": 1})
        following_ids = {follow["following_id"] for follow in following_cursor}
        
        # 2. Get IDs of users sharing gyms with the current user
        user_gym_ids = current_user.get("climbing_gym_ids", [])
        gym_users_ids = set()
        if user_gym_ids:
            # Find users who have at least one gym in common and are not the current user
            gym_users_cursor = db.users.find(
                {"climbing_gym_ids": {"$in": user_gym_ids}, "_id": {"$ne": current_user["_id"]}},
                {"_id": 1}
            )
            gym_users_ids = {str(user["_id"]) for user in gym_users_cursor}

        # 3. Combine follower IDs and gym-mate IDs (excluding self)
        combined_user_ids = list(following_ids.union(gym_users_ids))

        # If the combined list is empty, return an empty feed
        if not combined_user_ids:
             return jsonify([])

        # 4. Get posts from the combined list of users, sorted by time
        pipeline = [
            {"$match": {"user_id": {"$in": combined_user_ids}}},
            {"$sort": {"timestamp": -1}},
            {"$limit": 50} # Keep the limit for performance
        ]
        
        posts_cursor = db.posts.aggregate(pipeline)
        posts_list = []
        
        for post in posts_cursor:
            post["_id"] = str(post["_id"])
            # Ensure necessary fields like username and avatar_url are present
            # The Post model might handle defaults if not found, but it's good practice
            # If post doesn't have username/avatar, we might need a lookup here,
            # but assuming they are added during post creation.
            posts_list.append(Post(**post).dict(by_alias=True))
            
        return jsonify(posts_list)
    except Exception as e:
        print("Error getting feed:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@posts.route('/<post_id>', methods=['GET'])
@login_required
def get_post(post_id):
    """Get a specific post."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401
        
        # Get post
        post = db.posts.find_one({"_id": ObjectId(post_id)})
        
        if not post:
            return jsonify({"error": "Post not found"}), 404
        
        post["_id"] = str(post["_id"])
        return jsonify(Post(**post).dict(by_alias=True))
    except Exception as e:
        print("Error getting post:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@posts.route('/<post_id>', methods=['DELETE'])
@login_required
def delete_post(post_id):
    """Delete a specific post."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401
        
        # Delete post
        result = db.posts.delete_one({
            "_id": ObjectId(post_id),
            "user_id": str(current_user["_id"])
        })
        
        if result.deleted_count == 0:
            return jsonify({"error": "Post not found"}), 404
        
        # Update user stats
        db.users.update_one(
            {"_id": current_user["_id"]},
            {"$inc": {"stats.posts": -1}}
        )
            
        return jsonify({"message": "Post deleted successfully"})
    except Exception as e:
        print("Error deleting post:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500
