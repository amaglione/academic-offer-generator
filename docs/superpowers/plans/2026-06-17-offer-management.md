# Offer Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the career filter bug, add reopen offer, professor conflict validation on manual edits, and JSON export for external systems.

**Architecture:** Four independent backend endpoints and frontend changes, all within the existing FastAPI + React stack. Backend changes extend the existing `offers.py` router and `CourseSchema`. Frontend changes extend `useOffer.js`, `OffersPage.jsx`, and `CourseEditModal.jsx`.

**Tech Stack:** Python 3.11 / FastAPI / SQLAlchemy 2.0 (backend) · React 18 / Vite / Tailwind / shadcn/ui / dnd-kit (frontend) · pytest / SQLite in-memory (tests)

## Global Constraints

- Backend Python path for tests: `PYTHONPATH=. .venv/bin/pytest tests/ -v`
- Frontend dev server: `cd frontend && npm run dev`
- No new npm packages — use existing dependencies
- No Alembic migrations — no new DB tables or columns
- `career_id=1, career_name="Test Career"` exists in the conftest fixture

---

## File Map

| File | Change |
|---|---|
| `backend/app/schemas/offer.py` | Add `career_id`, `career_name`, `year`, `eligible_professors` to `CourseSchema`; add `ProfessorRef` model |
| `backend/app/routers/offers.py` | Update `_enrich_course`; add `reopen` and `export` endpoints; import `Career`, `ProfessorSubject` |
| `backend/tests/test_offers.py` | Add tests for career fields, reopen, professor conflict, and export |
| `frontend/src/hooks/useOffer.js` | Add `reopen()` and `exportOffer()` functions |
| `frontend/src/pages/OffersPage.jsx` | Add Reabrir/Exportar buttons + AlertDialog; professor conflict check in `handleCourseDrop` |
| `frontend/src/components/calendar/CourseEditModal.jsx` | Add professor selector dropdown; professor conflict validation before save |

---

### Task 1: Fix career filter — add `career_id`, `career_name`, `year` to course response

**Files:**
- Modify: `backend/app/schemas/offer.py`
- Modify: `backend/app/routers/offers.py`
- Test: `backend/tests/test_offers.py`

**Interfaces:**
- Produces: `CourseSchema` with `career_id: Optional[int]`, `career_name: Optional[str]`, `year: Optional[int]`
- Produces: `_enrich_course(course, db)` imports and queries `Career` model

---

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_offers.py`:

```python
def test_course_includes_career_and_year(client, auth_headers, db):
    from app.models.academic import Subject, Professor
    offer = Offer(tenant_id=1, semester="2026-2", status="draft")
    db.add(offer)
    db.flush()
    subject = Subject(tenant_id=1, career_id=1, name="Álgebra", year=2)
    db.add(subject)
    professor = Professor(tenant_id=1, name="García")
    db.add(professor)
    db.flush()
    course = Course(
        offer_id=offer.id, subject_id=subject.id, professor_id=professor.id,
        time_slot={"day": 0, "start_hour": 8}, expected_students=30,
    )
    db.add(course)
    db.commit()

    r = client.get(f"/api/offers/{offer.id}", headers=auth_headers)
    assert r.status_code == 200
    c = r.json()["courses"][0]
    assert c["career_id"] == 1
    assert c["career_name"] == "Test Career"
    assert c["year"] == 2
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_offers.py::test_course_includes_career_and_year -v
```

Expected: FAIL — `career_id`, `career_name`, `year` are `None` or missing.

- [ ] **Step 3: Update `CourseSchema`**

Replace `backend/app/schemas/offer.py` with:

```python
from pydantic import BaseModel
from typing import List, Optional
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

- [ ] **Step 4: Update `_enrich_course` in `offers.py`**

