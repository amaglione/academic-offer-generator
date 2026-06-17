"""
Populates DB with two university careers, ~500 students, ~40 professors.
Run: python -m seed.seed
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import itertools
import random

from passlib.context import CryptContext
from app.database import SessionLocal
from app.models import (
    Tenant, User, Career, Subject, Prerequisite,
    Professor, ProfessorSubject, Student, AcademicHistory,
    GlobalParameters, TenantParameters,
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

CAREERS = [
    {
        "name": "Ingeniería en Sistemas",
        "subjects": [
            (1, ["Análisis Matemático I", "Álgebra", "Física I", "Introducción a la Programación", "Química"]),
            (2, ["Análisis Matemático II", "Física II", "Programación I", "Arquitectura de Computadoras", "Probabilidad y Estadística"]),
            (3, ["Programación II", "Base de Datos", "Sistemas Operativos", "Redes", "Métodos Numéricos"]),
            (4, ["Ingeniería de Software", "Inteligencia Artificial", "Seguridad Informática", "Compiladores", "Electiva I"]),
            (5, ["Proyecto Final", "Electiva II", "Gestión de Proyectos", "Ética Profesional"]),
        ],
    },
    {
        "name": "Licenciatura en Administración",
        "subjects": [
            (1, ["Matemática Empresarial", "Contabilidad I", "Economía", "Derecho", "Estadística I"]),
            (2, ["Contabilidad II", "Administración I", "Estadística II", "Marketing", "Macroeconomía"]),
            (3, ["Administración II", "Finanzas", "Recursos Humanos", "Derecho Laboral", "Investigación Operativa"]),
            (4, ["Estrategia Empresarial", "Comercio Internacional", "Sistemas de Información", "Administración Pública", "Electiva I"]),
            (5, ["Proyecto Final", "Liderazgo", "Emprendedurismo", "Electiva II"]),
        ],
    },
]


def seed():
    db = SessionLocal()
    try:
        # Tenant
        tenant = Tenant(name="Universidad Demo", active=True)
        db.add(tenant)
        db.flush()

        # Admin user
        db.add(User(
            tenant_id=tenant.id,
            username="admin@demo.edu",
            hashed_password=pwd_context.hash("admin123"),
            active=True,
        ))

        # Global parameters
        db.add(GlobalParameters(id=1))

        # Careers and subjects
        all_subjects = {}  # (career_name, subject_name) -> Subject
        for career_data in CAREERS:
            career = Career(tenant_id=tenant.id, name=career_data["name"])
            db.add(career)
            db.flush()

            prev_year_subjects = []
            for year, subject_names in career_data["subjects"]:
                curr_year_subjects = []
                for name in subject_names:
                    subj = Subject(tenant_id=tenant.id, career_id=career.id, name=name, year=year)
                    db.add(subj)
                    db.flush()
                    all_subjects[(career_data["name"], name)] = subj
                    curr_year_subjects.append(subj)

                    # Prerequisites: each subject in year N requires at least 2 subjects from year N-1
                    for prereq in prev_year_subjects[:2]:
                        db.add(Prerequisite(subject_id=subj.id, requires_subject_id=prereq.id))

                prev_year_subjects = curr_year_subjects

        # Professors — 40 total, distributed across subjects
        subjects_list = list(all_subjects.values())
        professors = []
        first_names = ["Ana", "Carlos", "María", "Luis", "Laura", "Jorge", "Sofía", "Pablo",
                       "Elena", "Diego", "Valentina", "Martín", "Camila", "Federico", "Lucía",
                       "Rodrigo", "Natalia", "Andrés", "Florencia", "Sebastián"]
        last_names = ["García", "López", "Martínez", "Rodríguez", "González", "Pérez", "Sánchez",
                      "Romero", "Torres", "Díaz", "Ruiz", "Moreno", "Jiménez", "Álvarez", "Muñoz",
                      "Herrera", "Medina", "Castro", "Ortega", "Vargas"]

        name_pairs = list(itertools.product(first_names, last_names))[:40]
        for first, last in name_pairs:
            prof = Professor(tenant_id=tenant.id, name=f"{first} {last}")
            db.add(prof)
            db.flush()
            professors.append(prof)

        # Assign each subject to 2 professors, each subject gets 1-3 professors
        random.seed(42)
        for subj in subjects_list:
            assigned_profs = random.sample(professors, k=min(2, len(professors)))
            for prof in assigned_profs:
                db.merge(ProfessorSubject(professor_id=prof.id, subject_id=subj.id))

        # Students — 500 total, distributed across careers and years
        for career_data in CAREERS:
            career_obj = db.query(Career).filter_by(tenant_id=tenant.id, name=career_data["name"]).first()
            career_subjects = [s for s in subjects_list if s.career_id == career_obj.id]

            for year in range(1, 6):
                num_students = {1: 60, 2: 50, 3: 40, 4: 25, 5: 15}[year]
                year_subjects = [s for s in career_subjects if s.year == year]
                prev_subjects = [s for s in career_subjects if s.year < year]

                for _ in range(num_students):
                    student = Student(tenant_id=tenant.id, career_id=career_obj.id)
                    db.add(student)
                    db.flush()

                    # All previous years: passed most subjects
                    for subj in prev_subjects:
                        passed = random.random() > 0.1  # 90% pass rate
                        db.add(AcademicHistory(student_id=student.id, subject_id=subj.id, passed=passed))

                    # Current year: failed or not attempted (this is what creates demand)
                    for subj in year_subjects:
                        if random.random() < 0.15:  # 15% already passed (repeated subjects)
                            db.add(AcademicHistory(student_id=student.id, subject_id=subj.id, passed=True))

        db.commit()
        print("Seed complete.")
        print(f"  Tenant: {tenant.name} (id={tenant.id})")
        print(f"  User: admin@demo.edu / admin123")
        print(f"  Subjects: {len(subjects_list)}")
        print(f"  Professors: {len(professors)}")

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed()
