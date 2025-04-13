from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

def get_db():
    """Get MongoDB database connection."""
    try:
        client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
        # Test the connection
        client.server_info()
        db = client.rockclimbing_db
        print("Successfully connected to MongoDB!")
        return db
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        return None

# Global database instance
db = get_db()
