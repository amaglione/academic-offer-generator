# Turnos Configurables y Validación de Aulas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded time slots with admin-configurable turnos (name, start/end, days Mon-Sat), and validate classroom availability when manually moving courses in the calendar.

**Architecture:** Add a `turnos` JSON column to both parameter tables via Alembic migration; `get_effective_parameters` generates `time_slots` at runtime from `turnos`. The optimizer and calendar consume `time_slots` as before — only CalendarGrid rows change from hour-based to turno-based. Classroom validation is a frontend-only check in `handleCourseDrop`, parallel to the existing professor conflict check.

**Tech Stack:** Python 3.11 / FastAPI / SQLAlchemy 2.0 / Alembic (backend) · React 18 / Tailwind / shadcn/ui / dnd-kit (frontend) · pytest / SQLite (tests)

## Global Constraints

- No new npm packages
- Days encoding: 0=Lunes, 1=Martes, 2=Miércoles, 3=Jueves, 4=Viernes, 5=Sábado
- Default turnos: `[{id:1, name:"Turno mañana", start_hour:8, end_hour:12, days:[0,1,2,3,4]}, {id:2, name:"Turno tarde", start_hour:14, end_hour:18, days:[0,1,2,3,4]}, {id:3, name:"Turno noche", start_hour:19, end_hour:23, days:[0,1,2,3,4]}]`
- Sábado (day=5) disabled by default in all turnos
- Generated time_slot shape: `{id, turno_id, turno_name, day, day_name, start_hour, end_hour, duration_hours}`
- CalendarGrid slot key: `${turno_id}-${day}` (not `${day}-${start_hour}`)
- SlotCell droppable id: `${turno_id}-${day}`
- Backend test command: `cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v`
- Alembic command: `cd backend && PYTHONPATH=. .venv/bin/alembic revision --autogenerate -m "add_turnos"`

---

## File Map

| File | Change |
|---|---|
| `backend/app/models/parameters.py` | Add `DEFAULT_TURNOS`, `turnos` column to both models, keep `DEFAULT_TIME_SLOTS` generated from `DEFAULT_TURNOS` |
| `backend/alembic/versions/<hash>_add_turnos.py` | New migration: ADD COLUMN turnos JSON to both tables |
| `backend/app/services/parameter_service.py` | Add `generate_time_slots()`, add `"turnos"` to `PARAM_FIELDS`, generate `time_slots` in `get_effective_parameters` |
| `backend/app/schemas/parameters.py` | Add `TurnoSchema`, `turnos` field to `ParametersResponse` and `ParametersUpdate` |
| `backend/app/routers/parameters.py` | Update `update_parameters` to handle `turnos` serialization |
| `backend/tests/test_parameters.py` | Add tests for turnos default, save, and time_slot generation |
| `frontend/src/pages/ParametersPage.jsx` | Add `TurnosCard` component with inline CRUD |
| `frontend/src/components/calendar/CalendarGrid.jsx` | Rows by turno, columns by unique days, new slot key |
| `frontend/src/components/calendar/SlotCell.jsx` | New `turnoId` prop, id uses `${turnoId}-${day}` |
| `frontend/src/pages/OffersPage.jsx` | Add classroom availability check in `handleCourseDrop` |

---

### Task 1: Backend — `generate_time_slots` and turno model

Add `DEFAULT_TURNOS`, update `DEFAULT_TIME_SLOTS` to be generated from it, add `turnos` column to both models, add `generate_time_slots()` to parameter service, and wire into `get_effective_parameters`.

**Files:**
- Modify: `backend/app/models/parameters.py`
- Modify: `backend/app/services/parameter_service.py`
- Test: `backend/tests/test_parameters.py`

**Interfaces:**
- Produces: `generate_time_slots(turnos: list[dict]) -> list[dict]` — importable from `parameter_service`
- Produces: `DEFAULT_TURNOS: list[dict]` — importable from `models.parameters`
- Produces: `get_effective_parameters` now returns `turnos` and regenerates `time_slots` from them

---

- [ ] **Step 1: Write failing tests**

Add to `backend/tests/test_parameters.py`:

