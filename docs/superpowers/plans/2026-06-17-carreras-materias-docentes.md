# Pantallas de Consulta — Carreras, Materias y Docentes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar pantalla de consulta de carreras con tabla de materias y panel lateral de docentes + configuración de turnos por materia, con el optimizador respetando esas restricciones.

**Architecture:** Nueva ruta `/careers` con layout dos columnas (lista carreras / tabla materias agrupadas por año) y panel lateral que desliza al seleccionar una materia. Backend expone tres endpoints REST nuevos en `/api/careers`. El campo `allowed_turnos` en `Subject` restringe qué turnos puede usar el optimizador para esa materia.

**Tech Stack:** Python 3.11 / FastAPI / SQLAlchemy 2.0 / Alembic · React 18 / Tailwind / shadcn/ui · pytest / SQLite (tests)

## Global Constraints

- Multi-tenant: todos los queries filtran por `current_user.tenant_id`
- `allowed_turnos`: `null` = sin restricción (todos los turnos), `[1, 3]` = solo esos IDs de turno
- Cuando todos los turnos están marcados en el panel → enviar `null` al backend (no lista completa)
- No nuevos paquetes npm ni Python
- Test command: `cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v`
- Alembic command: `cd backend && PYTHONPATH=. .venv/bin/alembic revision --autogenerate -m "add_subject_allowed_turnos"`

---

## File Map

| Archivo | Cambio |
|---|---|
| `backend/app/models/academic.py` | Agregar `allowed_turnos` column a `Subject` |
| `backend/alembic/versions/<hash>_add_subject_allowed_turnos.py` | Nueva migración |
| `backend/app/services/data_layer.py` | Incluir `allowed_turnos` en `get_subjects()` |
| `backend/app/services/demand_analyzer.py` | Propagar `allowed_turnos` al item de demanda |
| `backend/app/services/optimizer.py` | Filtrar slots por `allowed_turnos` |
| `backend/app/schemas/careers.py` | Nuevos schemas: `CareerResponse`, `SubjectResponse`, `ProfessorInSubject`, `SubjectTurnosUpdate` |
| `backend/app/routers/careers.py` | Nuevo router con 3 endpoints |
| `backend/app/main.py` | Registrar nuevo router |
| `backend/tests/test_careers.py` | 7 tests nuevos |
| `frontend/src/hooks/useCareers.js` | Fetch `GET /careers` |
| `frontend/src/hooks/useCareerSubjects.js` | Fetch `GET /careers/{id}/subjects`, expone `updateSubject` |
| `frontend/src/pages/CareersPage.jsx` | Página dos columnas + panel lateral |
| `frontend/src/components/careers/SubjectPanel.jsx` | Panel con docentes + checkboxes de turnos |
| `frontend/src/components/layout/Sidebar.jsx` | Ítem "Carreras" |
| `frontend/src/App.jsx` | Ruta `/careers` |

---

### Task 1: Backend — `allowed_turnos` en Subject + Alembic migration + data_layer

Agrega el campo `allowed_turnos` al modelo `Subject`, genera la migración, y actualiza `data_layer.get_subjects()` para incluirlo en el dict retornado.

**Files:**
- Modify: `backend/app/models/academic.py`
- Create: `backend/alembic/versions/<hash>_add_subject_allowed_turnos.py`
- Modify: `backend/app/services/data_layer.py`
- Test: `backend/tests/test_careers.py` (crear el archivo)

**Interfaces:**
- Produces: `data_layer.get_subjects(db, tenant_id)` retorna `[{"id", "name", "year", "career_id", "allowed_turnos"}, ...]`
- Produces: `Subject.allowed_turnos` accesible como `Column(JSON, nullable=True)` en el modelo

---

- [ ] **Step 1: Agregar `allowed_turnos` al modelo `Subject`**

Editar `backend/app/models/academic.py`. Agregar la importación de `JSON` y el campo:

```python
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
```

- [ ] **Step 2: Generar la migración Alembic**

```bash
cd backend && PYTHONPATH=. .venv/bin/alembic revision --autogenerate -m "add_subject_allowed_turnos"
```

Inspeccionar el archivo generado en `backend/alembic/versions/`. Debe contener:
```python
op.add_column('subjects', sa.Column('allowed_turnos', sa.JSON(), nullable=True))
```

Si el autogenerate no lo detecta, escribirlo manualmente con ese `op.add_column` en `upgrade()` y `op.drop_column('subjects', 'allowed_turnos')` en `downgrade()`.

