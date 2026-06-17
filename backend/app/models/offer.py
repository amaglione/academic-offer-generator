from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON
from datetime import datetime
from app.database import Base


class Offer(Base):
    __tablename__ = "offers"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    semester = Column(String, nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="draft")  # draft | published


class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True)
    offer_id = Column(Integer, ForeignKey("offers.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    professor_id = Column(Integer, ForeignKey("professors.id"), nullable=False)
    time_slot = Column(JSON, nullable=False)
    expected_students = Column(Integer, nullable=False)
    manually_modified = Column(Boolean, default=False)
