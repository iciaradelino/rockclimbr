from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class PostBase(BaseModel):
    image_url: str
    caption: str
    location: str
    difficulty: str

class PostCreate(PostBase):
    pass

class Post(PostBase):
    id: str = Field(alias="_id")
    user_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    likes: int = 0
    comments: int = 0
    username: Optional[str] = None  # Added for feed queries
    avatar_url: Optional[str] = None  # Added for feed queries 