- [ ] **Step 3: Aplicar la migración**

```bash
cd backend && PYTHONPATH=. .venv/bin/alembic upgrade head
```

- [ ] **Step 4: Actualizar `data_layer.get_subjects()`**

Reemplazar la función en `backend/app/services/data_layer.py`:

```python
def get_subjects(db: Session, tenant_id: int) -> list[dict]:
    subjects = db.query(Subject).filter(Subject.tenant_id == tenant_id).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "year": s.year,
            "career_id": s.career_id,
            "allowed_turnos": s.allowed_turnos,
        }
        for s in subjects
    ]
```

- [ ] **Step 5: Escribir tests**

Crear `backend/tests/test_careers.py`:

```python
from app.models.academic import Subject, Professor, ProfessorSubject


def test_subject_allowed_turnos_defaults_null(db):
    subject = Subject(id=10, tenant_id=1, career_id=1, name="Álgebra", year=1)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    assert subject.allowed_turnos is None


def test_subject_allowed_turnos_persists(db):
    subject = Subject(id=11, tenant_id=1, career_id=1, name="Análisis", year=1, allowed_turnos=[1, 3])
    db.add(subject)
    db.commit()
    db.refresh(subject)
    assert subject.allowed_turnos == [1, 3]
```

- [ ] **Step 6: Correr tests**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_careers.py -v
```

Esperado: 2 PASSED

- [ ] **Step 7: Correr suite completa**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v
```

Esperado: todos los tests anteriores + 2 nuevos = PASSED

- [ ] **Step 8: Commit**

```bash
git add backend/app/models/academic.py backend/app/services/data_layer.py backend/alembic/versions/ backend/tests/test_careers.py
git commit -m "feat: allowed_turnos en Subject — migration + data_layer actualizado"
```

---

### Task 2: Backend — careers router con los 3 endpoints

Crea los schemas Pydantic y el router con `GET /careers`, `GET /careers/{id}/subjects` y `PATCH /subjects/{id}/turnos`. Lo registra en `main.py`.

**Files:**
- Create: `backend/app/schemas/careers.py`
- Create: `backend/app/routers/careers.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_careers.py`

**Interfaces:**
- Consumes: `Subject.allowed_turnos` de Task 1
- Produces: `GET /api/careers` → `[{id, name}]`
- Produces: `GET /api/careers/{id}/subjects` → `[{id, name, year, allowed_turnos, professors: [{id, name}]}]`
- Produces: `PATCH /api/subjects/{id}/turnos` body `{allowed_turnos: [int] | null}` → subject actualizado

---

- [ ] **Step 1: Escribir tests que fallan**

Agregar a `backend/tests/test_careers.py`:

```python
def test_list_careers_returns_tenant_careers(client, auth_headers, db):
    r = client.get("/api/careers", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert any(c["name"] == "Test Career" for c in data)
    assert all("id" in c and "name" in c for c in data)


def test_list_careers_excludes_other_tenant(client, auth_headers, db):
    from app.models.tenant import Tenant
    from app.models.academic import Career
    other_tenant = Tenant(id=2, name="Other Uni", active=True)
    db.add(other_tenant)
    db.add(Career(id=99, tenant_id=2, name="Other Career"))
    db.commit()
    r = client.get("/api/careers", headers=auth_headers)
    assert r.status_code == 200
    names = [c["name"] for c in r.json()]
    assert "Other Career" not in names


def test_get_subjects_returns_subjects_with_professors(client, auth_headers, db):
    from app.models.academic import Subject, Professor, ProfessorSubject
    db.add(Professor(id=50, tenant_id=1, name="García, Juan"))
    db.add(Subject(id=20, tenant_id=1, career_id=1, name="Álgebra", year=1))
    db.add(ProfessorSubject(professor_id=50, subject_id=20))
    db.commit()
    r = client.get("/api/careers/1/subjects", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["name"] == "Álgebra"
    assert data[0]["year"] == 1
    assert data[0]["allowed_turnos"] is None
    assert len(data[0]["professors"]) == 1
    assert data[0]["professors"][0]["name"] == "García, Juan"


def test_get_subjects_404_wrong_tenant(client, auth_headers, db):
    from app.models.tenant import Tenant
    from app.models.academic import Career
    other_tenant = Tenant(id=3, name="Other Uni 3", active=True)
    db.add(other_tenant)
    db.add(Career(id=88, tenant_id=3, name="Other Career"))
    db.commit()
    r = client.get("/api/careers/88/subjects", headers=auth_headers)
    assert r.status_code == 404


def test_patch_turnos_updates_allowed_turnos(client, auth_headers, db):
    from app.models.academic import Subject
    db.add(Subject(id=30, tenant_id=1, career_id=1, name="Análisis", year=1))
    db.commit()
    r = client.patch("/api/subjects/30/turnos", headers=auth_headers, json={"allowed_turnos": [1, 2]})
    assert r.status_code == 200
    data = r.json()
    assert data["allowed_turnos"] == [1, 2]
    assert data["name"] == "Análisis"


def test_patch_turnos_null_clears_restriction(client, auth_headers, db):
    from app.models.academic import Subject
    db.add(Subject(id=31, tenant_id=1, career_id=1, name="Prog", year=2, allowed_turnos=[1]))
    db.commit()
    r = client.patch("/api/subjects/31/turnos", headers=auth_headers, json={"allowed_turnos": None})
    assert r.status_code == 200
    assert r.json()["allowed_turnos"] is None


def test_patch_turnos_404_wrong_tenant(client, auth_headers, db):
    from app.models.tenant import Tenant
    from app.models.academic import Career, Subject
    db.add(Tenant(id=4, name="Other Uni 4", active=True))
    db.add(Career(id=77, tenant_id=4, name="Other Career"))
    db.add(Subject(id=32, tenant_id=4, career_id=77, name="Materia Ajena", year=1))
    db.commit()
    r = client.patch("/api/subjects/32/turnos", headers=auth_headers, json={"allowed_turnos": [1]})
    assert r.status_code == 404
```

