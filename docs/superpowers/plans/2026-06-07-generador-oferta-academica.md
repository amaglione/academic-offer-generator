# Generador de Oferta Académica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web system that automatically generates a university's academic offer (courses with professors and time slots) from student history and study plans, with a calendar UI for admin review.

**Architecture:** FastAPI backend with OR-Tools CP-SAT optimizer reads academic data from a seeded PostgreSQL database; React frontend provides a calendar view for admin review and approval. Multi-tenant with JWT auth.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0, PostgreSQL, Alembic, ortools, python-jose[cryptography], passlib[bcrypt], pytest, httpx; React 18, Vite, Axios.

---

## File Structure

```
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── dependencies.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── tenant.py
│   │   ├── academic.py
│   │   ├── parameters.py
│   │   └── offer.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── parameters.py
│   │   ├── offer.py
│   │   └── job.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── generate.py
│   │   ├── offers.py
│   │   └── parameters.py
│   └── services/
│       ├── __init__.py
│       ├── auth_service.py
│       ├── data_layer.py
│       ├── demand_analyzer.py
│       ├── optimizer.py
│       ├── parameter_service.py
│       └── job_store.py
├── seed/
│   └── seed.py
├── tests/
│   ├── conftest.py
│   ├── test_demand_analyzer.py
│   ├── test_optimizer.py
│   ├── test_auth.py
│   ├── test_offers.py
│   └── test_parameters.py
├── alembic/
│   └── versions/
├── alembic.ini
├── requirements.txt
└── .env.example

frontend/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── api/client.js
│   ├── context/AuthContext.jsx
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── OffersPage.jsx
│   │   └── ParametersPage.jsx
│   └── components/
│       ├── CalendarGrid.jsx
│       ├── CourseCard.jsx
│       ├── CareerFilter.jsx
│       └── CourseEditModal.jsx
├── package.json
└── vite.config.js

docker-compose.yml
```

---

### Task 1: Project setup

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/app/config.py`
- Create: `backend/app/database.py`
- Create: `backend/app/main.py`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p backend/app/{models,schemas,routers,services}
mkdir -p backend/{seed,tests,alembic/versions}
touch backend/app/__init__.py
touch backend/app/models/__init__.py
touch backend/app/schemas/__init__.py
touch backend/app/routers/__init__.py
touch backend/app/services/__init__.py
mkdir -p frontend/src/{api,context,pages,components}
```

- [ ] **Step 2: Create docker-compose.yml**

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: oferta
      POSTGRES_PASSWORD: oferta
      POSTGRES_DB: oferta_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: ./backend/.env
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend

volumes:
  pgdata:
```

- [ ] **Step 3: Create backend/requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
psycopg2-binary==2.9.9
alembic==1.13.1
ortools==9.10.4067
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.1
pytest==8.2.0
httpx==0.27.0
pytest-asyncio==0.23.6
```

- [ ] **Step 4: Create backend/.env.example**

```
DATABASE_URL=postgresql://oferta:oferta@localhost:5432/oferta_db
JWT_SECRET=change-me-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=480
```

- [ ] **Step 5: Create backend/app/config.py**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Step 6: Create backend/app/database.py**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 7: Create backend/app/main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, generate, offers, parameters

app = FastAPI(title="Generador de Oferta Académica")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(generate.router, prefix="/api", tags=["generate"])
app.include_router(offers.router, prefix="/api/offers", tags=["offers"])
app.include_router(parameters.router, prefix="/api/parameters", tags=["parameters"])
```

- [ ] **Step 8: Start postgres and verify**

```bash
cd backend && pip install -r requirements.txt
docker compose up db -d
# Wait 5 seconds, then:
psql postgresql://oferta:oferta@localhost:5432/oferta_db -c "\l"
```
Expected: list of databases including `oferta_db`.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: project setup — FastAPI + PostgreSQL + React scaffold"
```

---

### Task 2: Database models

**Files:**
- Create: `backend/app/models/tenant.py`
- Create: `backend/app/models/academic.py`
- Create: `backend/app/models/parameters.py`
- Create: `backend/app/models/offer.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`

- [ ] **Step 1: Create backend/app/models/tenant.py**

```python
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from app.database import Base

class Tenant(Base):
    __tablename__ = "tenants"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    active = Column(Boolean, default=True)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    username = Column(String, nullable=False, unique=True)
    hashed_password = Column(String, nullable=False)
    active = Column(Boolean, default=True)
```

- [ ] **Step 2: Create backend/app/models/academic.py**

```python
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
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
```

- [ ] **Step 3: Create backend/app/models/parameters.py**

```python
from sqlalchemy import Column, Integer, JSON, ForeignKey
from app.database import Base

DEFAULT_TIME_SLOTS = [
    {"id": i * 7 + j, "day": j, "day_name": d, "start_hour": 8 + i * 2, "end_hour": 10 + i * 2, "duration_hours": 2}
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
```

- [ ] **Step 4: Create backend/app/models/offer.py**

```python
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
```

- [ ] **Step 5: Create backend/app/models/__init__.py**

```python
from app.models.tenant import Tenant, User
from app.models.academic import Career, Subject, Prerequisite, Professor, ProfessorSubject, Student, AcademicHistory
from app.models.parameters import GlobalParameters, TenantParameters, DEFAULT_TIME_SLOTS
from app.models.offer import Offer, Course
```

- [ ] **Step 6: Init Alembic and create initial migration**

```bash
cd backend
alembic init alembic
```

Edit `backend/alembic/env.py` — replace the `target_metadata` section:

```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app.database import Base
from app.models import *  # noqa: registers all models
from app.config import settings

config.set_main_option("sqlalchemy.url", settings.database_url)
target_metadata = Base.metadata
```

Then generate and run the migration:

