from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, List
from datetime import datetime

class UserBase(BaseModel):
    username: str
    email: EmailStr
    bio: Optional[str] = ""
    location: Optional[str] = ""
    avatar_url: Optional[str] = ""

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserStats(BaseModel):
    posts: int = 0
    followers: int = 0
    following: int = 0

class UserPublic(UserBase):
    id: str = Field(alias="_id")
    created_at: datetime
    stats: UserStats
    is_following: Optional[bool] = False
    is_self: Optional[bool] = False
    climbing_gym_names: Optional[List[str]] = None

class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    avatar_url: Optional[str] = None
    climbing_gym_ids: Optional[List[str]] = None

class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str 