- [ ] **Step 2: Correr tests para verificar que fallan**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_careers.py::test_list_careers_returns_tenant_careers -v
```

Esperado: FAIL — 404 (endpoint no existe)

- [ ] **Step 3: Crear `backend/app/schemas/careers.py`**

```python
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
```

- [ ] **Step 4: Crear `backend/app/routers/careers.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.tenant import User
from app.models.academic import Career, Subject, Professor, ProfessorSubject
from app.schemas.careers import CareerResponse, SubjectResponse, ProfessorInSubject, SubjectTurnosUpdate

router = APIRouter()


@router.get("", response_model=list[CareerResponse])
def list_careers(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    careers = db.query(Career).filter(Career.tenant_id == current_user.tenant_id).order_by(Career.name).all()
    return [CareerResponse(id=c.id, name=c.name) for c in careers]


@router.get("/{career_id}/subjects", response_model=list[SubjectResponse])
def list_subjects(career_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    career = db.query(Career).filter(
        Career.id == career_id,
        Career.tenant_id == current_user.tenant_id
    ).first()
    if not career:
        raise HTTPException(status_code=404, detail="Career not found")

    subjects = (
        db.query(Subject)
        .filter(Subject.career_id == career_id, Subject.tenant_id == current_user.tenant_id)
        .order_by(Subject.year, Subject.name)
        .all()
    )

    result = []
    for s in subjects:
        professors = (
            db.query(Professor)
            .join(ProfessorSubject, ProfessorSubject.professor_id == Professor.id)
            .filter(ProfessorSubject.subject_id == s.id)
            .order_by(Professor.name)
            .all()
        )
        result.append(SubjectResponse(
            id=s.id,
            name=s.name,
            year=s.year,
            allowed_turnos=s.allowed_turnos,
            professors=[ProfessorInSubject(id=p.id, name=p.name) for p in professors],
        ))
    return result


@router.patch("/subjects/{subject_id}/turnos", response_model=SubjectResponse)
def update_subject_turnos(
    subject_id: int,
    body: SubjectTurnosUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.tenant_id == current_user.tenant_id
    ).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    subject.allowed_turnos = body.allowed_turnos
    db.commit()
    db.refresh(subject)

    professors = (
        db.query(Professor)
        .join(ProfessorSubject, ProfessorSubject.professor_id == Professor.id)
        .filter(ProfessorSubject.subject_id == subject.id)
        .order_by(Professor.name)
        .all()
    )
    return SubjectResponse(
        id=subject.id,
        name=subject.name,
        year=subject.year,
        allowed_turnos=subject.allowed_turnos,
        professors=[ProfessorInSubject(id=p.id, name=p.name) for p in professors],
    )
```

- [ ] **Step 5: Registrar el router en `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, generate, offers, parameters, careers

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
app.include_router(careers.router, prefix="/api/careers", tags=["careers"])
```

Note: el endpoint `PATCH /subjects/{id}/turnos` está en el router de careers pero el prefijo es `/api/careers`, así que la URL final es `/api/careers/subjects/{id}/turnos`. Esto es correcto — el frontend llamará a ese path.

- [ ] **Step 6: Correr los tests de careers**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_careers.py -v
```

Esperado: 9 PASSED (2 de Task 1 + 7 nuevos)

- [ ] **Step 7: Correr suite completa**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v
```

Esperado: todos PASSED

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas/careers.py backend/app/routers/careers.py backend/app/main.py backend/tests/test_careers.py
git commit -m "feat: careers router — GET /careers, GET /careers/{id}/subjects, PATCH /subjects/{id}/turnos"
```

---

### Task 3: Optimizador respeta `allowed_turnos`

Propaga `allowed_turnos` desde `data_layer` → `demand_analyzer` → `optimizer` y filtra los slots candidatos por materia.

**Files:**
- Modify: `backend/app/services/demand_analyzer.py`
- Modify: `backend/app/services/optimizer.py`
- Modify: `backend/tests/test_careers.py`

**Interfaces:**
- Consumes: `data_layer.get_subjects()` retorna `allowed_turnos` (Task 1)
- Consumes: `demand` items tienen `allowed_turnos` (este task)
- Produces: `optimizer.run_optimizer()` solo crea variables `x[c, p, s]` para slots permitidos

---

- [ ] **Step 1: Escribir test que falla**

Agregar a `backend/tests/test_careers.py`:

```python
def test_optimizer_respects_allowed_turnos():
    from app.services.optimizer import run_optimizer

    time_slots = [
        {"id": 0, "turno_id": 1, "turno_name": "Mañana", "day": 0, "day_name": "Lunes", "start_hour": 8, "end_hour": 12, "duration_hours": 4},
        {"id": 1, "turno_id": 2, "turno_name": "Tarde", "day": 0, "day_name": "Lunes", "start_hour": 14, "end_hour": 18, "duration_hours": 4},
    ]
    professors = [{"id": 1, "name": "Prof A"}]
    demand = [{
        "subject_id": 1,
        "name": "Álgebra",
        "year": 1,
        "career_id": 1,
        "demand": 5,
        "num_courses": 1,
        "eligible_professor_ids": [1],
        "allowed_turnos": [2],  # solo turno tarde (id=2)
    }]
    params = {
        "max_students_per_course": 40,
        "max_weekly_hours_per_professor": 30,
        "available_classrooms": 10,
        "solver_timeout_seconds": 10,
    }
    result = run_optimizer(demand, professors, time_slots, params)
    assert result["status"] in ("optimal", "feasible")
    assert len(result["assignments"]) == 1
    # La materia debe estar en turno_id=2 (Tarde), no en turno_id=1 (Mañana)
    assert result["assignments"][0]["time_slot"]["turno_id"] == 2
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_careers.py::test_optimizer_respects_allowed_turnos -v
```

Esperado: FAIL — el optimizador ignora `allowed_turnos` y puede asignar cualquier turno

- [ ] **Step 3: Actualizar `demand_analyzer.py` para propagar `allowed_turnos`**

En `backend/app/services/demand_analyzer.py`, dentro del `result.append({...})`, agregar el campo:

```python
        result.append({
            "subject_id": sid,
            "name": subject["name"],
            "year": subject["year"],
            "career_id": subject["career_id"],
            "demand": eligible_count,
            "num_courses": num_courses,
            "eligible_professor_ids": eligible_prof_ids,
            "allowed_turnos": subject.get("allowed_turnos"),
        })
```

- [ ] **Step 4: Actualizar `optimizer.py` para filtrar slots por `allowed_turnos`**

En `backend/app/services/optimizer.py`, en el bloque que construye `x`:

Reemplazar:
```python
    x = {}
    for c, course in enumerate(courses):
        for prof_id in course["eligible_professor_ids"]:
            if prof_id not in prof_by_id:
                continue
            p = prof_by_id[prof_id]
            for s in range(num_slots):
                x[c, p, s] = model.NewBoolVar(f"x_{c}_{p}_{s}")
```

Con:
```python
    x = {}
    for c, course in enumerate(courses):
        allowed_turnos = course.get("allowed_turnos")
        for prof_id in course["eligible_professor_ids"]:
            if prof_id not in prof_by_id:
                continue
            p = prof_by_id[prof_id]
            for s, slot in enumerate(time_slots):
                if allowed_turnos and slot["turno_id"] not in allowed_turnos:
                    continue
                x[c, p, s] = model.NewBoolVar(f"x_{c}_{p}_{s}")
```

También necesitás agregar `allowed_turnos` al dict de cursos que se construye desde demand. Buscar el bloque `courses = []` y reemplazar:

```python
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
                "allowed_turnos": item.get("allowed_turnos"),
            })
```

- [ ] **Step 5: Correr el test**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_careers.py::test_optimizer_respects_allowed_turnos -v
```

Esperado: PASS

- [ ] **Step 6: Correr suite completa**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v
```

Esperado: todos PASSED

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/demand_analyzer.py backend/app/services/optimizer.py backend/tests/test_careers.py
git commit -m "feat: optimizador respeta allowed_turnos por materia"
```

---

### Task 4: Frontend — hooks, CareersPage skeleton y navegación

Crea los dos hooks de datos, la página con layout dos columnas (lista carreras + tabla materias), el sidebar actualizado y la ruta. El panel lateral se integra en Task 5.

**Files:**
- Create: `frontend/src/hooks/useCareers.js`
- Create: `frontend/src/hooks/useCareerSubjects.js`
- Create: `frontend/src/pages/CareersPage.jsx`
- Modify: `frontend/src/components/layout/Sidebar.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Produces: `useCareers()` → `{ careers: [{id, name}] }`
- Produces: `useCareerSubjects(careerId)` → `{ subjects: [{id, name, year, allowed_turnos, professors}], loading, updateSubject(subject) }`
- Produces: `<CareersPage />` acepta `onSelectSubject(subject)` internamente (estado local)
- Nota: el endpoint PATCH está en `/api/careers/subjects/{id}/turnos` (no `/api/subjects/{id}/turnos`)

---

- [ ] **Step 1: Crear `frontend/src/hooks/useCareers.js`**

```js
import { useState, useEffect } from 'react'
import client from '@/api/client'

export function useCareers() {
  const [careers, setCareers] = useState([])

  useEffect(() => {
    client.get('/careers').then(r => setCareers(r.data))
  }, [])

  return { careers }
}
```

- [ ] **Step 2: Crear `frontend/src/hooks/useCareerSubjects.js`**

```js
import { useState, useEffect } from 'react'
import client from '@/api/client'

export function useCareerSubjects(careerId) {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!careerId) { setSubjects([]); return }
    setLoading(true)
    client.get(`/careers/${careerId}/subjects`)
      .then(r => setSubjects(r.data))
      .finally(() => setLoading(false))
  }, [careerId])

  function updateSubject(updated) {
    setSubjects(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

  return { subjects, loading, updateSubject }
}
```

- [ ] **Step 3: Crear `frontend/src/pages/CareersPage.jsx`**

```jsx
import { useState, useMemo } from 'react'
import { BookOpen, ChevronRight, Loader2 } from 'lucide-react'
import { useCareers } from '@/hooks/useCareers'
import { useCareerSubjects } from '@/hooks/useCareerSubjects'

function TurnosBadge({ allowedTurnos, turnos }) {
  if (!allowedTurnos || allowedTurnos.length === 0) {
    return <span className="text-xs text-gray-400">Todos</span>
  }
  const names = turnos
    .filter(t => allowedTurnos.includes(t.id))
    .map(t => t.name.replace('Turno ', ''))
  return (
    <div className="flex flex-wrap gap-1">
      {names.map(n => (
        <span key={n} className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">{n}</span>
      ))}
    </div>
  )
}

export default function CareersPage({ params, onSelectSubject }) {
  const { careers } = useCareers()
  const [selectedCareerId, setSelectedCareerId] = useState(null)
  const [search, setSearch] = useState('')
  const { subjects, loading } = useCareerSubjects(selectedCareerId)

  const filteredCareers = careers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const subjectsByYear = useMemo(() => {
    const grouped = {}
    for (const s of subjects) {
      if (!grouped[s.year]) grouped[s.year] = []
      grouped[s.year].push(s)
    }
    return Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b))
  }, [subjects])

  const turnos = params?.turnos || []

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Columna carreras */}
      <div className="w-64 border-r border-gray-200 flex flex-col bg-white shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Carreras</h2>
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filteredCareers.map(c => (
            <button
              key={c.id}
              onClick={() => { setSelectedCareerId(c.id); onSelectSubject && onSelectSubject(null) }}
              className={[
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                selectedCareerId === c.id
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
            >
              {c.name}
            </button>
          ))}
          {filteredCareers.length === 0 && (
            <p className="text-xs text-gray-400 px-3 py-4">Sin resultados</p>
          )}
        </div>
      </div>

      {/* Área materias */}
      <div className="flex-1 overflow-y-auto">
        {!selectedCareerId ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <BookOpen className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Seleccioná una carrera</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
          </div>
        ) : subjects.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">Sin materias</p>
          </div>
        ) : (
          <div className="p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-6">
              {careers.find(c => c.id === selectedCareerId)?.name}
            </h1>
            {subjectsByYear.map(([year, subs]) => (
              <div key={year} className="mb-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Año {year}
                </h3>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <tbody>
                      {subs.map((s, i) => (
                        <tr
                          key={s.id}
                          onClick={() => onSelectSubject && onSelectSubject(s)}
                          className={[
                            'cursor-pointer transition-colors hover:bg-gray-50',
                            i > 0 ? 'border-t border-gray-100' : '',
                          ].join(' ')}
                        >
                          <td className="px-4 py-3 text-sm text-gray-900">{s.name}</td>
                          <td className="px-4 py-3">
                            <TurnosBadge allowedTurnos={s.allowed_turnos} turnos={turnos} />
                          </td>
                          <td className="px-4 py-3 w-8 text-gray-300">
                            <ChevronRight className="h-4 w-4" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Actualizar `frontend/src/components/layout/Sidebar.jsx`**

Reemplazar el contenido del archivo:

```jsx
import { NavLink } from 'react-router-dom'
import { Calendar, Settings, GraduationCap, BookOpen } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'

export default function Sidebar() {
  const { user, logout } = useAuth()

  const navItem = (to, Icon, label) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
        }`
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  )

  return (
    <div className="w-60 h-screen bg-gray-50 border-r border-gray-200 flex flex-col fixed left-0 top-0 z-40">
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">Oferta Académica</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItem('/', Calendar, 'Calendario')}
        {navItem('/careers', BookOpen, 'Carreras')}
        {navItem('/parameters', Settings, 'Parámetros')}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-400 truncate mb-2">{user?.username}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="w-full justify-start text-gray-500 hover:text-gray-700 px-2"
        >
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Actualizar `frontend/src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { Toaster } from '@/components/ui/sonner'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import OffersPage from '@/pages/OffersPage'
import ParametersPage from '@/pages/ParametersPage'
import CareersPage from '@/pages/CareersPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<OffersPage />} />
            <Route path="/careers" element={<CareersPage />} />
            <Route path="/parameters" element={<ParametersPage />} />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  )
}
```

Nota: `CareersPage` necesita `params` (para mostrar nombres de turnos en el badge) y `onSelectSubject`. En este task los pasamos como `undefined` — la página los acepta opcionalmente. En Task 5 se envuelve con el hook de params y el estado del panel.

Actualizar la ruta en `App.jsx` para pasar `params` desde `useParameters`:

```jsx
import { useParameters } from '@/hooks/useParameters'

