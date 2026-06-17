from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON
from app.database import Base


class Career(Base):
    __tablename__ = "careers"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    name = Column(String, nullable=False)


class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    career_id = Column(Integer, ForeignKey("careers.id"), nullable=False)
    name = Column(String, nullable=False)
    year = Column(Integer, nullable=False)
    allowed_turnos = Column(JSON, nullable=True)


class Prerequisite(Base):
    __tablename__ = "prerequisites"
    subject_id = Column(Integer, ForeignKey("subjects.id"), primary_key=True)
    requires_subject_id = Column(Integer, ForeignKey("subjects.id"), primary_key=True)


class Professor(Base):
    __tablename__ = "professors"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    name = Column(String, nullable=False)


class ProfessorSubject(Base):
    __tablename__ = "professor_subjects"
    professor_id = Column(Integer, ForeignKey("professors.id"), primary_key=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), primary_key=True)


class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    career_id = Column(Integer, ForeignKey("careers.id"), nullable=False)


class AcademicHistory(Base):
    __tablename__ = "academic_history"
    student_id = Column(Integer, ForeignKey("students.id"), primary_key=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), primary_key=True)
    passed = Column(Boolean, nullable=False)
