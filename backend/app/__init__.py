from flask import Flask
from flask_cors import CORS
from .utils.db import db
from .routes.auth import auth
from .routes.workouts import workouts
from .routes.posts import posts
from .routes.gyms import gyms
from .routes.users import users

def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    
    # Update CORS configuration with explicit origins, methods, headers, and support for credentials
    CORS(app, resources={
        r"/api/*": {
            "origins": [
                "http://localhost:8081",
                "http://localhost:19006",
                "exp://localhost:19000",
                "http://localhost:19000",
                "http://localhost:19001",
                "http://localhost:19002",
                "http://localhost:3000"
            ],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Authorization", "Content-Type"],
            "supports_credentials": True,
            "expose_headers": ["Content-Length", "Content-Type", "Authorization"]
        }
    })

    # Register blueprints
    app.register_blueprint(auth, url_prefix='/api/auth')
    app.register_blueprint(workouts, url_prefix='/api/workouts')
    app.register_blueprint(posts, url_prefix='/api/posts')
    app.register_blueprint(gyms, url_prefix='/api/gyms')
    app.register_blueprint(users, url_prefix='/api/users')

    # Health check endpoint for connectivity testing
    @app.route('/api/ping', methods=['GET', 'OPTIONS'])
    def ping():
        return {"status": "ok"}, 200

    # Test route
    @app.route('/api/test', methods=['GET'])
    def test_connection():
        if db is None:
            return {"message": "Backend is working but MongoDB is not connected!"}, 500
        return {"message": "Backend is working and MongoDB is connected!"}

    return app
