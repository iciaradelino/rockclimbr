from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class GymBase(BaseModel):
    name: str
    location: str

class GymCreate(GymBase):
    pass

class Gym(GymBase):
    id: str = Field(alias="_id")
    name_lower: str
    added_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow) 