Replace the imports block and `_enrich_course` function in `backend/app/routers/offers.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.tenant import User
from app.models.offer import Offer, Course
from app.models.academic import Subject, Professor, Career, ProfessorSubject
from app.schemas.offer import OfferSchema, OfferListItem, CourseSchema, CourseUpdate

router = APIRouter()


def _enrich_course(course: Course, db: Session) -> CourseSchema:
    subject = db.query(Subject).filter(Subject.id == course.subject_id).first()
    professor = db.query(Professor).filter(Professor.id == course.professor_id).first()
    career = db.query(Career).filter(Career.id == subject.career_id).first() if subject else None
    eligible = (
        db.query(Professor)
        .join(ProfessorSubject, ProfessorSubject.professor_id == Professor.id)
        .filter(ProfessorSubject.subject_id == course.subject_id)
        .all()
    )
    return CourseSchema(
        id=course.id,
        subject_id=course.subject_id,
        subject_name=subject.name if subject else None,
        career_id=subject.career_id if subject else None,
        career_name=career.name if career else None,
        year=subject.year if subject else None,
        professor_id=course.professor_id,
        professor_name=professor.name if professor else None,
        time_slot=course.time_slot,
        expected_students=course.expected_students,
        manually_modified=course.manually_modified,
        eligible_professors=[{"id": p.id, "name": p.name} for p in eligible],
    )
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_offers.py::test_course_includes_career_and_year -v
```

Expected: PASS

- [ ] **Step 6: Run full test suite to check for regressions**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v
```

Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/offer.py backend/app/routers/offers.py backend/tests/test_offers.py
git commit -m "fix: career filter — add career_id, career_name, year and eligible_professors to CourseSchema"
```

---

### Task 2: Reopen published offer

**Files:**
- Modify: `backend/app/routers/offers.py` — add `reopen` endpoint
- Modify: `frontend/src/hooks/useOffer.js` — add `reopen()`
- Modify: `frontend/src/pages/OffersPage.jsx` — add Reabrir button + AlertDialog
- Test: `backend/tests/test_offers.py`

**Interfaces:**
- Consumes: `_enrich_course` from Task 1
- Produces: `POST /api/offers/{id}/reopen` → `{ "id": int, "status": "draft" }`
- Produces: `reopen()` function exported from `useOffer`