```python
def test_get_parameters_includes_turnos(client, auth_headers):
    r = client.get("/api/parameters", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "turnos" in data
    assert len(data["turnos"]) == 3
    assert data["turnos"][0]["name"] == "Turno mañana"
    assert data["turnos"][0]["start_hour"] == 8
    assert data["turnos"][0]["end_hour"] == 12
    assert data["turnos"][0]["days"] == [0, 1, 2, 3, 4]


def test_time_slots_generated_from_turnos(client, auth_headers):
    r = client.get("/api/parameters", headers=auth_headers)
    data = r.json()
    # 3 default turnos × 5 days each = 15 slots
    assert len(data["time_slots"]) == 15
    first = data["time_slots"][0]
    assert "turno_id" in first
    assert "turno_name" in first
    assert first["turno_name"] == "Turno mañana"
    assert first["start_hour"] == 8
    assert first["end_hour"] == 12
    assert first["duration_hours"] == 4


def test_generate_time_slots_function():
    from app.services.parameter_service import generate_time_slots
    turnos = [
        {"id": 1, "name": "Mañana", "start_hour": 8, "end_hour": 12, "days": [0, 5]},
    ]
    slots = generate_time_slots(turnos)
    assert len(slots) == 2
    assert slots[0]["turno_id"] == 1
    assert slots[0]["turno_name"] == "Mañana"
    assert slots[0]["day"] == 0
    assert slots[0]["day_name"] == "Lunes"
    assert slots[0]["duration_hours"] == 4
    assert slots[1]["day"] == 5
    assert slots[1]["day_name"] == "Sábado"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_parameters.py::test_get_parameters_includes_turnos tests/test_parameters.py::test_time_slots_generated_from_turnos tests/test_parameters.py::test_generate_time_slots_function -v
```

Expected: FAIL — `turnos` key missing, `generate_time_slots` not found.

- [ ] **Step 3: Update `backend/app/models/parameters.py`**

Replace the file with:

```python
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
```

- [ ] **Step 4: Update `backend/app/services/parameter_service.py`**

Replace the file with:

```python
from sqlalchemy.orm import Session
from app.models.parameters import GlobalParameters, TenantParameters, DEFAULT_TURNOS

PARAM_FIELDS = [
    "max_students_per_course",
    "max_weekly_hours_per_professor",
    "available_classrooms",
    "solver_timeout_seconds",
    "turnos",
]

DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]


def generate_time_slots(turnos: list[dict]) -> list[dict]:
    slots = []
    slot_id = 0
    for turno in turnos:
        for day in turno["days"]:
            slots.append({
                "id": slot_id,
                "turno_id": turno["id"],
                "turno_name": turno["name"],
                "day": day,
                "day_name": DAY_NAMES[day],
                "start_hour": turno["start_hour"],
                "end_hour": turno["end_hour"],
                "duration_hours": turno["end_hour"] - turno["start_hour"],
            })
            slot_id += 1
    return slots


def get_effective_parameters(db: Session, tenant_id: int) -> dict:
    global_params = db.query(GlobalParameters).filter(GlobalParameters.id == 1).first()
    tenant_params = db.query(TenantParameters).filter(TenantParameters.tenant_id == tenant_id).first()

    result = {field: getattr(global_params, field) for field in PARAM_FIELDS}
    if result["turnos"] is None:
        result["turnos"] = DEFAULT_TURNOS

    if tenant_params:
        for field in PARAM_FIELDS:
            override = getattr(tenant_params, field, None)
            if override is not None:
                result[field] = override

    result["time_slots"] = generate_time_slots(result["turnos"])
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

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_parameters.py::test_get_parameters_includes_turnos tests/test_parameters.py::test_time_slots_generated_from_turnos tests/test_parameters.py::test_generate_time_slots_function -v
```

Expected: PASS

- [ ] **Step 6: Run full test suite**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v
```

Expected: all tests PASS (some time_slot count assertions may need updating — see Step 7).

Note: `test_get_parameters_returns_defaults` asserts `len(data["time_slots"]) > 0` — this will still pass. No other existing tests assert on time_slot count.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/parameters.py backend/app/services/parameter_service.py backend/tests/test_parameters.py
git commit -m "feat: generate time_slots from configurable turnos — DEFAULT_TURNOS + generate_time_slots()"
```

---

### Task 2: Alembic migration — add `turnos` column

Create the Alembic migration that adds the `turnos` JSON column to both parameter tables.

**Files:**
- Create: `backend/alembic/versions/<hash>_add_turnos.py`

**Interfaces:**
- Consumes: Task 1's model changes (the `turnos` column on both models)
- Produces: migration that can be applied with `alembic upgrade head`

---

- [ ] **Step 1: Generate migration**

