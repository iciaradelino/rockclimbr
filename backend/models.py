from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId # Import ObjectId

# Helper for ObjectId validation/serialization if needed later
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

# --- Gym Models ---
class GymBase(BaseModel):
    name: str
    location: Optional[str] = None

class GymCreate(GymBase):
    pass

class Gym(GymBase):
    id: str = Field(..., alias="_id") # Use alias for MongoDB _id

    class Config:
        # orm_mode = True # Deprecated in Pydantic V2
        from_attributes = True # Use this instead of orm_mode
        allow_population_by_field_name = True
        json_encoders = {
            ObjectId: str
        }

class GymInDB(Gym):
    added_by: PyObjectId # Store reference to user who added it
    created_at: datetime = Field(default_factory=datetime.utcnow)

# --- Existing Models (Modified) ---
class Climb(BaseModel):
    name: str
    grade: str
    style: str
    is_new: bool = False

class Workout(BaseModel):
    user_id: str  # This will be the MongoDB ObjectId of the user
    date: datetime
    duration: str
    location: str
    climbs: List[Climb]
    session_feeling: Optional[int] = None
    achievement: Optional[str] = None
    images: List[str] = []

class Post(BaseModel):
    user_id: str  # This will be the MongoDB ObjectId of the user
    image_url: str
    caption: str
    location: str
    difficulty: str
    timestamp: datetime
    likes: int = 0
    comments: int = 0

class UserBase(BaseModel):
    username: str
    email: EmailStr
    disabled: Optional[bool] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class User(UserBase):
    id: str
    username: str
    email: EmailStr
    bio: Optional[str] = None
    location: Optional[str] = None
    avatar_url: Optional[str] = None
    # This now represents the populated gyms returned by GET requests
    climbing_gyms: Optional[List[Gym]] = [] 
    created_at: datetime
    stats: dict

    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }

class UserStats(BaseModel):
    posts: int = 0
    followers: int = 0
    following: int = 0

class UserProfile(User):
    stats: UserStats

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class PostBase(BaseModel):
    image_url: str
    caption: Optional[str] = None
    location: Optional[str] = None
    difficulty: Optional[str] = None

class PostCreate(PostBase):
    pass

class Post(PostBase):
    _id: str # Assuming MongoDB ObjectId as string
    user_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    likes: List[str] = [] # List of user IDs who liked the post

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat(),
        }

class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    avatar_url: Optional[str] = None
    # Changed from climbing_gyms: List[str] to climbing_gym_ids: List[str]
    # Frontend will send a list of Gym IDs (as strings)
    climbing_gym_ids: Optional[List[str]] = None 

class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str

class FollowRelation(BaseModel):
    follower_id: str  # User who is following
    following_id: str  # User who is being followed
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserPublic(BaseModel):
    id: str = Field(alias="_id")
    username: str
    bio: Optional[str] = None
    location: Optional[str] = None
    avatar_url: Optional[str] = None
    stats: Optional[dict] = None
    is_following: bool = False

    class Config:
        allow_population_by_field_name = True 