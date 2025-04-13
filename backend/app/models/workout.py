from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class Climb(BaseModel):
    route_name: str
    grade: str
    attempts: int
    send_status: str  # e.g., "sent", "project", "flash"
    notes: Optional[str] = None

class WorkoutBase(BaseModel):
    date: datetime
    duration: int  # in minutes
    location: str
    climbs: List[Climb]
    session_feeling: Optional[str] = None
    achievement: Optional[str] = None
    images: Optional[List[str]] = []

class WorkoutCreate(WorkoutBase):
    pass

class Workout(WorkoutBase):
    id: str = Field(alias="_id")
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow) 