```bash
cd backend && PYTHONPATH=. .venv/bin/alembic revision --autogenerate -m "add_turnos"
```

Expected: creates a new file in `backend/alembic/versions/` with `add_turnos` in the name.

- [ ] **Step 2: Inspect the generated migration**

Open the generated file and verify it contains:
```python
op.add_column('global_parameters', sa.Column('turnos', sa.JSON(), nullable=True))
op.add_column('tenant_parameters', sa.Column('turnos', sa.JSON(), nullable=True))
```

If the migration is empty or wrong, write it manually using the above two `op.add_column` calls in `upgrade()` and the corresponding `op.drop_column` calls in `downgrade()`.

- [ ] **Step 3: Apply migration to test DB**

```bash
cd backend && PYTHONPATH=. .venv/bin/alembic upgrade head
```

Expected: `Running upgrade 2c196b5b4d21 -> <new_hash>, add_turnos`

- [ ] **Step 4: Run full test suite**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/
git commit -m "chore: alembic migration — add turnos column to parameter tables"
```

---

### Task 3: Backend schemas and router — expose turnos in API

Update `ParametersResponse` and `ParametersUpdate` to include `turnos`, and update the router to handle turno serialization.

**Files:**
- Modify: `backend/app/schemas/parameters.py`
- Modify: `backend/app/routers/parameters.py`
- Test: `backend/tests/test_parameters.py`

**Interfaces:**
- Consumes: `generate_time_slots` from Task 1
- Produces: `PUT /api/parameters` accepts `{"turnos": [...]}` and returns updated params with regenerated `time_slots`

---

- [ ] **Step 1: Write failing test**

Add to `backend/tests/test_parameters.py`:

```python
def test_save_turnos_override(client, auth_headers):
    custom_turnos = [
        {"id": 1, "name": "Mañana", "start_hour": 9, "end_hour": 13, "days": [0, 1, 5]},
    ]
    r = client.put("/api/parameters", headers=auth_headers, json={"turnos": custom_turnos})
    assert r.status_code == 200
    data = r.json()
    assert data["turnos"] == custom_turnos
    # 1 turno × 3 days = 3 slots
    assert len(data["time_slots"]) == 3
    assert data["time_slots"][0]["turno_name"] == "Mañana"
    assert data["time_slots"][0]["start_hour"] == 9
    assert data["time_slots"][2]["day"] == 5
    assert data["time_slots"][2]["day_name"] == "Sábado"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_parameters.py::test_save_turnos_override -v
```

Expected: FAIL — validation error or `turnos` key not accepted.

- [ ] **Step 3: Update `backend/app/schemas/parameters.py`**

Replace the file with:

```python
from pydantic import BaseModel
from typing import Optional, List


class TimeSlot(BaseModel):
    id: int
    turno_id: int
    turno_name: str
    day: int
    day_name: str
    start_hour: int
    end_hour: int
    duration_hours: float


class TurnoSchema(BaseModel):
    id: int
    name: str
    start_hour: int
    end_hour: int
    days: List[int]


class ParametersResponse(BaseModel):
    max_students_per_course: int
    max_weekly_hours_per_professor: int
    available_classrooms: int
    solver_timeout_seconds: int
    turnos: List[TurnoSchema]
    time_slots: List[TimeSlot]


class ParametersUpdate(BaseModel):
    max_students_per_course: Optional[int] = None
    max_weekly_hours_per_professor: Optional[int] = None
    available_classrooms: Optional[int] = None
    solver_timeout_seconds: Optional[int] = None
    turnos: Optional[List[TurnoSchema]] = None
```

- [ ] **Step 4: Update `backend/app/routers/parameters.py`**

Replace the file with:

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
    if "turnos" in updates:
        updates["turnos"] = [t.model_dump() for t in body.turnos]
    return save_tenant_parameters(db, current_user.tenant_id, updates)
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_parameters.py::test_save_turnos_override -v
```

Expected: PASS

- [ ] **Step 6: Run full test suite**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v
```

Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/parameters.py backend/app/routers/parameters.py backend/tests/test_parameters.py
git commit -m "feat: expose turnos in parameters API — schema + router update"
```

---

### Task 4: Frontend — TurnosCard in ParametersPage

Add the inline turno CRUD UI to the parameters page. Turnos are edited inline (name, start_hour, end_hour, day checkboxes) and saved with the existing "Guardar cambios" button.

**Files:**
- Modify: `frontend/src/pages/ParametersPage.jsx`

