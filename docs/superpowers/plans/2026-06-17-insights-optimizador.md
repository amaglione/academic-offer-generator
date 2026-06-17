# Insights del Optimizador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un campo `insights` a la oferta académica que el backend computa al generar y el frontend muestra en un drawer lateral ("Ver resumen").

**Architecture:** `optimizer.py` mejora los reason codes de `unassigned_subjects`. `generate.py` computa `insights` (alertas + estadísticas) después de correr el optimizador y lo persiste en `Offer.insights`. `GET /offers/{id}` lo devuelve via `OfferSchema`. `InsightsDrawer.jsx` lo renderiza; `OffersPage` lo abre con un botón.

**Tech Stack:** Python 3.11 / FastAPI / SQLAlchemy 2.0 / Alembic · React 18 / Tailwind / shadcn/ui / lucide-react

## Global Constraints

- No agregar dependencias npm ni Python nuevas
- Test command: `cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v`
- Alembic command: `cd backend && PYTHONPATH=. .venv/bin/alembic revision --autogenerate -m "add_offer_insights"`
- Apply migration: `cd backend && PYTHONPATH=. .venv/bin/alembic upgrade head`
- Multi-tenant: no cambia — `Offer` ya tiene `tenant_id`
- Ofertas existentes en DB tendrán `insights = null` — el drawer muestra "Sin datos de análisis disponibles"
- El drawer es de solo lectura

---

## File Map

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `backend/app/models/offer.py` | Modify | Agregar `insights = Column(JSON, nullable=True)` |
| `backend/alembic/versions/<hash>_add_offer_insights.py` | Create (autogenerate) | Migración: `op.add_column('offers', Column('insights', JSON))` |
| `backend/app/schemas/offer.py` | Modify | Agregar `insights: Optional[List] = None` a `OfferSchema` |
| `backend/app/routers/offers.py` | Modify | Incluir `insights=offer.insights` en `GET /offers/{offer_id}` |
| `backend/tests/test_offers.py` | Modify | Tests para el campo `insights` en GET /offers/{id} |
| `backend/app/services/optimizer.py` | Modify | Reason codes: "no_valid_slot" y "infeasible" (en vez de "No feasible assignment") |
| `backend/app/routers/generate.py` | Modify | Agregar `_compute_insights()`; llamarla y guardar en `Offer.insights` |
| `backend/tests/test_insights.py` | Create | Unit tests para `_compute_insights` |
| `backend/tests/test_optimizer.py` | Modify | Tests para reason codes de `unassigned_subjects` |
| `frontend/src/components/offers/InsightsDrawer.jsx` | Create | Drawer lateral: sección alertas + sección estadísticas |
| `frontend/src/pages/OffersPage.jsx` | Modify | Botón "Ver resumen" + estado `showInsights` + render `InsightsDrawer` |

---

### Task 1: Backend — `Offer.insights` column + migración + schema + endpoint

**Files:**
- Modify: `backend/app/models/offer.py`
- Create (autogenerate): `backend/alembic/versions/<hash>_add_offer_insights.py`
- Modify: `backend/app/schemas/offer.py`
- Modify: `backend/app/routers/offers.py`
- Modify: `backend/tests/test_offers.py`

**Interfaces:**
- Produces: `OfferSchema.insights: Optional[List[Any]] = None` — campo nullable en la respuesta de `GET /offers/{id}`

---

- [ ] **Step 1: Agregar `insights` al modelo `Offer`**

Reemplazar el contenido de `backend/app/models/offer.py`:

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
    insights = Column(JSON, nullable=True)


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

- [ ] **Step 2: Generar y aplicar la migración Alembic**

```bash
cd backend && PYTHONPATH=. .venv/bin/alembic revision --autogenerate -m "add_offer_insights"
cd backend && PYTHONPATH=. .venv/bin/alembic upgrade head
```

Esperado: `Running upgrade ... -> <hash>, add_offer_insights` sin errores.

- [ ] **Step 3: Agregar `insights` a `OfferSchema`**

Reemplazar el contenido de `backend/app/schemas/offer.py`:

