from sqlalchemy import Column, Integer, JSON, ForeignKey
from app.database import Base

DEFAULT_TIME_SLOTS = [
    {
        "id": i * 7 + j,
        "day": j,
        "day_name": d,
        "start_hour": 8 + i * 2,
        "end_hour": 10 + i * 2,
        "duration_hours": 2,
    }
    for i in range(7)
    for j, d in enumerate(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"])
]


class GlobalParameters(Base):
    __tablename__ = "global_parameters"
    id = Column(Integer, primary_key=True, default=1)
    max_students_per_course = Column(Integer, default=40)
    max_weekly_hours_per_professor = Column(Integer, default=30)
    available_classrooms = Column(Integer, default=20)
    solver_timeout_seconds = Column(Integer, default=600)
    time_slots = Column(JSON, default=DEFAULT_TIME_SLOTS)


class TenantParameters(Base):
    __tablename__ = "tenant_parameters"
    tenant_id = Column(Integer, ForeignKey("tenants.id"), primary_key=True)
    max_students_per_course = Column(Integer, nullable=True)
    max_weekly_hours_per_professor = Column(Integer, nullable=True)
    available_classrooms = Column(Integer, nullable=True)
    solver_timeout_seconds = Column(Integer, nullable=True)
    time_slots = Column(JSON, nullable=True)
