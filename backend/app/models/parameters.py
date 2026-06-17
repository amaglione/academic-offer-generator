from sqlalchemy import Column, Integer, JSON, ForeignKey
from app.database import Base

DEFAULT_TURNOS = [
    {"id": 1, "name": "Turno mañana", "start_hour": 8, "end_hour": 12, "days": [0, 1, 2, 3, 4]},
    {"id": 2, "name": "Turno tarde", "start_hour": 14, "end_hour": 18, "days": [0, 1, 2, 3, 4]},
    {"id": 3, "name": "Turno noche", "start_hour": 19, "end_hour": 23, "days": [0, 1, 2, 3, 4]},
]

DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

DEFAULT_TIME_SLOTS = [
    {
        "id": i * 6 + j,
        "turno_id": turno["id"],
        "turno_name": turno["name"],
        "day": day,
        "day_name": DAY_NAMES[day],
        "start_hour": turno["start_hour"],
        "end_hour": turno["end_hour"],
        "duration_hours": turno["end_hour"] - turno["start_hour"],
    }
    for i, turno in enumerate(DEFAULT_TURNOS)
    for j, day in enumerate(turno["days"])
]


class GlobalParameters(Base):
    __tablename__ = "global_parameters"
    id = Column(Integer, primary_key=True, default=1)
    max_students_per_course = Column(Integer, default=40)
    max_weekly_hours_per_professor = Column(Integer, default=30)
    available_classrooms = Column(Integer, default=20)
    solver_timeout_seconds = Column(Integer, default=600)
    time_slots = Column(JSON, default=DEFAULT_TIME_SLOTS)
    turnos = Column(JSON, nullable=True)


class TenantParameters(Base):
    __tablename__ = "tenant_parameters"
    tenant_id = Column(Integer, ForeignKey("tenants.id"), primary_key=True)
    max_students_per_course = Column(Integer, nullable=True)
    max_weekly_hours_per_professor = Column(Integer, nullable=True)
    available_classrooms = Column(Integer, nullable=True)
    solver_timeout_seconds = Column(Integer, nullable=True)
    time_slots = Column(JSON, nullable=True)
    turnos = Column(JSON, nullable=True)