function CareersRoute() {
  const { params } = useParameters()
  const [selectedSubject, setSelectedSubject] = useState(null)
  return (
    <>
      <CareersPage params={params} onSelectSubject={setSelectedSubject} />
    </>
  )
}

// Luego en Routes:
<Route path="/careers" element={<CareersRoute />} />
```

Pero esto requiere importar `useState` en `App.jsx`. Más limpio: crear un wrapper. Reemplazar `App.jsx` con:

```jsx
import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { Toaster } from '@/components/ui/sonner'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import OffersPage from '@/pages/OffersPage'
import ParametersPage from '@/pages/ParametersPage'
import CareersPage from '@/pages/CareersPage'
import { useParameters } from '@/hooks/useParameters'

function CareersRoute() {
  const { params } = useParameters()
  const [selectedSubject, setSelectedSubject] = useState(null)
  return (
    <CareersPage
      params={params}
      onSelectSubject={setSelectedSubject}
    />
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<OffersPage />} />
            <Route path="/careers" element={<CareersRoute />} />
            <Route path="/parameters" element={<ParametersPage />} />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  )
}
```

- [ ] **Step 6: Verificación manual (código review)**

Verificar:
- `useCareers` llama `GET /careers` (sin `/api/` prefix — el `client` ya tiene el baseURL con `/api`)
- `useCareerSubjects` recarga cuando `careerId` cambia (`[careerId]` en useEffect)
- `subjectsByYear` agrupa correctamente y ordena por año
- `TurnosBadge` muestra "Todos" cuando `allowedTurnos` es null
- El sidebar tiene los 3 items en orden correcto

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useCareers.js frontend/src/hooks/useCareerSubjects.js frontend/src/pages/CareersPage.jsx frontend/src/components/layout/Sidebar.jsx frontend/src/App.jsx
git commit -m "feat: CareersPage skeleton — dos columnas, hooks de datos, sidebar actualizado"
```

