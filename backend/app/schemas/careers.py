from pydantic import BaseModel
from typing import Optional, List


class CareerResponse(BaseModel):
    id: int
    name: str


class ProfessorInSubject(BaseModel):
    id: int
    name: str


class SubjectResponse(BaseModel):
    id: int
    name: str
    year: int
    allowed_turnos: Optional[List[int]] = None
    professors: List[ProfessorInSubject] = []


class SubjectTurnosUpdate(BaseModel):
    allowed_turnos: Optional[List[int]] = None