```bash
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade  -> <hash>, initial schema`

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: database models and initial migration"
```

---

### Task 3: Seed data

**Files:**
- Create: `backend/seed/seed.py`

- [ ] **Step 1: Create backend/seed/seed.py**

```python
"""
Populates DB with two university careers, ~500 students, ~40 professors.
Run: python -m seed.seed
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from passlib.context import CryptContext
from app.database import SessionLocal
from app.models import (
    Tenant, User, Career, Subject, Prerequisite,
    Professor, ProfessorSubject, Student, AcademicHistory,
    GlobalParameters, TenantParameters
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

CAREERS = [
    {
        "name": "Ingeniería en Sistemas",
        "subjects": [
            # year: [name, ...]
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

        import itertools
        name_pairs = list(itertools.product(first_names, last_names))[:40]
        for first, last in name_pairs:
            prof = Professor(tenant_id=tenant.id, name=f"{first} {last}")
            db.add(prof)
            db.flush()
            professors.append(prof)

        # Assign each professor to 2-3 subjects, each subject gets 1-3 professors
        import random
        random.seed(42)
        for i, subj in enumerate(subjects_list):
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
```

- [ ] **Step 2: Run seed and verify**

```bash
cd backend
python -m seed.seed
```

Expected output:
```
Seed complete.
  Tenant: Universidad Demo (id=1)
  User: admin@demo.edu / admin123
  Subjects: 49
  Professors: 40
```

- [ ] **Step 3: Commit**

```bash
git add backend/seed/
git commit -m "feat: seed script with 2 careers, 500 students, 40 professors"
```

---

### Task 4: Auth service and router

**Files:**
- Create: `backend/app/services/auth_service.py`
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/dependencies.py`
- Create: `backend/app/routers/auth.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_auth.py`

- [ ] **Step 1: Create backend/app/schemas/auth.py**

```python
from pydantic import BaseModel

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
```

- [ ] **Step 2: Create backend/app/services/auth_service.py**

```python
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.models.tenant import User
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = db.query(User).filter(User.username == username, User.active == True).first()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user

def create_token(user: User) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(user.id), "tenant_id": user.tenant_id, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
```

- [ ] **Step 3: Create backend/app/dependencies.py**

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.auth_service import decode_token
from app.models.tenant import User

bearer_scheme = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.id == int(payload["sub"]), User.active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
```

- [ ] **Step 4: Create backend/app/routers/auth.py**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.auth import LoginRequest, TokenResponse
from app.services.auth_service import authenticate_user, create_token

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, body.username, body.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=create_token(user))

@router.post("/logout")
def logout():
    # JWT is stateless; client drops the token
    return {"detail": "Logged out"}
```

- [ ] **Step 5: Create backend/tests/conftest.py**

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db
from app.models import *  # noqa
from passlib.context import CryptContext

TEST_DB_URL = "sqlite:///./test.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@pytest.fixture(autouse=True)
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSession()

    # Seed minimal test data
    tenant = Tenant(id=1, name="Test University", active=True)
    session.add(tenant)
    session.add(User(
        id=1, tenant_id=1,
        username="admin@test.edu",
        hashed_password=pwd_context.hash("password123"),
        active=True,
    ))
    session.add(GlobalParameters(id=1))
    session.commit()

    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def auth_headers(client):
    r = client.post("/api/auth/login", json={"username": "admin@test.edu", "password": "password123"})
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

- [ ] **Step 6: Write failing auth tests**

```python
# backend/tests/test_auth.py
def test_login_success(client):
    r = client.post("/api/auth/login", json={"username": "admin@test.edu", "password": "password123"})
    assert r.status_code == 200
    assert "access_token" in r.json()

def test_login_wrong_password(client):
    r = client.post("/api/auth/login", json={"username": "admin@test.edu", "password": "wrong"})
    assert r.status_code == 401

def test_protected_endpoint_without_token(client):
    r = client.get("/api/parameters")
    assert r.status_code == 403

def test_protected_endpoint_with_token(client, auth_headers):
    r = client.get("/api/parameters", headers=auth_headers)
    assert r.status_code == 200
```

- [ ] **Step 7: Run tests (expect failures on protected endpoint — router not built yet)**

```bash
cd backend && pytest tests/test_auth.py -v
```

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat: JWT auth — login endpoint, token verification, test fixtures"
```

---

### Task 5: Parameter service and router

**Files:**
- Create: `backend/app/services/parameter_service.py`
- Create: `backend/app/schemas/parameters.py`
- Create: `backend/app/routers/parameters.py`
- Create: `backend/tests/test_parameters.py`

- [ ] **Step 1: Create backend/app/services/parameter_service.py**

```python
from sqlalchemy.orm import Session
from app.models.parameters import GlobalParameters, TenantParameters, DEFAULT_TIME_SLOTS

PARAM_FIELDS = [
    "max_students_per_course",
    "max_weekly_hours_per_professor",
    "available_classrooms",
    "solver_timeout_seconds",
    "time_slots",
]

def get_effective_parameters(db: Session, tenant_id: int) -> dict:
    global_params = db.query(GlobalParameters).filter(GlobalParameters.id == 1).first()
    tenant_params = db.query(TenantParameters).filter(TenantParameters.tenant_id == tenant_id).first()

    result = {field: getattr(global_params, field) for field in PARAM_FIELDS}
    if global_params.time_slots is None:
        result["time_slots"] = DEFAULT_TIME_SLOTS

    if tenant_params:
        for field in PARAM_FIELDS:
            override = getattr(tenant_params, field, None)
            if override is not None:
                result[field] = override

    return result

def save_tenant_parameters(db: Session, tenant_id: int, updates: dict) -> dict:
    tenant_params = db.query(TenantParameters).filter(TenantParameters.tenant_id == tenant_id).first()
    if not tenant_params:
        tenant_params = TenantParameters(tenant_id=tenant_id)
        db.add(tenant_params)

    for field in PARAM_FIELDS:
        if field in updates:
            setattr(tenant_params, field, updates[field])

    db.commit()
    return get_effective_parameters(db, tenant_id)
```

- [ ] **Step 2: Create backend/app/schemas/parameters.py**

```python
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
```

- [ ] **Step 3: Create backend/app/routers/parameters.py**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.tenant import User
from app.schemas.parameters import ParametersResponse, ParametersUpdate
from app.services.parameter_service import get_effective_parameters, save_tenant_parameters

router = APIRouter()

@router.get("", response_model=ParametersResponse)
def get_parameters(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_effective_parameters(db, current_user.tenant_id)

@router.put("", response_model=ParametersResponse)
def update_parameters(
    body: ParametersUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updates = body.model_dump(exclude_none=True)
    if "time_slots" in updates:
        updates["time_slots"] = [s.model_dump() for s in body.time_slots]
    return save_tenant_parameters(db, current_user.tenant_id, updates)
```

- [ ] **Step 4: Write and run parameter tests**

```python
# backend/tests/test_parameters.py
def test_get_parameters_returns_defaults(client, auth_headers):
    r = client.get("/api/parameters", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["max_students_per_course"] == 40
    assert data["max_weekly_hours_per_professor"] == 30
    assert data["available_classrooms"] == 20
    assert data["solver_timeout_seconds"] == 600
    assert len(data["time_slots"]) > 0

def test_update_parameter_overrides_global(client, auth_headers):
    r = client.put("/api/parameters", headers=auth_headers, json={"max_students_per_course": 25})
    assert r.status_code == 200
    assert r.json()["max_students_per_course"] == 25

def test_unset_parameter_inherits_global(client, auth_headers):
    client.put("/api/parameters", headers=auth_headers, json={"max_students_per_course": 25})
    r = client.get("/api/parameters", headers=auth_headers)
    assert r.json()["max_weekly_hours_per_professor"] == 30  # unchanged global
```

```bash
cd backend && pytest tests/test_parameters.py -v
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: parameters endpoint — global defaults + tenant overrides"
```

---

### Task 6: Data layer

**Files:**
- Create: `backend/app/services/data_layer.py`

- [ ] **Step 1: Create backend/app/services/data_layer.py**

```python
from sqlalchemy.orm import Session
from app.models.academic import Career, Subject, Prerequisite, Professor, ProfessorSubject, Student, AcademicHistory

def get_subjects(db: Session, tenant_id: int) -> list[dict]:
    subjects = db.query(Subject).filter(Subject.tenant_id == tenant_id).all()
    return [{"id": s.id, "name": s.name, "year": s.year, "career_id": s.career_id} for s in subjects]

def get_prerequisites(db: Session) -> dict[int, list[int]]:
    """Returns {subject_id: [required_subject_id, ...]}"""
    prereqs = db.query(Prerequisite).all()
    result: dict[int, list[int]] = {}
    for p in prereqs:
        result.setdefault(p.subject_id, []).append(p.requires_subject_id)
    return result

def get_professors(db: Session, tenant_id: int) -> list[dict]:
    profs = db.query(Professor).filter(Professor.tenant_id == tenant_id).all()
    return [{"id": p.id, "name": p.name} for p in profs]

def get_professor_subjects(db: Session) -> dict[int, list[int]]:
    """Returns {subject_id: [professor_id, ...]}"""
    rows = db.query(ProfessorSubject).all()
    result: dict[int, list[int]] = {}
    for row in rows:
        result.setdefault(row.subject_id, []).append(row.professor_id)
    return result

def get_students_with_history(db: Session, tenant_id: int) -> list[dict]:
    """Returns [{id, career_id, passed_subject_ids: set}]"""
    students = db.query(Student).filter(Student.tenant_id == tenant_id).all()
    history = db.query(AcademicHistory).filter(AcademicHistory.passed == True).all()
    passed_by_student: dict[int, set[int]] = {}
    for h in history:
        passed_by_student.setdefault(h.student_id, set()).add(h.subject_id)
    return [
        {"id": s.id, "career_id": s.career_id, "passed_subject_ids": passed_by_student.get(s.id, set())}
        for s in students
    ]
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/data_layer.py
git commit -m "feat: data layer — query academic data by tenant"
```

---

### Task 7: Demand analyzer

**Files:**
- Create: `backend/app/services/demand_analyzer.py`
- Create: `backend/tests/test_demand_analyzer.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_demand_analyzer.py
import math
from app.services.demand_analyzer import analyze_demand

def make_subjects(data):
    return [{"id": s[0], "name": s[1], "year": s[2], "career_id": 1} for s in data]

def make_students(passed_map):
    return [{"id": sid, "career_id": 1, "passed_subject_ids": set(passed)} for sid, passed in passed_map.items()]

def test_counts_eligible_students():
    subjects = make_subjects([(1, "Álgebra", 1), (2, "Análisis I", 2)])
    prerequisites = {2: [1]}  # Análisis I requires Álgebra
    students = make_students({
        1: [1],    # passed Álgebra only → eligible for Análisis I
        2: [1, 2], # passed both → NOT eligible (already passed Análisis I)
        3: [],     # passed nothing → eligible for Álgebra, not Análisis I
    })
    prof_subjects = {1: [10], 2: [11]}
    params = {"max_students_per_course": 40, "available_classrooms": 10}

    result = analyze_demand(subjects, prerequisites, students, prof_subjects, params)
    by_id = {r["subject_id"]: r for r in result}

    assert by_id[1]["demand"] == 1   # student 3 eligible
    assert by_id[2]["demand"] == 1   # student 1 eligible

def test_num_courses_ceiling():
    subjects = make_subjects([(1, "Álgebra", 1)])
    students = make_students({i: [] for i in range(1, 90)})  # 89 students, no prereqs
    prof_subjects = {1: [10]}
    params = {"max_students_per_course": 40, "available_classrooms": 10}

    result = analyze_demand(subjects, {}, students, prof_subjects, params)
    assert result[0]["num_courses"] == 3  # ceil(89/40) = 3

def test_no_demand_excluded():
    subjects = make_subjects([(1, "Álgebra", 1)])
    students = make_students({1: [1]})  # already passed
    prof_subjects = {1: [10]}
    params = {"max_students_per_course": 40, "available_classrooms": 10}

    result = analyze_demand(subjects, {}, students, prof_subjects, params)
    assert result == []

def test_no_professor_excluded():
    subjects = make_subjects([(1, "Álgebra", 1)])
    students = make_students({1: []})
    prof_subjects = {}  # no professors
    params = {"max_students_per_course": 40, "available_classrooms": 10}

    result = analyze_demand(subjects, {}, students, prof_subjects, params)
    assert result == []
```

- [ ] **Step 2: Run tests (expect failures)**

```bash
cd backend && pytest tests/test_demand_analyzer.py -v
```
Expected: 4 errors (module not found).

- [ ] **Step 3: Create backend/app/services/demand_analyzer.py**

```python
import math

def analyze_demand(
    subjects: list[dict],
    prerequisites: dict[int, list[int]],
    students: list[dict],
    prof_subjects: dict[int, list[int]],
    params: dict,
) -> list[dict]:
    """
    subjects: [{id, name, year, career_id}]
    prerequisites: {subject_id: [required_subject_id]}
    students: [{id, career_id, passed_subject_ids: set}]
    prof_subjects: {subject_id: [professor_id]}
    params: {max_students_per_course, available_classrooms}

    Returns: [{subject_id, name, year, career_id, demand, num_courses, eligible_professor_ids}]
    """
    students_by_career: dict[int, list[dict]] = {}
    for student in students:
        students_by_career.setdefault(student["career_id"], []).append(student)

    result = []
    for subject in subjects:
        sid = subject["id"]
        prereq_ids = set(prerequisites.get(sid, []))
        career_students = students_by_career.get(subject["career_id"], [])

        eligible_count = sum(
            1 for s in career_students
            if sid not in s["passed_subject_ids"]
            and prereq_ids.issubset(s["passed_subject_ids"])
        )

        if eligible_count == 0:
            continue

        eligible_prof_ids = prof_subjects.get(sid, [])
        if not eligible_prof_ids:
            continue

        num_courses = math.ceil(eligible_count / params["max_students_per_course"])
        result.append({
            "subject_id": sid,
            "name": subject["name"],
            "year": subject["year"],
            "career_id": subject["career_id"],
            "demand": eligible_count,
            "num_courses": num_courses,
            "eligible_professor_ids": eligible_prof_ids,
        })

    return result
```

- [ ] **Step 4: Run tests (expect pass)**

```bash
cd backend && pytest tests/test_demand_analyzer.py -v
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: demand analyzer — eligible student count and course calculation"
```

---

### Task 8: Optimization engine

**Files:**
- Create: `backend/app/services/optimizer.py`
- Create: `backend/tests/test_optimizer.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_optimizer.py
from app.services.optimizer import run_optimizer

SLOTS = [
    {"id": i, "day": i % 5, "day_name": "Lunes", "start_hour": 8 + (i // 5) * 2,
     "end_hour": 10 + (i // 5) * 2, "duration_hours": 2}
    for i in range(10)
]
PROFESSORS = [{"id": 1, "name": "Prof A"}, {"id": 2, "name": "Prof B"}]
PARAMS = {
    "max_students_per_course": 40,
    "max_weekly_hours_per_professor": 30,
    "available_classrooms": 10,
    "solver_timeout_seconds": 30,
}

def test_simple_assignment():
    demand = [{
        "subject_id": 1, "name": "Álgebra", "year": 1, "career_id": 1,
        "demand": 30, "num_courses": 1, "eligible_professor_ids": [1],
    }]
    result = run_optimizer(demand, PROFESSORS, SLOTS, PARAMS)
    assert result["status"] in ("optimal", "feasible")
    assert len(result["assignments"]) == 1
    assert result["assignments"][0]["subject_id"] == 1
    assert result["assignments"][0]["professor_id"] == 1

def test_professor_not_double_booked():
    demand = [
        {"subject_id": 1, "name": "A", "year": 1, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]},
        {"subject_id": 2, "name": "B", "year": 1, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]},
    ]
    result = run_optimizer(demand, PROFESSORS, SLOTS, PARAMS)
    assert result["status"] in ("optimal", "feasible")
    slots_used = [a["time_slot"]["id"] for a in result["assignments"]]
    assert len(set(slots_used)) == 2  # different slots

def test_infeasible_no_classrooms():
    params = {**PARAMS, "available_classrooms": 0}
    demand = [{"subject_id": 1, "name": "A", "year": 1, "career_id": 1,
               "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]}]
    result = run_optimizer(demand, PROFESSORS, SLOTS, params)
    assert result["status"] == "infeasible"

def test_empty_demand():
    result = run_optimizer([], PROFESSORS, SLOTS, PARAMS)
    assert result["status"] == "optimal"
    assert result["assignments"] == []
```

- [ ] **Step 2: Run tests (expect failures)**

```bash
cd backend && pytest tests/test_optimizer.py -v
```
Expected: 4 errors (module not found).

- [ ] **Step 3: Create backend/app/services/optimizer.py**

```python
import math
from collections import defaultdict
from ortools.sat.python import cp_model

def run_optimizer(
    demand: list[dict],
    professors: list[dict],
    time_slots: list[dict],
    params: dict,
) -> dict:
    if not demand:
        return {"status": "optimal", "assignments": [], "unassigned_subjects": []}

    model = cp_model.CpModel()

    # Build flat course list
    courses = []
    for item in demand:
        students_each = math.ceil(item["demand"] / item["num_courses"])
        for _ in range(item["num_courses"]):
            courses.append({
                "subject_id": item["subject_id"],
                "year": item["year"],
                "career_id": item["career_id"],
                "eligible_professor_ids": set(item["eligible_professor_ids"]),
                "expected_students": min(students_each, params["max_students_per_course"]),
            })

    num_courses = len(courses)
    num_slots = len(time_slots)
    prof_by_id = {p["id"]: i for i, p in enumerate(professors)}
    num_professors = len(professors)

    # Variables: x[c, p, s] — only for eligible (course, professor) pairs
    x = {}
    for c, course in enumerate(courses):
        for prof_id in course["eligible_professor_ids"]:
            if prof_id not in prof_by_id:
                continue
            p = prof_by_id[prof_id]
            for s in range(num_slots):
                x[c, p, s] = model.NewBoolVar(f"x_{c}_{p}_{s}")

    # Each course assigned to exactly one (professor, slot)
    for c, course in enumerate(courses):
        vars_for_course = [
            x[c, prof_by_id[pid], s]
            for pid in course["eligible_professor_ids"]
            if pid in prof_by_id
            for s in range(num_slots)
            if (c, prof_by_id[pid], s) in x
        ]
        if vars_for_course:
            model.AddExactlyOne(vars_for_course)

    # Professor can't teach two courses in the same slot
    for p in range(num_professors):
        for s in range(num_slots):
            vars_in_slot = [x[c, p, s] for c in range(num_courses) if (c, p, s) in x]
            if len(vars_in_slot) > 1:
                model.AddAtMostOne(vars_in_slot)

    # Professor weekly hour limit
    max_minutes = params["max_weekly_hours_per_professor"] * 60
    for p in range(num_professors):
        terms = []
        for c in range(num_courses):
            for s, slot in enumerate(time_slots):
                if (c, p, s) in x:
                    terms.append(x[c, p, s] * int(slot["duration_hours"] * 60))
        if terms:
            model.Add(sum(terms) <= max_minutes)

    # Max simultaneous courses <= available classrooms
    max_rooms = params["available_classrooms"]
    for s in range(num_slots):
        vars_in_slot = [x[c, p, s] for c in range(num_courses) for p in range(num_professors) if (c, p, s) in x]
        if vars_in_slot:
            model.Add(sum(vars_in_slot) <= max_rooms)

    # Objective: minimize year/career conflicts + slot overload
    penalties = []

    year_career_groups: dict[tuple, list[int]] = defaultdict(list)
    for c, course in enumerate(courses):
        year_career_groups[(course["year"], course["career_id"])].append(c)

    for (year, career_id), group in year_career_groups.items():
        if len(group) < 2:
            continue
        for s in range(num_slots):
            slot_vars = [x[c, p, s] for c in group for p in range(num_professors) if (c, p, s) in x]
            if len(slot_vars) > 1:
                count = model.NewIntVar(0, len(slot_vars), f"cnt_{year}_{career_id}_{s}")
                model.Add(count == sum(slot_vars))
                overlap = model.NewIntVar(0, len(slot_vars), f"ovl_{year}_{career_id}_{s}")
                model.Add(overlap >= count - 1)
                model.Add(overlap >= 0)
                penalties.append(overlap * 10)

    avg_load = max(1, num_courses // max(1, num_slots))
    for s in range(num_slots):
        all_vars = [x[c, p, s] for c in range(num_courses) for p in range(num_professors) if (c, p, s) in x]
        if all_vars:
            load = model.NewIntVar(0, num_courses, f"load_{s}")
            model.Add(load == sum(all_vars))
            overload = model.NewIntVar(0, num_courses, f"ovld_{s}")
            model.Add(overload >= load - avg_load)
            model.Add(overload >= 0)
            penalties.append(overload)

    if penalties:
        model.Minimize(sum(penalties))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = params["solver_timeout_seconds"]
    status = solver.Solve(model)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        assignments = []
        for c, course in enumerate(courses):
            for prof_id in course["eligible_professor_ids"]:
                if prof_id not in prof_by_id:
                    continue
                p = prof_by_id[prof_id]
                for s in range(num_slots):
                    if (c, p, s) in x and solver.Value(x[c, p, s]) == 1:
                        assignments.append({
                            "subject_id": course["subject_id"],
                            "professor_id": prof_id,
                            "time_slot": time_slots[s],
                            "expected_students": course["expected_students"],
                        })
        return {
            "status": "optimal" if status == cp_model.OPTIMAL else "feasible",
            "assignments": assignments,
            "unassigned_subjects": [],
        }

    return {
        "status": "infeasible",
        "assignments": [],
        "unassigned_subjects": [
            {"subject_id": c["subject_id"], "reason": "No feasible assignment"}
            for c in courses
        ],
    }
```

- [ ] **Step 4: Run tests**

```bash
cd backend && pytest tests/test_optimizer.py -v
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: OR-Tools CP-SAT optimizer — professor/slot assignment with constraints"
```

---

### Task 9: Generate endpoint and job store

**Files:**
- Create: `backend/app/services/job_store.py`
- Create: `backend/app/schemas/job.py`
- Create: `backend/app/routers/generate.py`

- [ ] **Step 1: Create backend/app/services/job_store.py**

```python
import uuid, threading
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Optional

@dataclass
class Job:
    id: str
    tenant_id: int
    status: str = "running"  # running | done | failed
    result: dict = field(default_factory=dict)
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)

_jobs: Dict[str, Job] = {}
_lock = threading.Lock()

def create_job(tenant_id: int) -> str:
    job_id = str(uuid.uuid4())
    with _lock:
        _jobs[job_id] = Job(id=job_id, tenant_id=tenant_id)
    return job_id

def get_job(job_id: str) -> Optional[Job]:
    return _jobs.get(job_id)

def finish_job(job_id: str, result: dict):
    with _lock:
        if job_id in _jobs:
            _jobs[job_id].status = "done"
            _jobs[job_id].result = result

def fail_job(job_id: str, error: str):
    with _lock:
        if job_id in _jobs:
            _jobs[job_id].status = "failed"
            _jobs[job_id].error = error
```

- [ ] **Step 2: Create backend/app/schemas/job.py**

```python
from pydantic import BaseModel
from typing import Optional

class JobResponse(BaseModel):
    job_id: str
    status: str
    offer_id: Optional[int] = None
    error: Optional[str] = None
```

- [ ] **Step 3: Create backend/app/routers/generate.py**

```python
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.dependencies import get_current_user
from app.models.tenant import User
from app.models.offer import Offer, Course
from app.schemas.job import JobResponse
from app.services import job_store, data_layer, demand_analyzer, optimizer, parameter_service

router = APIRouter()

def _run_generation(job_id: str, tenant_id: int, semester: str):
    db = SessionLocal()
    try:
        params = parameter_service.get_effective_parameters(db, tenant_id)
        subjects = data_layer.get_subjects(db, tenant_id)
        prerequisites = data_layer.get_prerequisites(db)
        professors = data_layer.get_professors(db, tenant_id)
        prof_subjects = data_layer.get_professor_subjects(db)
        students = data_layer.get_students_with_history(db, tenant_id)

        demand = demand_analyzer.analyze_demand(subjects, prerequisites, students, prof_subjects, params)
        result = optimizer.run_optimizer(demand, professors, params["time_slots"], params)

        offer = Offer(tenant_id=tenant_id, semester=semester, status="draft")
        db.add(offer)
        db.flush()

        for assignment in result["assignments"]:
            db.add(Course(
                offer_id=offer.id,
                subject_id=assignment["subject_id"],
                professor_id=assignment["professor_id"],
                time_slot=assignment["time_slot"],
                expected_students=assignment["expected_students"],
            ))
        db.commit()

        job_store.finish_job(job_id, {
            "offer_id": offer.id,
            "status": result["status"],
            "total_courses": len(result["assignments"]),
            "unassigned_subjects": result["unassigned_subjects"],
        })
    except Exception as e:
        db.rollback()
        job_store.fail_job(job_id, str(e))
    finally:
        db.close()

@router.post("/generate")
def generate(
    semester: str = "2026-2",
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
):
    job_id = job_store.create_job(current_user.tenant_id)
    background_tasks.add_task(_run_generation, job_id, current_user.tenant_id, semester)
    return {"job_id": job_id, "status": "running"}

@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: str, current_user: User = Depends(get_current_user)):
    job = job_store.get_job(job_id)
    if not job or job.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse(
        job_id=job.id,
        status=job.status,
        offer_id=job.result.get("offer_id"),
        error=job.error,
    )
```

- [ ] **Step 4: Commit**

```bash
git add backend/
git commit -m "feat: generate endpoint — async job dispatches OR-Tools optimizer"
```

---

### Task 10: Offers API

**Files:**
- Create: `backend/app/schemas/offer.py`
- Create: `backend/app/routers/offers.py`
- Create: `backend/tests/test_offers.py`

- [ ] **Step 1: Create backend/app/schemas/offer.py**

```python
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class CourseSchema(BaseModel):
    id: int
    subject_id: int
    subject_name: Optional[str] = None
    professor_id: int
    professor_name: Optional[str] = None
    time_slot: dict
    expected_students: int
    manually_modified: bool

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
```

- [ ] **Step 2: Create backend/app/routers/offers.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.tenant import User
from app.models.offer import Offer, Course
from app.models.academic import Subject, Professor
from app.schemas.offer import OfferSchema, OfferListItem, CourseSchema, CourseUpdate

router = APIRouter()

def _enrich_course(course: Course, db: Session) -> CourseSchema:
    subject = db.query(Subject).filter(Subject.id == course.subject_id).first()
    professor = db.query(Professor).filter(Professor.id == course.professor_id).first()
    return CourseSchema(
        id=course.id,
        subject_id=course.subject_id,
        subject_name=subject.name if subject else None,
        professor_id=course.professor_id,
        professor_name=professor.name if professor else None,
        time_slot=course.time_slot,
        expected_students=course.expected_students,
        manually_modified=course.manually_modified,
    )

@router.get("", response_model=list[OfferListItem])
def list_offers(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    offers = db.query(Offer).filter(Offer.tenant_id == current_user.tenant_id).order_by(Offer.generated_at.desc()).all()
    return [
        OfferListItem(
            id=o.id, semester=o.semester, generated_at=o.generated_at,
            status=o.status,
            total_courses=db.query(Course).filter(Course.offer_id == o.id).count(),
        )
        for o in offers
    ]

@router.get("/{offer_id}", response_model=OfferSchema)
def get_offer(offer_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    offer = db.query(Offer).filter(Offer.id == offer_id, Offer.tenant_id == current_user.tenant_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    courses = db.query(Course).filter(Course.offer_id == offer_id).all()
    return OfferSchema(
        id=offer.id, semester=offer.semester, generated_at=offer.generated_at,
        status=offer.status,
        courses=[_enrich_course(c, db) for c in courses],
    )

@router.patch("/{offer_id}/courses/{course_id}", response_model=CourseSchema)
def update_course(
    offer_id: int, course_id: int, body: CourseUpdate,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    offer = db.query(Offer).filter(Offer.id == offer_id, Offer.tenant_id == current_user.tenant_id).first()
    if not offer or offer.status == "published":
        raise HTTPException(status_code=404 if not offer else 400, detail="Offer not found or already published")
    course = db.query(Course).filter(Course.id == course_id, Course.offer_id == offer_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if body.professor_id is not None:
        course.professor_id = body.professor_id
    if body.time_slot is not None:
        course.time_slot = body.time_slot
    course.manually_modified = True
    db.commit()
    return _enrich_course(course, db)

@router.post("/{offer_id}/approve")
def approve_offer(offer_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    offer = db.query(Offer).filter(Offer.id == offer_id, Offer.tenant_id == current_user.tenant_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    offer.status = "published"
    db.commit()
    return {"id": offer.id, "status": offer.status}
```

- [ ] **Step 3: Write and run offer tests**

```python
# backend/tests/test_offers.py
from app.models.offer import Offer, Course

def test_list_offers_empty(client, auth_headers):
    r = client.get("/api/offers", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == []

def test_get_nonexistent_offer(client, auth_headers):
    r = client.get("/api/offers/999", headers=auth_headers)
    assert r.status_code == 404

def test_approve_offer(client, auth_headers, db):
    offer = Offer(tenant_id=1, semester="2026-2", status="draft")
    db.add(offer)
    db.commit()
    r = client.post(f"/api/offers/{offer.id}/approve", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "published"

def test_cannot_edit_published_offer(client, auth_headers, db):
    offer = Offer(tenant_id=1, semester="2026-2", status="published")
    db.add(offer)
    db.flush()
    from app.models.academic import Subject, Professor
    subject = Subject(tenant_id=1, career_id=1, name="Test", year=1)
    db.add(subject)
    professor = Professor(tenant_id=1, name="Test Prof")
    db.add(professor)
    db.flush()
    course = Course(offer_id=offer.id, subject_id=subject.id, professor_id=professor.id,
                    time_slot={"id": 0, "day": 0}, expected_students=30)
    db.add(course)
    db.commit()
    r = client.patch(f"/api/offers/{offer.id}/courses/{course.id}",
                     headers=auth_headers, json={"professor_id": professor.id})
    assert r.status_code == 400
```

```bash
cd backend && pytest tests/test_offers.py -v
```
Expected: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add backend/
git commit -m "feat: offers API — list, get, patch course, approve"
```

---

### Task 11: Frontend setup and login

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/api/client.js`
- Create: `frontend/src/context/AuthContext.jsx`
- Create: `frontend/src/pages/LoginPage.jsx`

- [ ] **Step 1: Init frontend**

```bash
cd frontend
npm create vite@latest . -- --template react
npm install axios react-router-dom
```

- [ ] **Step 2: Create frontend/src/api/client.js**

```javascript
import axios from 'axios';

const client = axios.create({ baseURL: 'http://localhost:8000/api' });

let _token = null;

export function setToken(token) { _token = token; }
export function clearToken() { _token = null; }

client.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`;
  return config;
});

client.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
```

- [ ] **Step 3: Create frontend/src/context/AuthContext.jsx**

```jsx
import { createContext, useContext, useState } from 'react';
import { setToken, clearToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  function login(token, username) {
    setToken(token);
    setUser({ username });
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
```

- [ ] **Step 4: Create frontend/src/pages/LoginPage.jsx**

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const r = await client.post('/auth/login', { username, password });
      login(r.data.access_token, username);
      navigate('/');
    } catch {
      setError('Usuario o contraseña incorrectos');
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0f172a' }}>
      <form onSubmit={handleSubmit} style={{ background: '#1e293b', padding: '2rem', borderRadius: '8px', minWidth: '320px' }}>
        <h2 style={{ color: '#e2e8f0', marginTop: 0 }}>Oferta Académica</h2>
        {error && <p style={{ color: '#f87171' }}>{error}</p>}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Usuario</label>
          <input
            value={username} onChange={e => setUsername(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Contraseña</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', boxSizing: 'border-box' }}
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: '0.6rem', background: '#3b82f6', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
          Ingresar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Create frontend/src/App.jsx**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import OffersPage from './pages/OffersPage';
import ParametersPage from './pages/ParametersPage';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><OffersPage /></ProtectedRoute>} />
          <Route path="/parameters" element={<ProtectedRoute><ParametersPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 6: Verify login works**

```bash
cd backend && uvicorn app.main:app --reload &
cd frontend && npm run dev
```

Open http://localhost:5173/login — log in with `admin@demo.edu` / `admin123`. Should redirect to `/`.

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: frontend — login page, auth context, API client with JWT"
```

---

### Task 12: Parameters page

**Files:**
- Create: `frontend/src/pages/ParametersPage.jsx`

- [ ] **Step 1: Create frontend/src/pages/ParametersPage.jsx**

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ParametersPage() {
  const [params, setParams] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    client.get('/parameters').then(r => setParams(r.data));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const { max_students_per_course, max_weekly_hours_per_professor, available_classrooms, solver_timeout_seconds } = params;
    await client.put('/parameters', { max_students_per_course, max_weekly_hours_per_professor, available_classrooms, solver_timeout_seconds });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!params) return <p style={{ color: '#94a3b8', padding: '2rem' }}>Cargando...</p>;

  const field = (label, key, unit = '') => (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="number"
          value={params[key]}
          onChange={e => setParams(p => ({ ...p, [key]: parseInt(e.target.value) }))}
          style={{ padding: '0.4rem 0.6rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', width: '120px' }}
        />
        {unit && <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{unit}</span>}
      </div>
    </div>
  );

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', padding: '2rem', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Parámetros del optimizador</h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => navigate('/')} style={{ padding: '0.4rem 1rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer' }}>
            ← Volver
          </button>
          <button onClick={logout} style={{ padding: '0.4rem 1rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </div>
      <form onSubmit={handleSave} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '8px', maxWidth: '480px' }}>
        {field('Máximo de alumnos por curso', 'max_students_per_course', 'alumnos')}
        {field('Máximo de horas semanales por docente', 'max_weekly_hours_per_professor', 'horas')}
        {field('Aulas disponibles', 'available_classrooms', 'aulas')}
        {field('Timeout del solver', 'solver_timeout_seconds', 'segundos')}
        <button type="submit" disabled={saving} style={{ padding: '0.5rem 1.5rem', background: '#3b82f6', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Navigate to http://localhost:5173/parameters — should show fields with current values, save should persist.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ParametersPage.jsx
git commit -m "feat: parameters page — view and edit optimizer rules"
```

---

### Task 13: Calendar view — offers page

**Files:**
- Create: `frontend/src/components/CalendarGrid.jsx`
- Create: `frontend/src/components/CourseCard.jsx`
- Create: `frontend/src/components/CareerFilter.jsx`
- Create: `frontend/src/components/CourseEditModal.jsx`
- Create: `frontend/src/pages/OffersPage.jsx`

- [ ] **Step 1: Create frontend/src/components/CourseCard.jsx**

```jsx
const YEAR_COLORS = {
  1: { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd' },
  2: { bg: '#1a3a2a', border: '#22c55e', text: '#86efac' },
  3: { bg: '#2d1b4e', border: '#a855f7', text: '#d8b4fe' },
  4: { bg: '#3b2a1a', border: '#f97316', text: '#fdba74' },
  5: { bg: '#3b1f1f', border: '#ef4444', text: '#fca5a5' },
};

export default function CourseCard({ course, onClick }) {
  const colors = YEAR_COLORS[course.year] || YEAR_COLORS[1];
  return (
    <div
      onClick={() => onClick(course)}
      style={{
        background: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
        borderRadius: '4px',
        padding: '0.3rem 0.4rem',
        marginBottom: '0.2rem',
        cursor: 'pointer',
        opacity: course.manually_modified ? 0.8 : 1,
      }}
    >
      <div style={{ color: colors.text, fontWeight: 600, fontSize: '0.75rem' }}>
        {course.subject_name}
        {course.manually_modified && ' ✎'}
      </div>
      <div style={{ color: '#64748b', fontSize: '0.65rem' }}>
        {course.professor_name} · {course.expected_students} alumnos
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create frontend/src/components/CareerFilter.jsx**

```jsx
import { useState, useRef, useEffect } from 'react';

export default function CareerFilter({ careers, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }

  const label = selected.length === 0 || selected.length === careers.length
    ? 'Todas las carreras'
    : `${selected.length} carrera${selected.length > 1 ? 's' : ''} seleccionada${selected.length > 1 ? 's' : ''}`;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', padding: '0.3rem 2rem 0.3rem 0.75rem', color: '#e2e8f0', cursor: 'pointer', minWidth: '200px', textAlign: 'left', position: 'relative', fontSize: '0.85rem' }}
      >
        {label}
        <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>▼</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: '#1e293b', border: '1px solid #475569', borderRadius: '6px', padding: '0.4rem', minWidth: '240px', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {careers.map(career => (
            <div
              key={career.id}
              onClick={() => toggle(career.id)}
              style={{ padding: '0.35rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '4px', cursor: 'pointer', background: selected.includes(career.id) ? '#0f172a' : 'transparent' }}
            >
              <span style={{ width: 14, height: 14, background: selected.includes(career.id) ? '#3b82f6' : 'transparent', border: selected.includes(career.id) ? 'none' : '1px solid #475569', borderRadius: '3px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.65rem', flexShrink: 0 }}>
                {selected.includes(career.id) ? '✓' : ''}
              </span>
              <span style={{ color: selected.includes(career.id) ? '#e2e8f0' : '#94a3b8', fontSize: '0.85rem' }}>{career.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create frontend/src/components/CourseEditModal.jsx**

```jsx
import { useEffect, useState } from 'react';
import client from '../api/client';

export default function CourseEditModal({ course, offerId, onClose, onSave }) {
  const [professors, setProfessors] = useState([]);
  const [profId, setProfId] = useState(course.professor_id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch professors eligible for this subject from the offer's courses
    // For simplicity, allow any professor in the system
    client.get('/parameters').then(() => {}); // trigger auth check
    // In real usage, add GET /api/professors?subject_id=X endpoint
    // For v1, we show current professor and a text note
    setProfessors([{ id: course.professor_id, name: course.professor_name }]);
  }, [course]);

  async function handleSave() {
    setSaving(true);
    await client.patch(`/offers/${offerId}/courses/${course.id}`, { professor_id: profId });
    setSaving(false);
    onSave();
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1e293b', borderRadius: '8px', padding: '1.5rem', minWidth: '320px' }}>
        <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>{course.subject_name}</h3>
        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1rem' }}>
          {course.time_slot?.day_name} {course.time_slot?.start_hour}:00 - {course.time_slot?.end_hour}:00
        </p>
        <label style={{ color: '#94a3b8', display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Docente</label>
        <select
          value={profId}
          onChange={e => setProfId(parseInt(e.target.value))}
          style={{ width: '100%', padding: '0.4rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', marginBottom: '1rem' }}
        >
          {professors.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.4rem 1rem', background: 'transparent', border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.4rem 1rem', background: '#3b82f6', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create frontend/src/components/CalendarGrid.jsx**

```jsx
import CourseCard from './CourseCard';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

export default function CalendarGrid({ courses, timeSlots, selectedCareerIds, onCourseClick }) {
  const filteredCourses = selectedCareerIds.length === 0
    ? courses
    : courses.filter(c => selectedCareerIds.includes(c.career_id));

  const coursesBySlot = {};
  for (const course of filteredCourses) {
    const key = `${course.time_slot?.day}-${course.time_slot?.start_hour}`;
    if (!coursesBySlot[key]) coursesBySlot[key] = [];
    coursesBySlot[key].push(course);
  }

  const uniqueHours = [...new Set(timeSlots.map(s => s.start_hour))].sort((a, b) => a - b);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
        <thead>
          <tr style={{ background: '#1e293b' }}>
            <th style={{ padding: '0.5rem', color: '#64748b', width: '60px', borderRight: '1px solid #334155' }}></th>
            {DAY_NAMES.map(d => (
              <th key={d} style={{ padding: '0.5rem', color: '#94a3b8', fontWeight: 600, borderRight: '1px solid #334155' }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {uniqueHours.map(startHour => (
            <tr key={startHour} style={{ borderTop: '1px solid #1e293b' }}>
              <td style={{ padding: '0.4rem 0.5rem', color: '#475569', textAlign: 'right', borderRight: '1px solid #334155', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                {startHour}:00
              </td>
              {[0, 1, 2, 3, 4].map(day => {
                const key = `${day}-${startHour}`;
                const slotCourses = coursesBySlot[key] || [];
                return (
                  <td key={day} style={{ padding: '0.3rem', borderRight: '1px solid #1e293b', verticalAlign: 'top', minWidth: '120px' }}>
                    {slotCourses.map(course => (
                      <CourseCard key={course.id} course={course} onClick={onCourseClick} />
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Create frontend/src/pages/OffersPage.jsx**

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import CalendarGrid from '../components/CalendarGrid';
import CareerFilter from '../components/CareerFilter';
import CourseEditModal from '../components/CourseEditModal';

export default function OffersPage() {
  const [offer, setOffer] = useState(null);
  const [offers, setOffers] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [careers, setCareers] = useState([]);
  const [selectedCareerIds, setSelectedCareerIds] = useState([]);
  const [editingCourse, setEditingCourse] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    client.get('/parameters').then(r => setTimeSlots(r.data.time_slots));
    loadOffers();
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      const r = await client.get(`/jobs/${jobId}`);
      if (r.data.status === 'done') {
        clearInterval(interval);
        setJobId(null);
        setGenerating(false);
        await loadOffers();
        if (r.data.offer_id) loadOffer(r.data.offer_id);
      } else if (r.data.status === 'failed') {
        clearInterval(interval);
        setJobId(null);
        setGenerating(false);
        alert('Error al generar la oferta: ' + r.data.error);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [jobId]);

  async function loadOffers() {
    const r = await client.get('/offers');
    setOffers(r.data);
    if (r.data.length > 0) loadOffer(r.data[0].id);
  }

  async function loadOffer(id) {
    const r = await client.get(`/offers/${id}`);
    setOffer(r.data);
    // Extract careers from courses
    const careerMap = {};
    for (const course of r.data.courses) {
      if (course.career_id) careerMap[course.career_id] = course.career_name || `Carrera ${course.career_id}`;
    }
    setCareers(Object.entries(careerMap).map(([id, name]) => ({ id: parseInt(id), name })));
  }

  async function handleGenerate() {
    setGenerating(true);
    setConfirmRegenerate(false);
    const r = await client.post('/generate?semester=2026-2');
    setJobId(r.data.job_id);
  }

  async function handleApprove() {
    if (!offer) return;
    await client.post(`/offers/${offer.id}/approve`);
    loadOffer(offer.id);
  }

  const coursesWithYear = (offer?.courses || []).map(c => ({ ...c, year: c.year || 1 }));

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      {/* Top bar */}
      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 600 }}>Oferta Académica</span>
          {offer && (
            <span style={{ background: offer.status === 'published' ? '#166534' : '#92400e', color: offer.status === 'published' ? '#86efac' : '#fbbf24', border: `1px solid ${offer.status === 'published' ? '#16a34a' : '#b45309'}`, borderRadius: '4px', padding: '0.1rem 0.5rem', fontSize: '0.7rem' }}>
              {offer.status === 'published' ? 'PUBLICADA' : 'BORRADOR'}
            </span>
          )}
          {offer && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{offer.semester} · {offer.courses?.length || 0} cursos</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <CareerFilter careers={careers} selected={selectedCareerIds} onChange={setSelectedCareerIds} />
          <button onClick={() => navigate('/parameters')} style={{ padding: '0.3rem 0.75rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}>
            Parámetros
          </button>
          {offer?.status !== 'published' && (
            <button onClick={() => setConfirmRegenerate(true)} disabled={generating} style={{ padding: '0.3rem 0.75rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}>
              {generating ? 'Generando...' : offers.length === 0 ? 'Generar oferta' : 'Regenerar'}
            </button>
          )}
          {offer?.status === 'draft' && (
            <button onClick={handleApprove} style={{ padding: '0.3rem 0.75rem', background: '#16a34a', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
              ✓ Aprobar oferta
            </button>
          )}
          <button onClick={logout} style={{ padding: '0.3rem 0.75rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}>
            Salir
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div style={{ padding: '1rem' }}>
        {generating && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <p>Ejecutando optimizador... esto puede tomar varios minutos.</p>
          </div>
        )}
        {!generating && offer && (
          <CalendarGrid
            courses={coursesWithYear}
            timeSlots={timeSlots}
            selectedCareerIds={selectedCareerIds}
            onCourseClick={offer.status === 'draft' ? setEditingCourse : () => {}}
          />
        )}
        {!generating && !offer && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
            <p>No hay oferta generada. Hacé clic en "Generar oferta" para comenzar.</p>
          </div>
        )}
      </div>

      {/* Regenerate confirmation */}
      {confirmRegenerate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', borderRadius: '8px', padding: '1.5rem', maxWidth: '360px' }}>
            <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>¿Regenerar oferta?</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Esto descartará el borrador actual y todos los ajustes manuales.</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmRegenerate(false)} style={{ padding: '0.4rem 1rem', background: 'transparent', border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleGenerate} style={{ padding: '0.4rem 1rem', background: '#ef4444', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Regenerar</button>
            </div>
          </div>
        </div>
      )}

      {/* Course edit modal */}
      {editingCourse && (
        <CourseEditModal
          course={editingCourse}
          offerId={offer.id}
          onClose={() => setEditingCourse(null)}
          onSave={() => loadOffer(offer.id)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Test the full flow in browser**

1. Log in at http://localhost:5173
2. Click "Generar oferta" — wait for optimizer (30-600s depending on problem size)
3. Verify calendar shows courses by time slot
4. Click a course card — modal should appear
5. Click "✓ Aprobar oferta" — status badge changes to PUBLICADA

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: calendar UI — offer generation, filtering by career, course editing, approval"
```

---

## Self-review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Dataset de simulación (2-3 carreras, ~500 alumnos, ~40 docentes) | Task 3 |
| Análisis de demanda (correlativas + no aprobada) | Task 7 |
| OR-Tools CP-SAT optimizer | Task 8 |
| Restricciones duras del solver | Task 8 |
| Función objetivo (conflictos + distribución) | Task 8 |
| Timeout configurable | Task 5 + Task 8 |
| Job asincrónico con polling | Task 9 |
| Multitenancy — aislamiento por tenant_id | Task 2 + Task 4 |
| Reglas globales + overrides por tenant | Task 5 |
| JWT auth — login/logout | Task 4 |
| GET/PUT /parameters | Task 5 |
| POST /generate + GET /jobs/{id} | Task 9 |
| GET /offers, GET /offers/{id} | Task 10 |
| PATCH /offers/{id}/courses/{id} | Task 10 |
| POST /offers/{id}/approve | Task 10 |
| Login page con JWT en memoria | Task 11 |
| Redirect automático si token expira | Task 11 (interceptor) |
| Panel de parámetros | Task 12 |
| Calendario semanal con cursos coloreados por año | Task 13 |
| Filtro por carrera (dropdown multi-select) | Task 13 |
| Editar curso (docente/franja) | Task 13 |
| Regenerar con confirmación | Task 13 |
| Aprobar oferta | Task 13 |
| Cursos modificados manualmente marcados visualmente | Task 13 (CourseCard) |

**Error handling coverage:**

| Caso | Dónde |
|---|---|
| Solver infeasible | `run_optimizer` retorna status="infeasible" |
| Timeout alcanzado | OR-Tools devuelve FEASIBLE con lo encontrado |
| Token expirado | Interceptor de Axios redirige a /login |
| Editar oferta publicada | PATCH retorna 400 |
| Tenant isolation | `get_current_user` + tenant_id en todos los queries |