---

### Task 5: Frontend — SubjectPanel con docentes y configuración de turnos

Crea el componente `SubjectPanel` y lo integra en `CareersRoute` (en `App.jsx`) para que aparezca al seleccionar una materia.

**Files:**
- Create: `frontend/src/components/careers/SubjectPanel.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `useCareerSubjects.updateSubject(subject)` — actualiza la materia en la lista local
- Consumes: `params.turnos` para renderizar checkboxes
- Consumes: `PATCH /api/careers/subjects/{id}/turnos` — actualiza en backend
- Produces: `<SubjectPanel subject onClose onUpdate turnos />` — componente de panel lateral

---

- [ ] **Step 1: Crear `frontend/src/components/careers/SubjectPanel.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import client from '@/api/client'
import { Button } from '@/components/ui/button'

export default function SubjectPanel({ subject, turnos, onClose, onUpdate }) {
  const [checked, setChecked] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!subject) return
    if (subject.allowed_turnos === null || subject.allowed_turnos === undefined) {
      setChecked(turnos.map(t => t.id))
    } else {
      setChecked(subject.allowed_turnos)
    }
  }, [subject, turnos])

  function toggle(turnoId) {
    setChecked(prev =>
      prev.includes(turnoId) ? prev.filter(id => id !== turnoId) : [...prev, turnoId]
    )
  }

  async function handleSave() {
    setSaving(true)
    const allChecked = checked.length === turnos.length
    const payload = { allowed_turnos: allChecked ? null : checked }
    try {
      const r = await client.patch(`/careers/subjects/${subject.id}/turnos`, payload)
      onUpdate(r.data)
      toast.success('Turnos guardados')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!subject) return null

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-xl border-l border-gray-200 z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900 text-sm truncate pr-2">{subject.name}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Docentes</h3>
          {subject.professors.length === 0 ? (
            <p className="text-sm text-gray-400">Sin docentes asignados</p>
          ) : (
            <ul className="space-y-1.5">
              {subject.professors.map(p => (
                <li key={p.id} className="text-sm text-gray-700">{p.name}</li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Turnos habilitados</h3>
          {turnos.length === 0 ? (
            <p className="text-sm text-gray-400">No hay turnos configurados</p>
          ) : (
            <div className="space-y-2">
              {turnos.map(t => (
                <label key={t.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked.includes(t.id)}
                    onChange={() => toggle(t.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm text-gray-700">{t.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{t.start_hour}:00–{t.end_hour}:00</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="p-4 border-t border-gray-200">
        <Button onClick={handleSave} disabled={saving || checked.length === 0} className="w-full">
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</> : 'Guardar'}
        </Button>
        {checked.length === 0 && (
          <p className="text-xs text-red-500 mt-2 text-center">Seleccioná al menos un turno</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Integrar `SubjectPanel` en `CareersRoute` dentro de `App.jsx`**

Reemplazar `CareersRoute` con la versión que incluye el panel y el hook de subjects:

```jsx
import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { Toaster } from '@/components/ui/sonner'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import OffersPage from '@/pages/OffersPage'
import ParametersPage from '@/pages/ParametersPage'
import CareersPage from '@/pages/CareersPage'
import SubjectPanel from '@/components/careers/SubjectPanel'
import { useParameters } from '@/hooks/useParameters'
import { useCareerSubjects } from '@/hooks/useCareerSubjects'

function CareersRoute() {
  const { params } = useParameters()
  const [selectedCareerId, setSelectedCareerId] = useState(null)
  const [selectedSubject, setSelectedSubject] = useState(null)
  const { subjects, loading, updateSubject } = useCareerSubjects(selectedCareerId)

  return (
    <>
      <CareersPage
        params={params}
        subjects={subjects}
        subjectsLoading={loading}
        selectedCareerId={selectedCareerId}
        onSelectCareer={id => { setSelectedCareerId(id); setSelectedSubject(null) }}
        onSelectSubject={setSelectedSubject}
      />
      {selectedSubject && (
        <SubjectPanel
          subject={subjects.find(s => s.id === selectedSubject.id) ?? selectedSubject}
          turnos={params?.turnos || []}
          onClose={() => setSelectedSubject(null)}
          onUpdate={updated => updateSubject(updated)}
        />
      )}
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<OffersPage />} />
            <Route path="/careers" element={<CareersRoute />} />
            <Route path="/parameters" element={<ParametersPage />} />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  )
}
```

- [ ] **Step 3: Actualizar `CareersPage` para recibir props externalizadas**

`CareersRoute` ahora maneja el estado de `selectedCareerId` y los subjects. `CareersPage` debe aceptarlos como props en lugar de manejarlos internamente. Reemplazar `frontend/src/pages/CareersPage.jsx`:

```jsx
import { useMemo } from 'react'
import { BookOpen, ChevronRight, Loader2 } from 'lucide-react'
import { useCareers } from '@/hooks/useCareers'
import { useState } from 'react'

function TurnosBadge({ allowedTurnos, turnos }) {
  if (!allowedTurnos || allowedTurnos.length === 0) {
    return <span className="text-xs text-gray-400">Todos</span>
  }
  const names = turnos
    .filter(t => allowedTurnos.includes(t.id))
    .map(t => t.name.replace('Turno ', ''))
  return (
    <div className="flex flex-wrap gap-1">
      {names.map(n => (
        <span key={n} className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">{n}</span>
      ))}
    </div>
  )
}

export default function CareersPage({
  params,
  subjects,
  subjectsLoading,
  selectedCareerId,
  onSelectCareer,
  onSelectSubject,
}) {
  const { careers } = useCareers()
  const [search, setSearch] = useState('')

  const filteredCareers = careers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const subjectsByYear = useMemo(() => {
    const grouped = {}
    for (const s of subjects || []) {
      if (!grouped[s.year]) grouped[s.year] = []
      grouped[s.year].push(s)
    }
    return Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b))
  }, [subjects])

  const turnos = params?.turnos || []

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Columna carreras */}
      <div className="w-64 border-r border-gray-200 flex flex-col bg-white shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Carreras</h2>
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filteredCareers.map(c => (
            <button
              key={c.id}
              onClick={() => onSelectCareer(c.id)}
              className={[
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                selectedCareerId === c.id
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
            >
              {c.name}
            </button>
          ))}
          {filteredCareers.length === 0 && (
            <p className="text-xs text-gray-400 px-3 py-4">Sin resultados</p>
          )}
        </div>
      </div>

      {/* Área materias */}
      <div className="flex-1 overflow-y-auto">
        {!selectedCareerId ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <BookOpen className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Seleccioná una carrera</p>
          </div>
        ) : subjectsLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
          </div>
        ) : (subjects || []).length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">Sin materias</p>
          </div>
        ) : (
          <div className="p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-6">
              {careers.find(c => c.id === selectedCareerId)?.name}
            </h1>
            {subjectsByYear.map(([year, subs]) => (
              <div key={year} className="mb-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Año {year}
                </h3>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <tbody>
                      {subs.map((s, i) => (
                        <tr
                          key={s.id}
                          onClick={() => onSelectSubject(s)}
                          className={[
                            'cursor-pointer transition-colors hover:bg-gray-50',
                            i > 0 ? 'border-t border-gray-100' : '',
                          ].join(' ')}
                        >
                          <td className="px-4 py-3 text-sm text-gray-900">{s.name}</td>
                          <td className="px-4 py-3">
                            <TurnosBadge allowedTurnos={s.allowed_turnos} turnos={turnos} />
                          </td>
                          <td className="px-4 py-3 w-8 text-gray-300">
                            <ChevronRight className="h-4 w-4" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verificación manual (code review)**

Verificar:
- `SubjectPanel` inicializa `checked` con todos los IDs si `allowed_turnos` es null
- Al guardar con todos marcados → envía `null` (lógica: `allChecked ? null : checked`)
- `subjects.find(s => s.id === selectedSubject.id) ?? selectedSubject` asegura que el panel refleja el estado actualizado después de guardar
- `onUpdate` llama a `updateSubject` del hook, que actualiza la lista local sin recargar
- El badge en la tabla se actualiza en tiempo real porque `subjects` viene del mismo estado del hook

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/careers/SubjectPanel.jsx frontend/src/App.jsx frontend/src/pages/CareersPage.jsx
git commit -m "feat: SubjectPanel con docentes y configuración de turnos por materia"
```
