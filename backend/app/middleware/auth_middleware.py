from functools import wraps
from flask import request, jsonify, make_response
import jwt
from jwt import exceptions as jwt_exceptions
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from bson import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

# JWT Configuration
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key')  # You should always use an environment variable
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # Extended to 24 hours for better user experience

# --- Password Hashing Functions --- Added from routes/auth.py
def hash_password(password: str) -> str:
    """Hash a password for storing."""
    return generate_password_hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a stored password against one provided by user."""
    if not hashed_password:
        return False
    try:
        return check_password_hash(hashed_password, plain_password)
    except ValueError:
        print(f"Warning: Attempted to verify password with invalid hash format: {hashed_password[:10]}...")
        return False
# --- End of added functions ---

def create_access_token(data: dict):
    """Create a new access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    """Verify a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt_exceptions.ExpiredSignatureError:
        print("Token verification failed: ExpiredSignatureError")
        return None
    except jwt_exceptions.InvalidSignatureError:
        print("Token verification failed: InvalidSignatureError")
        return None
    except jwt_exceptions.PyJWTError as e:
        print(f"Token verification failed: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error during token verification: {str(e)}")
        return None

def get_current_user(db):
    """Get the current user from the request's Authorization header."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            print("Missing or invalid Authorization header")
            return None

        token = auth_header.split(' ')[1]
        payload = verify_token(token)
        if not payload:
            print("Invalid token payload")
            return None

        user_id = payload.get('sub')
        if not user_id:
            print("No user ID in token payload")
            return None

        try:
            user = db.users.find_one({"_id": ObjectId(user_id)})
            if not user:
                print(f"User not found with ID: {user_id}")
            return user
        except Exception as db_error:
            print(f"Database error in get_current_user: {str(db_error)}")
            return None
    except Exception as e:
        print(f"Unexpected error in get_current_user: {str(e)}")
        return None

def login_required(f):
    """Decorator to require login for routes."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                return jsonify({"error": "No authorization token provided"}), 401

            token = auth_header.split(' ')[1]
            payload = verify_token(token)
            if not payload:
                return jsonify({"error": "Invalid or expired token"}), 401

            return f(*args, **kwargs)
        except Exception as e:
            print(f"Unexpected error in login_required: {str(e)}")
            return jsonify({"error": "Authentication error occurred"}), 500
    return decorated_function 