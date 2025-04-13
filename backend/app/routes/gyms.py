from flask import Blueprint, jsonify, request
from datetime import datetime
from bson import ObjectId
import traceback
import re
from ..utils.db import db
from ..middleware.auth_middleware import login_required, get_current_user
from ..models.gym import Gym, GymCreate

gyms = Blueprint('gyms', __name__)

@gyms.route('/search', methods=['GET'])
@login_required
def search_gyms():
    """Search for gyms by name."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        query = request.args.get('q', '')
        if not query:
            return jsonify([])
        
        # Case-insensitive regex search
        regex = re.compile(f'{re.escape(query)}', re.IGNORECASE)
        gym_cursor = db.gyms.find({"name": regex}).limit(10)
        
        gyms_list = []
        for gym in gym_cursor:
            gym["_id"] = str(gym["_id"])
            if "added_by" in gym and isinstance(gym["added_by"], ObjectId):
                gym["added_by"] = str(gym["added_by"])
            gyms_list.append(Gym(**gym).dict(by_alias=True))
            
        return jsonify(gyms_list)
    except Exception as e:
        print("Error searching gyms:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@gyms.route('', methods=['POST'])
@login_required
def add_gym():
    """Add a new gym if it doesn't exist."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401
        
        # Validate request data
        gym_data = GymCreate(**request.json)
        gym_name_lower = gym_data.name.lower()
        
        # Check if gym already exists
        existing_gym = db.gyms.find_one({"name_lower": gym_name_lower})
        if existing_gym:
            existing_gym["_id"] = str(existing_gym["_id"])
            return jsonify(Gym(**existing_gym).dict(by_alias=True))
        
        # Create gym document
        gym_dict = gym_data.dict()
        gym_dict.update({
            "name_lower": gym_name_lower,
            "added_by": str(current_user["_id"]),
            "created_at": datetime.utcnow()
        })
        
        # Insert gym
        result = db.gyms.insert_one(gym_dict)
        
        # Get the created gym
        created_gym = db.gyms.find_one({"_id": result.inserted_id})
        created_gym["_id"] = str(created_gym["_id"])
        
        return jsonify(Gym(**created_gym).dict(by_alias=True)), 201
    except Exception as e:
        print("Error adding gym:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 400

@gyms.route('/<gym_id>', methods=['GET'])
@login_required
def get_gym(gym_id):
    """Get a specific gym."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        gym = db.gyms.find_one({"_id": ObjectId(gym_id)})
        
        if not gym:
            return jsonify({"error": "Gym not found"}), 404
        
        gym["_id"] = str(gym["_id"])
        return jsonify(Gym(**gym).dict(by_alias=True))
    except Exception as e:
        print("Error getting gym:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@gyms.route('/<gym_id>', methods=['PUT'])
@login_required
def update_gym(gym_id):
    """Update a specific gym."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401
        
        # Check if gym exists
        existing_gym = db.gyms.find_one({"_id": ObjectId(gym_id)})
        if not existing_gym:
            return jsonify({"error": "Gym not found"}), 404
        
        # Only allow updates by the user who added the gym
        if str(existing_gym["added_by"]) != str(current_user["_id"]):
            return jsonify({"error": "Not authorized to update this gym"}), 403
        
        # Validate update data
        gym_data = GymCreate(**request.json)
        update_dict = gym_data.dict()
        update_dict["name_lower"] = update_dict["name"].lower()
        
        # Update gym
        result = db.gyms.find_one_and_update(
            {"_id": ObjectId(gym_id)},
            {"$set": update_dict},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
            return jsonify(Gym(**result).dict(by_alias=True))
        return jsonify({"error": "Update failed"}), 500
    except Exception as e:
        print("Error updating gym:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 400

@gyms.route('/<gym_id>', methods=['DELETE'])
@login_required
def delete_gym(gym_id):
    """Delete a specific gym."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401
        
        # Check if gym exists
        existing_gym = db.gyms.find_one({"_id": ObjectId(gym_id)})
        if not existing_gym:
            return jsonify({"error": "Gym not found"}), 404
        
        # Only allow deletion by the user who added the gym
        if str(existing_gym["added_by"]) != str(current_user["_id"]):
            return jsonify({"error": "Not authorized to delete this gym"}), 403
        
        # Delete gym
        result = db.gyms.delete_one({"_id": ObjectId(gym_id)})
        
        if result.deleted_count == 0:
            return jsonify({"error": "Delete failed"}), 500
            
        return jsonify({"message": "Gym deleted successfully"})
    except Exception as e:
        print("Error deleting gym:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500
