from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class CourseSchema(BaseModel):
    id: int
    subject_id: int
    subject_name: Optional[str] = None
    career_id: Optional[int] = None
    career_name: Optional[str] = None
    year: Optional[int] = None
    professor_id: int
    professor_name: Optional[str] = None
    time_slot: dict
    expected_students: int
    manually_modified: bool
    eligible_professors: List[dict] = []


class OfferSchema(BaseModel):
    id: int
    semester: str
    generated_at: datetime
    status: str
    courses: List[CourseSchema] = []


class OfferListItem(BaseModel):
    id: int
    semester: str
    generated_at: datetime
    status: str
    total_courses: int


class CourseUpdate(BaseModel):
    professor_id: Optional[int] = None
    time_slot: Optional[dict] = None
