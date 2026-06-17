from pydantic import BaseModel
from typing import Optional, List


class TimeSlot(BaseModel):
    id: int
    day: int
    day_name: str
    start_hour: int
    end_hour: int
    duration_hours: float


class ParametersResponse(BaseModel):
    max_students_per_course: int
    max_weekly_hours_per_professor: int
    available_classrooms: int
    solver_timeout_seconds: int
    time_slots: List[TimeSlot]


class ParametersUpdate(BaseModel):
    max_students_per_course: Optional[int] = None
    max_weekly_hours_per_professor: Optional[int] = None
    available_classrooms: Optional[int] = None
    solver_timeout_seconds: Optional[int] = None
    time_slots: Optional[List[TimeSlot]] = None