```python
from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime


class CourseSchema(BaseModel):
    id: int
    subject_id: int
    subject_name: Optional[str] = None
    career_id: Optional[int] = None
    career_name: Optional[str] = None
    year: Optional[int] = None
    professor_id: int
    professor_name: Optional[str] = None
    time_slot: dict
    expected_students: int
    manually_modified: bool
    eligible_professors: List[dict] = []


class OfferSchema(BaseModel):
    id: int
    semester: str
    generated_at: datetime
    status: str
    courses: List[CourseSchema] = []
    insights: Optional[List[Any]] = None


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

- [ ] **Step 4: Incluir `insights` en `GET /offers/{offer_id}`**

En `backend/app/routers/offers.py`, reemplazar el return de `get_offer()` (líneas 61-65):

```python
    return OfferSchema(
        id=offer.id, semester=offer.semester, generated_at=offer.generated_at,
        status=offer.status,
        courses=[_enrich_course(c, db) for c in courses],
        insights=offer.insights,
    )
```

- [ ] **Step 5: Escribir tests**

Agregar al final de `backend/tests/test_offers.py`:

```python
def test_get_offer_includes_insights_field(client, auth_headers, db):
    offer = Offer(tenant_id=1, semester="2026-2", status="draft", insights=None)
    db.add(offer)
    db.commit()
    r = client.get(f"/api/offers/{offer.id}", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "insights" in data
    assert data["insights"] is None


def test_get_offer_returns_insights_when_set(client, auth_headers, db):
    test_insights = [
        {"type": "stat", "severity": None, "key": "courses_assigned",
         "title": "Cursos asignados", "value": 5, "items": None}
    ]
    offer = Offer(tenant_id=1, semester="2026-2", status="draft", insights=test_insights)
    db.add(offer)
    db.commit()
    r = client.get(f"/api/offers/{offer.id}", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["insights"] == test_insights
```

- [ ] **Step 6: Correr los tests**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_offers.py -v
```

Esperado: todos los tests existentes pasan + los 2 nuevos en verde.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/offer.py backend/alembic/versions/ \
        backend/app/schemas/offer.py backend/app/routers/offers.py \
        backend/tests/test_offers.py
git commit -m "feat: add insights column to Offer model and expose in GET /offers/{id}"
```

---

### Task 2: Backend — optimizer reason codes + `_compute_insights` en `generate.py`

**Files:**
- Modify: `backend/app/services/optimizer.py`
- Modify: `backend/app/routers/generate.py`
- Create: `backend/tests/test_insights.py`
- Modify: `backend/tests/test_optimizer.py`

**Interfaces:**
- Consumes: `optimizer.run_optimizer()` retorna `{"status", "assignments", "unassigned_subjects"}` igual que antes, pero ahora `reason` es `"no_valid_slot"` o `"infeasible"` (en vez de `"No feasible assignment"`)
- Consumes: `demand` — lista de `{"subject_id", "name", "year", "career_id", "demand", "num_courses", "eligible_professor_ids", "allowed_turnos"}`; `professors` — lista de `{"id", "name"}`; `params` — dict con `max_weekly_hours_per_professor`, `available_classrooms`, `solver_timeout_seconds`
- Produces: `_compute_insights(demand, result, professors, params) -> list[dict]` — cada elemento con keys `type`, `severity`, `key`, `title`, `value`, `items`

---

- [ ] **Step 1: Cambiar reason codes en `optimizer.py` + mejorar comportamiento parcial**

El comportamiento actual: si UN curso no tiene slots válidos, devuelve TODOS los cursos como infeasibles inmediatamente. El nuevo comportamiento: los cursos sin slots válidos se registran como "no_valid_slot" y el solver corre igual para el resto.

Reemplazar el contenido de `backend/app/services/optimizer.py`:

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
                "allowed_turnos": item.get("allowed_turnos"),
            })

    num_courses = len(courses)
    num_slots = len(time_slots)
    prof_by_id = {p["id"]: i for i, p in enumerate(professors)}
    num_professors = len(professors)

    # x[c, p, s] = 1 if course c is taught by professor p at slot s
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

    # Each course assigned to exactly one (professor, slot).
    # Courses with no valid (professor, slot) pair are collected as no_valid_slot
    # and excluded from the model; the solver runs for the rest.
    no_valid_slot_subjects = []
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
        else:
            no_valid_slot_subjects.append(
                {"subject_id": course["subject_id"], "reason": "no_valid_slot"}
            )

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

    # Objective: minimize same-year/career slot conflicts + slot overload
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
            "unassigned_subjects": no_valid_slot_subjects,
        }

    no_valid_slot_ids = {u["subject_id"] for u in no_valid_slot_subjects}
    return {
        "status": "infeasible",
        "assignments": [],
        "unassigned_subjects": no_valid_slot_subjects + [
            {"subject_id": c["subject_id"], "reason": "infeasible"}
            for c in courses
            if c["subject_id"] not in no_valid_slot_ids
        ],
    }
```

- [ ] **Step 2: Agregar tests de reason codes en `test_optimizer.py`**

Agregar al final de `backend/tests/test_optimizer.py`:

```python
SLOTS_WITH_TURNO = [
    {"id": i, "turno_id": 1, "turno_name": "Mañana", "day": i % 5, "day_name": "Lunes",
     "start_hour": 8 + (i // 5) * 2, "end_hour": 10 + (i // 5) * 2, "duration_hours": 2}
    for i in range(10)
]


def test_no_valid_slot_reason():
    demand = [{
        "subject_id": 1, "name": "Álgebra", "year": 1, "career_id": 1,
        "demand": 10, "num_courses": 1, "eligible_professor_ids": [1],
        "allowed_turnos": [999],  # turno_id 999 no existe en SLOTS_WITH_TURNO
    }]
    result = run_optimizer(demand, PROFESSORS, SLOTS_WITH_TURNO, PARAMS)
    assert result["status"] == "optimal"  # solver corre sin cursos → trivialmente óptimo
    assert len(result["assignments"]) == 0
    assert len(result["unassigned_subjects"]) == 1
    assert result["unassigned_subjects"][0]["subject_id"] == 1
    assert result["unassigned_subjects"][0]["reason"] == "no_valid_slot"


def test_partial_no_valid_slot_assigns_rest():
    demand = [
        {
            "subject_id": 1, "name": "Sin turno", "year": 1, "career_id": 1,
            "demand": 10, "num_courses": 1, "eligible_professor_ids": [1],
            "allowed_turnos": [999],
        },
        {
            "subject_id": 2, "name": "Con turno", "year": 2, "career_id": 1,
            "demand": 10, "num_courses": 1, "eligible_professor_ids": [2],
        },
    ]
    result = run_optimizer(demand, PROFESSORS, SLOTS_WITH_TURNO, PARAMS)
    assert result["status"] in ("optimal", "feasible")
    assert len(result["assignments"]) == 1
    assert result["assignments"][0]["subject_id"] == 2
    unassigned_ids = [u["subject_id"] for u in result["unassigned_subjects"]]
    assert 1 in unassigned_ids
    assert result["unassigned_subjects"][0]["reason"] == "no_valid_slot"


def test_infeasible_reason_when_global_infeasible():
    params = {**PARAMS, "available_classrooms": 0}
    demand = [{"subject_id": 1, "name": "A", "year": 1, "career_id": 1,
               "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]}]
    result = run_optimizer(demand, PROFESSORS, SLOTS, params)
    assert result["status"] == "infeasible"
    assert result["unassigned_subjects"][0]["reason"] == "infeasible"
```

- [ ] **Step 3: Correr tests del optimizer**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_optimizer.py -v
```

Esperado: todos los tests pasan (incluyendo los 3 nuevos).

- [ ] **Step 4: Agregar `_compute_insights` en `generate.py`**

Reemplazar el contenido de `backend/app/routers/generate.py`:

```python
from collections import defaultdict
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.dependencies import get_current_user
from app.models.tenant import User
from app.models.offer import Offer, Course
from app.schemas.job import JobResponse
from app.services import job_store, data_layer, demand_analyzer, optimizer, parameter_service

router = APIRouter()


def _compute_insights(
    demand: list[dict],
    result: dict,
    professors: list[dict],
    params: dict,
) -> list[dict]:
    insights = []
    status = result["status"]
    assignments = result["assignments"]
    unassigned = result.get("unassigned_subjects", [])

    prof_by_id = {p["id"]: p["name"] for p in professors}
    demand_by_subject = {d["subject_id"]: d for d in demand}

    # Alert: solver timeout (FEASIBLE = encontró solución pero no óptima)
    if status == "feasible":
        insights.append({
            "type": "alert",
            "severity": "warning",
            "key": "solver_timeout",
            "title": "Solución no óptima",
            "value": (
                f"El solver alcanzó el límite de {params['solver_timeout_seconds']} segundos. "
                "Puede existir una mejor distribución."
            ),
            "items": None,
        })

    # Alert: materias sin asignar
    if unassigned:
        reason_labels = {
            "no_valid_slot": "Turno restringido",
            "infeasible": "Sin solución",
            "No feasible assignment": "Sin solución",
        }
        seen = set()
        items = []
        for u in unassigned:
            sid = u["subject_id"]
            if sid in seen:
                continue
            seen.add(sid)
            d = demand_by_subject.get(sid, {})
            items.append({
                "name": d.get("name", f"Materia {sid}"),
                "demand": d.get("demand", 0),
                "reason": reason_labels.get(u.get("reason", "infeasible"), "Sin solución"),
            })
        insights.append({
            "type": "alert",
            "severity": "error",
            "key": "unassigned_subjects",
            "title": f"{len(items)} materia(s) sin asignar",
            "value": None,
            "items": items,
        })

    # Stat: total cursos asignados (siempre presente)
    insights.append({
        "type": "stat",
        "severity": None,
        "key": "courses_assigned",
        "title": "Cursos asignados",
        "value": len(assignments),
        "items": None,
    })

    if not assignments:
        return insights

    # Alert: solapamiento horario (mismo año/carrera en mismo slot)
    subject_meta = {d["subject_id"]: {"year": d["year"], "career_id": d["career_id"]} for d in demand}
    year_career_slot = defaultdict(list)
    for a in assignments:
        meta = subject_meta.get(a["subject_id"], {})
        year = meta.get("year")
        career_id = meta.get("career_id")
        if year is not None and career_id is not None:
            slot = a["time_slot"]
            key = (year, career_id, slot.get("day"), slot.get("start_hour"))
            year_career_slot[key].append(a["subject_id"])
    conflicts = sum(1 for courses_in_slot in year_career_slot.values() if len(courses_in_slot) > 1)
    if conflicts > 0:
        insights.append({
            "type": "alert",
            "severity": "warning",
            "key": "slot_conflicts",
            "title": "Solapamiento de horarios",
            "value": f"{conflicts} franja(s) con materias del mismo año/carrera superpuestas.",
            "items": None,
        })

    # Alert: docentes con alta carga (>= 80% del límite semanal)
    prof_hours: dict[int, float] = defaultdict(float)
    for a in assignments:
        prof_hours[a["professor_id"]] += a["time_slot"].get("duration_hours", 0)
    hours_limit = params["max_weekly_hours_per_professor"]
    overloaded = [
        {
            "name": prof_by_id.get(pid, f"Docente {pid}"),
            "hours_assigned": round(hrs, 1),
            "hours_limit": hours_limit,
        }
        for pid, hrs in prof_hours.items()
        if hrs >= 0.8 * hours_limit
    ]
    if overloaded:
        insights.append({
            "type": "alert",
            "severity": "warning",
            "key": "professor_overload",
            "title": f"{len(overloaded)} docente(s) con alta carga horaria",
            "value": None,
            "items": overloaded,
        })

    # Stat: distribución por turno
    slot_dist: dict[str, int] = defaultdict(int)
    for a in assignments:
        turno_name = a["time_slot"].get("turno_name", "Sin turno")
        slot_dist[turno_name] += 1
    insights.append({
        "type": "stat",
        "severity": None,
        "key": "slot_distribution",
        "title": "Distribución por turno",
        "value": None,
        "items": [{"name": k, "count": v} for k, v in sorted(slot_dist.items())],
    })

    # Stat: pico de aulas (máx. cursos simultáneos en un mismo slot día/hora)
    slot_counts: dict[tuple, int] = defaultdict(int)
    for a in assignments:
        slot = a["time_slot"]
        key = (slot.get("day"), slot.get("start_hour"))
        slot_counts[key] += 1
    peak = max(slot_counts.values()) if slot_counts else 0
    insights.append({
        "type": "stat",
        "severity": None,
        "key": "classroom_peak",
        "title": "Pico de aulas",
        "value": None,
        "items": [{"peak": peak, "limit": params["available_classrooms"]}],
    })

    return insights


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
        insights = _compute_insights(demand, result, professors, params)

        offer = Offer(tenant_id=tenant_id, semester=semester, status="draft", insights=insights)
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

- [ ] **Step 5: Crear `backend/tests/test_insights.py`**

```python
from app.routers.generate import _compute_insights

PROFESSORS = [{"id": 1, "name": "Prof García"}, {"id": 2, "name": "Prof López"}]
PARAMS = {
    "max_students_per_course": 40,
    "max_weekly_hours_per_professor": 30,
    "available_classrooms": 10,
    "solver_timeout_seconds": 30,
}
SLOT_MANANA = {"day": 0, "start_hour": 8, "duration_hours": 2, "turno_name": "Mañana"}
SLOT_TARDE = {"day": 0, "start_hour": 14, "duration_hours": 2, "turno_name": "Tarde"}


def _result(status="optimal", assignments=None, unassigned=None):
    return {"status": status, "assignments": assignments or [], "unassigned_subjects": unassigned or []}


def test_courses_assigned_zero_when_no_assignments():
    demand = [{"subject_id": 1, "name": "Álgebra", "year": 1, "career_id": 1,
               "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]}]
    insights = _compute_insights(demand, _result(), PROFESSORS, PARAMS)
    stat = next(i for i in insights if i["key"] == "courses_assigned")
    assert stat["value"] == 0


def test_solver_timeout_alert_when_feasible_status():
    demand = [{"subject_id": 1, "name": "Álgebra", "year": 1, "career_id": 1,
               "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]}]
    result = _result(
        status="feasible",
        assignments=[{"subject_id": 1, "professor_id": 1, "time_slot": SLOT_MANANA, "expected_students": 30}],
    )
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    alert = next((i for i in insights if i["key"] == "solver_timeout"), None)
    assert alert is not None
    assert alert["severity"] == "warning"
    assert "30 segundos" in alert["value"]


def test_no_solver_timeout_alert_when_optimal():
    demand = [{"subject_id": 1, "name": "Álgebra", "year": 1, "career_id": 1,
               "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]}]
    result = _result(
        status="optimal",
        assignments=[{"subject_id": 1, "professor_id": 1, "time_slot": SLOT_MANANA, "expected_students": 30}],
    )
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    assert not any(i["key"] == "solver_timeout" for i in insights)


def test_unassigned_subjects_alert_enriches_name_and_demand():
    demand = [{"subject_id": 5, "name": "Física II", "year": 2, "career_id": 1,
               "demand": 47, "num_courses": 1, "eligible_professor_ids": [1]}]
    result = _result(unassigned=[{"subject_id": 5, "reason": "no_valid_slot"}])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    alert = next(i for i in insights if i["key"] == "unassigned_subjects")
    assert alert["severity"] == "error"
    assert alert["items"][0]["name"] == "Física II"
    assert alert["items"][0]["demand"] == 47
    assert alert["items"][0]["reason"] == "Turno restringido"


def test_unassigned_infeasible_reason_label():
    demand = [{"subject_id": 1, "name": "Álgebra", "year": 1, "career_id": 1,
               "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]}]
    result = _result(unassigned=[{"subject_id": 1, "reason": "infeasible"}])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    alert = next(i for i in insights if i["key"] == "unassigned_subjects")
    assert alert["items"][0]["reason"] == "Sin solución"


def test_unassigned_subjects_deduplicates_by_subject():
    demand = [{"subject_id": 1, "name": "Álgebra", "year": 1, "career_id": 1,
               "demand": 30, "num_courses": 2, "eligible_professor_ids": [1]}]
    result = _result(unassigned=[
        {"subject_id": 1, "reason": "infeasible"},
        {"subject_id": 1, "reason": "infeasible"},
    ])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    alert = next(i for i in insights if i["key"] == "unassigned_subjects")
    assert len(alert["items"]) == 1


def test_slot_conflict_alert_same_year_career_same_slot():
    demand = [
        {"subject_id": 1, "name": "A", "year": 1, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]},
        {"subject_id": 2, "name": "B", "year": 1, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [2]},
    ]
    result = _result(assignments=[
        {"subject_id": 1, "professor_id": 1, "time_slot": SLOT_MANANA, "expected_students": 30},
        {"subject_id": 2, "professor_id": 2, "time_slot": SLOT_MANANA, "expected_students": 30},
    ])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    alert = next((i for i in insights if i["key"] == "slot_conflicts"), None)
    assert alert is not None
    assert "1 franja" in alert["value"]


def test_no_slot_conflict_when_different_year():
    demand = [
        {"subject_id": 1, "name": "A", "year": 1, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]},
        {"subject_id": 2, "name": "B", "year": 2, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [2]},
    ]
    result = _result(assignments=[
        {"subject_id": 1, "professor_id": 1, "time_slot": SLOT_MANANA, "expected_students": 30},
        {"subject_id": 2, "professor_id": 2, "time_slot": SLOT_MANANA, "expected_students": 30},
    ])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    assert not any(i["key"] == "slot_conflicts" for i in insights)


def test_professor_overload_alert_when_above_80_percent():
    demand = [{"subject_id": 1, "name": "A", "year": 1, "career_id": 1,
               "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]}]
    # 25h de 30h límite = 83% → alerta
    result = _result(assignments=[
        {"subject_id": 1, "professor_id": 1,
         "time_slot": {"day": 0, "start_hour": 8, "duration_hours": 25.0, "turno_name": "Mañana"},
         "expected_students": 30},
    ])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    alert = next((i for i in insights if i["key"] == "professor_overload"), None)
    assert alert is not None
    assert alert["items"][0]["name"] == "Prof García"
    assert alert["items"][0]["hours_assigned"] == 25.0


def test_no_professor_overload_when_below_80_percent():
    demand = [{"subject_id": 1, "name": "A", "year": 1, "career_id": 1,
               "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]}]
    # 10h de 30h límite = 33% → sin alerta
    result = _result(assignments=[
        {"subject_id": 1, "professor_id": 1, "time_slot": SLOT_MANANA, "expected_students": 30},
    ])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    assert not any(i["key"] == "professor_overload" for i in insights)


def test_slot_distribution_counts_by_turno_name():
    demand = [
        {"subject_id": 1, "name": "A", "year": 1, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]},
        {"subject_id": 2, "name": "B", "year": 2, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [2]},
    ]
    result = _result(assignments=[
        {"subject_id": 1, "professor_id": 1, "time_slot": SLOT_MANANA, "expected_students": 30},
        {"subject_id": 2, "professor_id": 2, "time_slot": SLOT_TARDE, "expected_students": 30},
    ])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    stat = next(i for i in insights if i["key"] == "slot_distribution")
    dist = {item["name"]: item["count"] for item in stat["items"]}
    assert dist["Mañana"] == 1
    assert dist["Tarde"] == 1


def test_classroom_peak_two_concurrent_courses():
    demand = [
        {"subject_id": 1, "name": "A", "year": 1, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]},
        {"subject_id": 2, "name": "B", "year": 2, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [2]},
    ]
    result = _result(assignments=[
        {"subject_id": 1, "professor_id": 1, "time_slot": SLOT_MANANA, "expected_students": 30},
        {"subject_id": 2, "professor_id": 2, "time_slot": SLOT_MANANA, "expected_students": 30},
    ])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    stat = next(i for i in insights if i["key"] == "classroom_peak")
    assert stat["items"][0]["peak"] == 2
    assert stat["items"][0]["limit"] == 10
```

- [ ] **Step 6: Correr los tests**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_insights.py tests/test_optimizer.py -v
```

Esperado: todos los tests nuevos en verde.

- [ ] **Step 7: Correr toda la suite**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v
```

Esperado: todos los tests pasan.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/optimizer.py backend/app/routers/generate.py \
        backend/tests/test_insights.py backend/tests/test_optimizer.py
git commit -m "feat: compute and persist offer insights in generate.py"
```

---

### Task 3: Frontend — `InsightsDrawer` + botón en `OffersPage`

**Files:**
- Create: `frontend/src/components/offers/InsightsDrawer.jsx`
- Modify: `frontend/src/pages/OffersPage.jsx`

**Interfaces:**
- Consumes: `offer.insights` — `Array | null` proveniente del hook `useOffer` (que llama `GET /offers/{id}`)
- `InsightsDrawer` props: `insights: Array | null`, `onClose: () => void`

---

- [ ] **Step 1: Crear `frontend/src/components/offers/InsightsDrawer.jsx`**

```jsx
import { X, AlertCircle, AlertTriangle } from 'lucide-react'

const REASON_LABELS = {
  no_professors: 'Sin docentes',
  no_valid_slot: 'Turno restringido',
  infeasible: 'Sin solución',
  'No feasible assignment': 'Sin solución',
}

const SEVERITY_ICONS = {
  error: <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
}

function AlertItem({ insight }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
      <div className="flex gap-2.5">
        {SEVERITY_ICONS[insight.severity]}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">{insight.title}</p>
          {insight.value && <p className="text-xs text-gray-500 mt-0.5">{insight.value}</p>}

          {insight.key === 'unassigned_subjects' && insight.items?.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {insight.items.map((item, i) => (
                <div key={i} className="flex items-center text-xs text-gray-600 gap-1.5">
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="text-gray-400 shrink-0">{item.demand} alumnos</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-400 shrink-0">
                    {REASON_LABELS[item.reason] ?? item.reason}
                  </span>
                </div>
              ))}
            </div>
          )}

          {insight.key === 'professor_overload' && insight.items?.length > 0 && (
            <div className="mt-2 space-y-2">
              {insight.items.map((item, i) => (
                <div key={i} className="text-xs text-gray-600">
                  <div className="flex justify-between mb-0.5">
                    <span className="truncate">{item.name}</span>
                    <span className="text-gray-400 shrink-0 ml-2">
                      {item.hours_assigned}h / {item.hours_limit}h
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${Math.min(100, (item.hours_assigned / item.hours_limit) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatItem({ insight }) {
  if (insight.key === 'courses_assigned') {
    return (
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{insight.title}</p>
        <p className="text-2xl font-semibold text-gray-900 mt-1">{insight.value}</p>
      </div>
    )
  }
  if (insight.key === 'slot_distribution') {
    return (
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{insight.title}</p>
        <div className="space-y-1">
          {(insight.items ?? []).map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{item.name}</span>
              <span className="font-medium text-gray-800">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (insight.key === 'classroom_peak') {
    const item = insight.items?.[0] ?? { peak: 0, limit: 0 }
    const pct = item.limit > 0 ? Math.round((item.peak / item.limit) * 100) : 0
    const isCritical = pct > 80
    return (
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{insight.title}</p>
        <div className="flex items-end gap-2">
          <span className={`text-2xl font-semibold ${isCritical ? 'text-amber-600' : 'text-gray-900'}`}>
            {item.peak}
          </span>
          <span className="text-sm text-gray-400 mb-0.5">/ {item.limit} aulas ({pct}%)</span>
        </div>
      </div>
    )
  }
  return null
}

export default function InsightsDrawer({ insights, onClose }) {
  const alerts = (insights ?? [])
    .filter(i => i.type === 'alert')
    .sort((a, b) => {
      const order = { error: 0, warning: 1, info: 2 }
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3)
    })
  const stats = (insights ?? []).filter(i => i.type === 'stat')

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-xl border-l border-gray-200 z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 shrink-0">
        <h2 className="text-sm font-semibold text-gray-900">Resumen de la oferta</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded p-0.5">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {!insights ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin datos de análisis disponibles</p>
        ) : (
          <>
            {alerts.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Alertas
                </h3>
                <div className="space-y-2">
                  {alerts.map((insight, i) => <AlertItem key={i} insight={insight} />)}
                </div>
              </section>
            )}

            {stats.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Estadísticas
                </h3>
                <div className="space-y-2">
                  {stats.map((insight, i) => <StatItem key={i} insight={insight} />)}
                </div>
              </section>
            )}

            {alerts.length === 0 && stats.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Sin datos de análisis disponibles</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Modificar `OffersPage.jsx`**

Reemplazar el contenido de `frontend/src/pages/OffersPage.jsx`:

```jsx
import { useState } from 'react'
import { RefreshCw, Check, Loader2, AlertCircle, Download, RotateCcw, BarChart2 } from 'lucide-react'
import { toast } from 'sonner'
import { useOffer } from '@/hooks/useOffer'
import { useParameters } from '@/hooks/useParameters'
import CalendarGrid from '@/components/calendar/CalendarGrid'
import CareerFilter from '@/components/shared/CareerFilter'
import StatusBadge from '@/components/shared/StatusBadge'
import CourseEditModal from '@/components/calendar/CourseEditModal'
import InsightsDrawer from '@/components/offers/InsightsDrawer'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function OffersPage() {
  const { offer, offers, generating, jobError, generate, approve, reopen, exportOffer, patchCourse } = useOffer()
  const { params } = useParameters()
  const [selectedCareerIds, setSelectedCareerIds] = useState([])
  const [editingCourse, setEditingCourse] = useState(null)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const [confirmReopen, setConfirmReopen] = useState(false)
  const [showInsights, setShowInsights] = useState(false)

  const careers = [
    ...new Map(
      (offer?.courses || [])
        .filter(c => c.career_id)
        .map(c => [c.career_id, { id: c.career_id, name: c.career_name || `Carrera ${c.career_id}` }])
    ).values(),
  ]

  const coursesWithYear = (offer?.courses || []).map(c => ({ ...c, year: c.year || 1 }))
  const timeSlots = params?.time_slots || []
  const isDraft = offer?.status === 'draft'
  const isPublished = offer?.status === 'published'
  const noOffer = !offer && !generating

  async function handleCourseDrop(courseId, newSlot) {
    const course = offer.courses.find(c => c.id === courseId)
    if (course) {
      const conflict = offer.courses.find(c =>
        c.id !== courseId &&
        c.professor_id === course.professor_id &&
        c.time_slot?.day === newSlot.day &&
        c.time_slot?.turno_id === newSlot.turno_id
      )
      if (conflict) {
        toast.error(`${course.professor_name} ya tiene un curso en esa franja`)
        return
      }

      const coursesInSlot = offer.courses.filter(c =>
        c.id !== courseId &&
        c.time_slot?.day === newSlot.day &&
        c.time_slot?.turno_id === newSlot.turno_id
      )
      if (coursesInSlot.length >= params.available_classrooms) {
        toast.error('No hay aulas disponibles en esa franja')
        return
      }
    }
    await patchCourse(courseId, { time_slot: newSlot })
    toast.success('Curso movido')
  }

  async function handleApprove() {
    await approve()
    toast.success('Oferta aprobada y publicada')
  }

  async function handleReopen() {
    setConfirmReopen(false)
    await reopen()
    toast.success('Oferta reabierta como borrador')
  }

  async function handleGenerate() {
    setConfirmRegenerate(false)
    await generate()
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-gray-900">
            {offer ? `Oferta ${offer.semester}` : 'Calendario'}
          </h1>
          {offer && <StatusBadge status={offer.status} />}
          {offer && (
            <span className="text-sm text-gray-400">{offer.courses?.length || 0} cursos</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <CareerFilter careers={careers} selected={selectedCareerIds} onChange={setSelectedCareerIds} />

          {offer && (
            <Button variant="outline" size="sm" onClick={() => setShowInsights(true)}>
              <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
              Ver resumen
            </Button>
          )}

          {noOffer && (
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              Generar oferta
            </Button>
          )}

          {offer && isDraft && (
            <Button variant="outline" size="sm" onClick={() => setConfirmRegenerate(true)} disabled={generating}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Regenerar
            </Button>
          )}

          {isDraft && (
            <Button size="sm" onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Aprobar oferta
            </Button>
          )}

          {isPublished && (
            <>
              <Button variant="outline" size="sm" onClick={() => setConfirmReopen(true)}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reabrir
              </Button>
              <Button variant="outline" size="sm" onClick={exportOffer}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Exportar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Error del job */}
      {jobError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Error al generar: {jobError}
        </div>
      )}

      {/* Generando */}
      {generating && (
        <div className="flex flex-col items-center justify-center py-28 text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400 mb-4" />
          <p className="font-medium text-gray-600">Ejecutando optimizador...</p>
          <p className="text-sm mt-1">Esto puede tardar varios minutos.</p>
        </div>
      )}

      {/* Sin oferta */}
      {noOffer && (
        <div className="flex flex-col items-center justify-center py-28 text-gray-400">
          <p className="text-lg font-medium text-gray-500">No hay oferta generada</p>
          <p className="text-sm mt-1">Hacé clic en "Generar oferta" para comenzar.</p>
        </div>
      )}

      {/* Calendario */}
      {!generating && offer && timeSlots.length > 0 && (
        <CalendarGrid
          courses={coursesWithYear}
          timeSlots={timeSlots}
          selectedCareerIds={selectedCareerIds}
          onCourseClick={isDraft ? setEditingCourse : () => {}}
          onCourseDrop={handleCourseDrop}
          draggable={isDraft}
        />
      )}

      {/* Confirm regenerar */}
      <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Regenerar oferta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto descartará el borrador actual y todos los ajustes manuales. La acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerate} className="bg-red-600 hover:bg-red-700">
              Regenerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm reabrir */}
      <AlertDialog open={confirmReopen} onOpenChange={setConfirmReopen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reabrir oferta?</AlertDialogTitle>
            <AlertDialogDescription>
              La oferta volverá a estado borrador. Los cursos se mantienen tal cual están.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReopen}>
              Reabrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal edición */}
      {editingCourse && (
        <CourseEditModal
          course={editingCourse}
          allCourses={offer.courses}
          onClose={() => setEditingCourse(null)}
          onSave={updates => patchCourse(editingCourse.id, updates)}
        />
      )}

      {/* Insights drawer */}
      {showInsights && (
        <InsightsDrawer
          insights={offer?.insights ?? null}
          onClose={() => setShowInsights(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verificar build del frontend**

```bash
cd frontend && npm run build
```

Esperado: `✓ built in XXXms` sin errores ni warnings de imports faltantes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/offers/InsightsDrawer.jsx \
        frontend/src/pages/OffersPage.jsx
git commit -m "feat: InsightsDrawer lateral con alertas y estadísticas de la oferta"
```
