from flask import Blueprint, jsonify, request
from datetime import datetime
from bson import ObjectId
import traceback
from ..utils.db import db
from ..middleware.auth_middleware import login_required, get_current_user
from ..models.workout import Workout, WorkoutCreate

workouts = Blueprint('workouts', __name__)

@workouts.route('', methods=['GET'])
@login_required
def get_workouts():
    """Get all workouts for the current user."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401
        
        # Get workouts for the current user
        user_id = str(current_user["_id"])
        workouts_cursor = db.workouts.find({"user_id": user_id}).sort("date", -1)
        workouts_list = []
        
        for workout in workouts_cursor:
            workout["_id"] = str(workout["_id"])
            workouts_list.append(Workout(**workout).dict(by_alias=True))
            
        return jsonify(workouts_list)
    except Exception as e:
        print("Error getting workouts:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@workouts.route('', methods=['POST'])
@login_required
def add_workout():
    """Add a new workout."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401
        
        # Validate request data
        workout_data = WorkoutCreate(**request.json)
        
        # Create workout document
        workout_dict = workout_data.dict()
        workout_dict["user_id"] = str(current_user["_id"])
        workout_dict["created_at"] = datetime.utcnow()
        
        # Insert workout
        result = db.workouts.insert_one(workout_dict)
        
        # Get the created workout
        created_workout = db.workouts.find_one({"_id": result.inserted_id})
        created_workout["_id"] = str(created_workout["_id"])
        
        return jsonify(Workout(**created_workout).dict(by_alias=True))
    except Exception as e:
        print("Error adding workout:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 400

@workouts.route('/<workout_id>', methods=['GET'])
@login_required
def get_workout(workout_id):
    """Get a specific workout."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401
        
        # Get workout
        workout = db.workouts.find_one({
            "_id": ObjectId(workout_id),
            "user_id": str(current_user["_id"])
        })
        
        if not workout:
            return jsonify({"error": "Workout not found"}), 404
        
        workout["_id"] = str(workout["_id"])
        return jsonify(Workout(**workout).dict(by_alias=True))
    except Exception as e:
        print("Error getting workout:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@workouts.route('/<workout_id>', methods=['PUT'])
@login_required
def update_workout(workout_id):
    """Update a specific workout."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401
        
        # Check if workout exists and belongs to user
        existing_workout = db.workouts.find_one({
            "_id": ObjectId(workout_id),
            "user_id": str(current_user["_id"])
        })
        
        if not existing_workout:
            return jsonify({"error": "Workout not found"}), 404
        
        # Validate update data
        workout_data = WorkoutCreate(**request.json)
        update_dict = workout_data.dict()
        
        # Update workout
        result = db.workouts.find_one_and_update(
            {"_id": ObjectId(workout_id)},
            {"$set": update_dict},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
            return jsonify(Workout(**result).dict(by_alias=True))
        return jsonify({"error": "Update failed"}), 500
    except Exception as e:
        print("Error updating workout:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 400

@workouts.route('/<workout_id>', methods=['DELETE'])
@login_required
def delete_workout(workout_id):
    """Delete a specific workout."""
    if db is None:
        return jsonify({"error": "MongoDB is not connected"}), 500
    try:
        current_user = get_current_user(db)
        if not current_user:
            return jsonify({"error": "Not authenticated"}), 401
        
        # Delete workout
        result = db.workouts.delete_one({
            "_id": ObjectId(workout_id),
            "user_id": str(current_user["_id"])
        })
        
        if result.deleted_count == 0:
            return jsonify({"error": "Workout not found"}), 404
            
        return jsonify({"message": "Workout deleted successfully"})
    except Exception as e:
        print("Error deleting workout:", str(e))
        print("Traceback:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500