**Interfaces:**
- Consumes: `params.turnos` (array of `{id, name, start_hour, end_hour, days}`) from `useParameters`
- Consumes: `params.available_classrooms` (already in params)
- Produces: `turnos` included in `save()` payload

---

- [ ] **Step 1: Replace `frontend/src/pages/ParametersPage.jsx`**

```jsx
import { useState } from 'react'
import { Loader2, Check, Info, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useParameters } from '@/hooks/useParameters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']

function ParamField({ label, id, value, onChange, unit }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          value={value}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          className="w-28"
          min={1}
        />
        <span className="text-sm text-gray-400">{unit}</span>
      </div>
    </div>
  )
}

function TurnosCard({ turnos, onChange }) {
  function updateTurno(index, field, value) {
    const next = turnos.map((t, i) => i === index ? { ...t, [field]: value } : t)
    onChange(next)
  }

  function toggleDay(index, day) {
    const turno = turnos[index]
    const days = turno.days.includes(day)
      ? turno.days.filter(d => d !== day)
      : [...turno.days, day].sort((a, b) => a - b)
    updateTurno(index, 'days', days)
  }

  function addTurno() {
    const newId = Date.now()
    onChange([...turnos, { id: newId, name: '', start_hour: 8, end_hour: 10, days: [0, 1, 2, 3, 4] }])
  }

  function removeTurno(index) {
    onChange(turnos.filter((_, i) => i !== index))
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Turnos</CardTitle>
        <CardDescription>Define las franjas horarias disponibles</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {turnos.length > 0 && (
            <div className="grid gap-1 text-xs font-medium text-gray-400 uppercase tracking-wide"
              style={{ gridTemplateColumns: '1fr 70px 70px auto auto' }}>
              <span>Nombre</span>
              <span>Inicio</span>
              <span>Fin</span>
              <span className="flex gap-1">
                {DAY_LABELS.map(d => <span key={d} className="w-6 text-center">{d}</span>)}
              </span>
              <span />
            </div>
          )}

          {turnos.map((turno, index) => (
            <div key={turno.id} className="grid items-center gap-2"
              style={{ gridTemplateColumns: '1fr 70px 70px auto auto' }}>
              <Input
                value={turno.name}
                onChange={e => updateTurno(index, 'name', e.target.value)}
                placeholder="Nombre del turno"
                className="h-8 text-sm"
              />
              <Input
                type="number"
                value={turno.start_hour}
                onChange={e => updateTurno(index, 'start_hour', parseInt(e.target.value) || 0)}
                min={0}
                max={23}
                className="h-8 text-sm w-full"
              />
              <Input
                type="number"
                value={turno.end_hour}
                onChange={e => updateTurno(index, 'end_hour', parseInt(e.target.value) || 0)}
                min={1}
                max={24}
                className="h-8 text-sm w-full"
              />
              <div className="flex gap-1">
                {DAY_LABELS.map((label, day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(index, day)}
                    className={[
                      'w-6 h-6 rounded text-xs font-medium transition-colors',
                      turno.days.includes(day)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => removeTurno(index)}
                className="text-gray-300 hover:text-red-500 transition-colors p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addTurno}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 mt-2"
          >
            <Plus className="h-4 w-4" />
            Agregar turno
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ParametersPage() {
  const { params, setParams, saving, save } = useParameters()
  const [saved, setSaved] = useState(false)

  if (!params) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    )
  }

  function update(key, value) {
    setParams(p => ({ ...p, [key]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    const { max_students_per_course, max_weekly_hours_per_professor, available_classrooms, solver_timeout_seconds, turnos } = params
    await save({ max_students_per_course, max_weekly_hours_per_professor, available_classrooms, solver_timeout_seconds, turnos })
    setSaved(true)
    toast.success('Parámetros guardados correctamente')
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Parámetros del optimizador</h1>

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Capacidad</CardTitle>
              <CardDescription>Límites de alumnos, aulas y carga docente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ParamField label="Alumnos por curso" id="max_students_per_course" value={params.max_students_per_course} onChange={v => update('max_students_per_course', v)} unit="alumnos" />
              <ParamField label="Aulas disponibles" id="available_classrooms" value={params.available_classrooms} onChange={v => update('available_classrooms', v)} unit="aulas" />
              <ParamField label="Hs. semanales por docente" id="max_weekly_hours_per_professor" value={params.max_weekly_hours_per_professor} onChange={v => update('max_weekly_hours_per_professor', v)} unit="horas" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Solver</CardTitle>
              <CardDescription>Configuración del optimizador CP-SAT</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ParamField label="Timeout" id="solver_timeout_seconds" value={params.solver_timeout_seconds} onChange={v => update('solver_timeout_seconds', v)} unit="segundos" />
              <div className="flex gap-2 rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <p>Si se alcanza el timeout, el solver devuelve la mejor solución encontrada hasta ese momento.</p>
              </div>
            </CardContent>
          </Card>

          <TurnosCard turnos={params.turnos || []} onChange={v => update('turnos', v)} />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="min-w-36">
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
            ) : saved ? (
              <><Check className="h-4 w-4 mr-2" />Guardado</>
            ) : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Manual verification**

Start the dev server:
```bash
cd frontend && npm run dev
```

1. Navegar a Parámetros → verificar que aparece la card "Turnos" con los 3 turnos por defecto.
2. Verificar que los días Lu-Vi están marcados y Sábado no.
3. Agregar un turno nuevo → verificar que aparece una fila editable.
4. Eliminar un turno → verificar que desaparece.
5. Activar Sábado en un turno → Guardar → verificar que el cambio persiste al recargar.
6. Verificar que los parámetros numéricos existentes (Capacidad, Solver) siguen funcionando.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ParametersPage.jsx
git commit -m "feat: TurnosCard en ParametersPage — CRUD inline de turnos"
```