---

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_offers.py`:

```python
def test_reopen_offer(client, auth_headers, db):
    offer = Offer(tenant_id=1, semester="2026-2", status="published")
    db.add(offer)
    db.commit()

    r = client.post(f"/api/offers/{offer.id}/reopen", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "draft"

    r2 = client.get(f"/api/offers/{offer.id}", headers=auth_headers)
    assert r2.json()["status"] == "draft"


def test_reopen_draft_offer_returns_400(client, auth_headers, db):
    offer = Offer(tenant_id=1, semester="2026-2", status="draft")
    db.add(offer)
    db.commit()

    r = client.post(f"/api/offers/{offer.id}/reopen", headers=auth_headers)
    assert r.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_offers.py::test_reopen_offer tests/test_offers.py::test_reopen_draft_offer_returns_400 -v
```

Expected: FAIL — endpoint does not exist (404).

- [ ] **Step 3: Add `reopen` endpoint to `offers.py`**

Add after the `approve_offer` function in `backend/app/routers/offers.py`:

```python
@router.post("/{offer_id}/reopen")
def reopen_offer(offer_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    offer = db.query(Offer).filter(Offer.id == offer_id, Offer.tenant_id == current_user.tenant_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if offer.status != "published":
        raise HTTPException(status_code=400, detail="Offer is not published")
    offer.status = "draft"
    db.commit()
    return {"id": offer.id, "status": offer.status}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_offers.py::test_reopen_offer tests/test_offers.py::test_reopen_draft_offer_returns_400 -v
```

Expected: PASS

- [ ] **Step 5: Add `reopen()` to `useOffer.js`**

Add inside the `useOffer` function in `frontend/src/hooks/useOffer.js`, after the `approve` function:

```js
async function reopen() {
  if (!offer) return
  await client.post(`/offers/${offer.id}/reopen`)
  await loadOffer(offer.id)
}
```

And add `reopen` to the return object:

```js
return { offer, offers, generating, jobError, generate, approve, reopen, patchCourse }
```

- [ ] **Step 6: Add Reabrir button and AlertDialog to `OffersPage.jsx`**

Replace the full `OffersPage.jsx` with:

```jsx
import { useState } from 'react'
import { RefreshCw, Check, Loader2, AlertCircle, Download, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useOffer } from '@/hooks/useOffer'
import { useParameters } from '@/hooks/useParameters'
import CalendarGrid from '@/components/calendar/CalendarGrid'
import CareerFilter from '@/components/shared/CareerFilter'
import StatusBadge from '@/components/shared/StatusBadge'
import CourseEditModal from '@/components/calendar/CourseEditModal'
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
  const { offer, offers, generating, jobError, generate, approve, reopen, patchCourse } = useOffer()
  const { params } = useParameters()
  const [selectedCareerIds, setSelectedCareerIds] = useState([])
  const [editingCourse, setEditingCourse] = useState(null)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const [confirmReopen, setConfirmReopen] = useState(false)

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
        c.time_slot?.start_hour === newSlot.start_hour
      )
      if (conflict) {
        toast.error(`${course.professor_name} ya tiene un curso en esa franja`)
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
            <Button variant="outline" size="sm" onClick={() => setConfirmReopen(true)}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reabrir
            </Button>
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
    </div>
  )
}
```

- [ ] **Step 7: Run full backend test suite**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v
```

Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add backend/app/routers/offers.py frontend/src/hooks/useOffer.js frontend/src/pages/OffersPage.jsx backend/tests/test_offers.py
git commit -m "feat: reabrir oferta publicada — endpoint POST /reopen + botón en UI"
```

---

### Task 3: Professor selector and conflict validation in CourseEditModal

**Files:**
- Modify: `frontend/src/components/calendar/CourseEditModal.jsx` — professor selector + conflict check
- Test: manual — open modal on a draft offer, change professor to one with a conflict, verify error appears

**Interfaces:**
- Consumes: `course.eligible_professors` (array of `{id, name}`) from Task 1
- Consumes: `allCourses` prop (array from `offer.courses`) from Task 2's `OffersPage` change
- Consumes: `course.time_slot` with shape `{ day: number, start_hour: number }`

---

- [ ] **Step 1: Rewrite `CourseEditModal.jsx`**

Replace `frontend/src/components/calendar/CourseEditModal.jsx` with:

```jsx
import { useState } from 'react'
import { Clock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default function CourseEditModal({ course, allCourses, onClose, onSave }) {
  const [professorId, setProfessorId] = useState(course.professor_id)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (professorId !== course.professor_id) {
      const conflict = (allCourses || []).find(c =>
        c.id !== course.id &&
        c.professor_id === professorId &&
        c.time_slot?.day === course.time_slot?.day &&
        c.time_slot?.start_hour === course.time_slot?.start_hour
      )
      if (conflict) {
        setError('Este docente ya tiene un curso en esta franja horaria')
        return
      }
    }
    setError(null)
    setSaving(true)
    await onSave({ professor_id: professorId })
    setSaving(false)
    onClose()
  }

  const slot = course.time_slot
  const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6">{course.subject_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {slot && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4 text-gray-400 shrink-0" />
              {dayNames[slot.day] ?? slot.day_name} · {slot.start_hour}:00 – {slot.end_hour ?? slot.start_hour + 2}:00
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Docente</label>
            <select
              value={professorId}
              onChange={e => { setProfessorId(Number(e.target.value)); setError(null) }}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(course.eligible_professors || []).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Manual verification**

Start the dev server:
```bash
cd frontend && npm run dev
```

1. Log in and navigate to Calendario.
2. Abrir un curso en estado borrador → verificar que el selector de docentes muestra todos los elegibles para esa materia.
3. Seleccionar el mismo docente que tiene otro curso en la misma franja → hacer clic en "Guardar" → verificar que aparece el mensaje de error y no se guarda.
4. Seleccionar un docente sin conflicto → "Guardar" → verificar que se guarda y el modal se cierra.
5. Arrastrar un curso a una franja donde el docente ya tiene otro curso → verificar que aparece un toast de error y el curso no se mueve.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/calendar/CourseEditModal.jsx
git commit -m "feat: selector de docente con validación de conflicto de franja horaria"
```

---

### Task 4: Export JSON

**Files:**
- Modify: `backend/app/routers/offers.py` — add `export` endpoint
- Modify: `frontend/src/hooks/useOffer.js` — add `exportOffer()`
- Modify: `frontend/src/pages/OffersPage.jsx` — add Exportar button
- Test: `backend/tests/test_offers.py`

**Interfaces:**
- Consumes: `_enrich_course` enrichment from Task 1 (career, year fields)
- Produces: `GET /api/offers/{id}/export` → JSON object (only for `status === "published"`)
- Produces: `exportOffer()` function exported from `useOffer`

---

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_offers.py`:

```python
def test_export_published_offer(client, auth_headers, db):
    from app.models.academic import Subject, Professor
    offer = Offer(tenant_id=1, semester="2026-2", status="published")
    db.add(offer)
    db.flush()
    subject = Subject(tenant_id=1, career_id=1, name="Álgebra", year=2)
    db.add(subject)
    professor = Professor(tenant_id=1, name="García")
    db.add(professor)
    db.flush()
    course = Course(
        offer_id=offer.id, subject_id=subject.id, professor_id=professor.id,
        time_slot={"day": 0, "start_hour": 8, "end_hour": 10, "duration_hours": 2},
        expected_students=30,
    )
    db.add(course)
    db.commit()

    r = client.get(f"/api/offers/{offer.id}/export", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["semester"] == "2026-2"
    assert data["status"] == "published"
    assert len(data["courses"]) == 1
    c = data["courses"][0]
    assert c["subject_name"] == "Álgebra"
    assert c["career_name"] == "Test Career"
    assert c["year"] == 2
    assert c["professor_name"] == "García"
    assert c["expected_students"] == 30


def test_export_draft_offer_returns_400(client, auth_headers, db):
    offer = Offer(tenant_id=1, semester="2026-2", status="draft")
    db.add(offer)
    db.commit()

    r = client.get(f"/api/offers/{offer.id}/export", headers=auth_headers)
    assert r.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_offers.py::test_export_published_offer tests/test_offers.py::test_export_draft_offer_returns_400 -v
```

Expected: FAIL — endpoint does not exist (404).

- [ ] **Step 3: Add `export` endpoint to `offers.py`**

Add after the `reopen_offer` function in `backend/app/routers/offers.py`:

```python
@router.get("/{offer_id}/export")
def export_offer(offer_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    offer = db.query(Offer).filter(Offer.id == offer_id, Offer.tenant_id == current_user.tenant_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if offer.status != "published":
        raise HTTPException(status_code=400, detail="Offer is not published")
    courses = db.query(Course).filter(Course.offer_id == offer_id).all()
    courses_data = []
    for course in courses:
        subject = db.query(Subject).filter(Subject.id == course.subject_id).first()
        professor = db.query(Professor).filter(Professor.id == course.professor_id).first()
        career = db.query(Career).filter(Career.id == subject.career_id).first() if subject else None
        courses_data.append({
            "subject_id": course.subject_id,
            "subject_name": subject.name if subject else None,
            "career_id": subject.career_id if subject else None,
            "career_name": career.name if career else None,
            "year": subject.year if subject else None,
            "professor_id": course.professor_id,
            "professor_name": professor.name if professor else None,
            "time_slot": course.time_slot,
            "expected_students": course.expected_students,
            "manually_modified": course.manually_modified,
        })
    return {
        "semester": offer.semester,
        "generated_at": offer.generated_at.isoformat(),
        "status": offer.status,
        "courses": courses_data,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/test_offers.py::test_export_published_offer tests/test_offers.py::test_export_draft_offer_returns_400 -v
```

Expected: PASS

- [ ] **Step 5: Add `exportOffer()` to `useOffer.js`**

Add inside the `useOffer` function, after the `reopen` function:

```js
async function exportOffer() {
  if (!offer) return
  const r = await client.get(`/offers/${offer.id}/export`)
  const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `oferta-${offer.semester}.json`
  a.click()
  URL.revokeObjectURL(url)
}
```

And add `exportOffer` to the return object:

```js
return { offer, offers, generating, jobError, generate, approve, reopen, exportOffer, patchCourse }
```

- [ ] **Step 6: Add Exportar button to `OffersPage.jsx`**

In the destructuring at the top of `OffersPage`:

```js
const { offer, offers, generating, jobError, generate, approve, reopen, exportOffer, patchCourse } = useOffer()
```

Add the Exportar button after the Reabrir button in the header actions block (inside the `isPublished` block):

```jsx
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
```

- [ ] **Step 7: Run full backend test suite**

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v
```

Expected: all tests PASS

- [ ] **Step 8: Manual verification**

1. Aprobar una oferta borrador.
2. Verificar que aparecen los botones "Reabrir" y "Exportar" (y que "Aprobar oferta" ya no aparece).
3. Hacer clic en "Exportar" → verificar que se descarga `oferta-2026-2.json` con todos los cursos.
4. Abrir el JSON descargado → verificar que tiene `semester`, `status: "published"`, y los campos de cada curso (`subject_name`, `career_name`, `year`, `professor_name`, `time_slot`, `expected_students`).

- [ ] **Step 9: Commit**

```bash
git add backend/app/routers/offers.py frontend/src/hooks/useOffer.js frontend/src/pages/OffersPage.jsx backend/tests/test_offers.py
git commit -m "feat: export JSON de oferta publicada — endpoint GET /export + descarga en UI"
```
