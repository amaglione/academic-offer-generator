from pydantic import BaseModel
from typing import Optional, List


class Turno(BaseModel):
    id: int
    name: str
    start_hour: int
    end_hour: int
    days: List[int]


class TimeSlot(BaseModel):
    id: int
    turno_id: int
    turno_name: str
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
    turnos: List[Turno]
    time_slots: List[TimeSlot]


class ParametersUpdate(BaseModel):
    max_students_per_course: Optional[int] = None
    max_weekly_hours_per_professor: Optional[int] = None
    available_classrooms: Optional[int] = None
    solver_timeout_seconds: Optional[int] = None
    turnos: Optional[List[Turno]] = None
    time_slots: Optional[List[TimeSlot]] = None