---

### Task 5: Frontend — CalendarGrid adapts to turno-based slots

Update `CalendarGrid` to use turnos as rows (instead of hours) and `SlotCell` to use `${turno_id}-${day}` as droppable id.

**Files:**
- Modify: `frontend/src/components/calendar/CalendarGrid.jsx`
- Modify: `frontend/src/components/calendar/SlotCell.jsx`

**Interfaces:**
- Consumes: `timeSlots` items with shape `{id, turno_id, turno_name, day, start_hour, end_hour}` (from Task 1)
- Consumes: `courses[].time_slot` — each course's `time_slot` object now has `turno_id` (set by optimizer using new time_slots)
- Produces: `handleDragEnd` calls `onCourseDrop(course.id, slot)` where slot is found by matching `turno_id` + `day`

---

- [ ] **Step 1: Update `frontend/src/components/calendar/SlotCell.jsx`**

Replace the file with:

```jsx
import { useDroppable } from '@dnd-kit/core'

export default function SlotCell({ turnoId, day, children, disabled }) {
  const id = `${turnoId}-${day}`
  const { setNodeRef, isOver } = useDroppable({ id, disabled })

  return (
    <td
      ref={setNodeRef}
      className={[
        'align-top p-1.5 border-r border-gray-100 min-w-[130px] transition-colors',
        disabled ? 'bg-gray-50' : '',
        isOver && !disabled ? 'bg-blue-50 ring-2 ring-blue-300 ring-inset rounded' : '',
      ].join(' ')}
    >
      {children}
    </td>
  )
}
```

- [ ] **Step 2: Update `frontend/src/components/calendar/CalendarGrid.jsx`**

Replace the file with:

```jsx
import { useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import CourseCard from './CourseCard'
import SlotCell from './SlotCell'

const ALL_DAYS = [
  { index: 0, name: 'Lunes' },
  { index: 1, name: 'Martes' },
  { index: 2, name: 'Miércoles' },
  { index: 3, name: 'Jueves' },
  { index: 4, name: 'Viernes' },
  { index: 5, name: 'Sábado' },
]

export default function CalendarGrid({ courses, timeSlots, selectedCareerIds, onCourseClick, onCourseDrop, draggable }) {
  const [activeCourse, setActiveCourse] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const filtered = selectedCareerIds.length === 0
    ? courses
    : courses.filter(c => selectedCareerIds.includes(c.career_id))

  // Index courses by turno_id-day key
  const bySlot = {}
  for (const c of filtered) {
    const key = `${c.time_slot?.turno_id}-${c.time_slot?.day}`
    if (!bySlot[key]) bySlot[key] = []
    bySlot[key].push(c)
  }

  // Unique turnos preserving order
  const seenTurnos = new Set()
  const uniqueTurnos = []
  for (const slot of timeSlots) {
    if (!seenTurnos.has(slot.turno_id)) {
      seenTurnos.add(slot.turno_id)
      uniqueTurnos.push({ id: slot.turno_id, name: slot.turno_name, start_hour: slot.start_hour, end_hour: slot.end_hour })
    }
  }

  // Days that appear in at least one slot
  const enabledDays = new Set(timeSlots.map(s => s.day))
  const visibleDays = ALL_DAYS.filter(d => enabledDays.has(d.index))

  function handleDragStart(e) {
    setActiveCourse(e.active.data.current)
  }

  function handleDragEnd(e) {
    setActiveCourse(null)
    const { active, over } = e
    if (!over) return
    const [turnoIdStr, dayStr] = over.id.split('-')
    const turnoId = parseInt(turnoIdStr)
    const day = parseInt(dayStr)
    const course = active.data.current
    if (turnoId === course.time_slot?.turno_id && day === course.time_slot?.day) return
    const slot = timeSlots.find(s => s.turno_id === turnoId && s.day === day)
    if (slot) onCourseDrop(course.id, slot)
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-36 p-3 border-r border-gray-200" />
              {visibleDays.map(d => (
                <th key={d.index} className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">
                  {d.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uniqueTurnos.map(turno => (
              <tr key={turno.id} className="border-t border-gray-100">
                <td className="p-2 text-right border-r border-gray-200 align-top">
                  <span className="text-xs font-medium text-gray-600 block">{turno.name}</span>
                  <span className="text-xs text-gray-400">{turno.start_hour}:00–{turno.end_hour}:00</span>
                </td>
                {visibleDays.map(d => {
                  const slotExists = timeSlots.some(s => s.turno_id === turno.id && s.day === d.index)
                  return (
                    <SlotCell key={d.index} turnoId={turno.id} day={d.index} disabled={!slotExists || !draggable}>
                      {(bySlot[`${turno.id}-${d.index}`] || []).map(course => (
                        <CourseCard
                          key={course.id}
                          course={course}
                          onClick={onCourseClick}
                          draggable={draggable && slotExists}
                        />
                      ))}
                    </SlotCell>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DragOverlay>
        {activeCourse && (
          <CourseCard course={activeCourse} onClick={() => {}} draggable={false} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 3: Manual verification**

With the dev server running (`cd frontend && npm run dev`):

1. Navegar al Calendario → verificar que las filas muestran los nombres de los turnos (Turno mañana, Turno tarde, Turno noche) con el rango horario.
2. Verificar que las columnas muestran solo los días habilitados (Lunes-Viernes por defecto, sin Sábado).
3. Si hay una oferta generada: verificar que los cursos aparecen en las celdas correctas.
4. Arrastrar un curso a otra franja → verificar que el movimiento funciona.
5. Ir a Parámetros → habilitar Sábado en un turno → Guardar → volver al Calendario → verificar que aparece la columna Sábado.
6. Verificar que celdas sin turno habilitado (ej: un turno que no aplica a Sábado) aparecen en gris y no aceptan drops.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/calendar/CalendarGrid.jsx frontend/src/components/calendar/SlotCell.jsx
git commit -m "feat: CalendarGrid con filas por turno y columnas por días habilitados"
```

---

### Task 6: Frontend — classroom availability validation in handleCourseDrop

Add a second validation in `handleCourseDrop` (after the existing professor conflict check) to verify the target slot has capacity before moving a course.

**Files:**
- Modify: `frontend/src/pages/OffersPage.jsx`

**Interfaces:**
- Consumes: `params.available_classrooms` from `useParameters` (already in scope)
- Consumes: `offer.courses[].time_slot.turno_id` and `.day` (set by optimizer with new time_slots)

---

- [ ] **Step 1: Update `handleCourseDrop` in `frontend/src/pages/OffersPage.jsx`**

Find the existing `handleCourseDrop` function and replace it with:

```js
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
```

Note: `newSlot` is a time_slot object from `timeSlots` which now has `turno_id` — the conflict checks use `turno_id` instead of `start_hour` to identify the slot.

Also update the existing professor conflict check in `CourseEditModal` prop `allCourses` — no change needed there since the modal uses `time_slot.day` + `time_slot.start_hour` for the current course, which still works.

- [ ] **Step 2: Manual verification**

With the dev server running:

1. Generar una oferta.
2. Encontrar una franja horaria que ya tenga cursos.
3. Intentar mover un curso a esa franja cuando ya tiene `available_classrooms` cursos → verificar toast "No hay aulas disponibles en esa franja".
4. Mover un curso a una franja con capacidad disponible → verificar que se mueve correctamente.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/OffersPage.jsx
git commit -m "feat: validación de disponibilidad de aulas en handleCourseDrop"
```
