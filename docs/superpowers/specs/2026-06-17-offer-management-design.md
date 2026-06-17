# Offer Management — Fix Carreras, Reabrir, Validaciones y Export

**Fecha:** 2026-06-17
**Estado:** Aprobado por usuario

---

## Resumen

Cuatro mejoras a la gestión de la oferta académica: corrección del filtro de carreras (bug), capacidad de reabrir una oferta publicada, validación de conflictos de docente en ediciones manuales, y exportación de la oferta en JSON para importar en Sigedu u otros sistemas externos.

---

## Scope

| # | Feature | Tipo |
|---|---|---|
| 1 | Fix filtro de carreras | Bug fix |
| 2 | Reabrir oferta publicada | Feature |
| 3 | Validación de docente en edición manual | Feature |
| 4 | Export JSON de oferta publicada | Feature |

**Fuera de scope:**
- Validación de capacidad de aulas (spec separado)
- Dark mode, mobile
- Cambios al optimizador o al flujo de generación

---

## 1. Fix filtro de carreras

### Problema

`CourseSchema` no incluye `career_id` ni `career_name`. La función `_enrich_course` en `offers.py` solo resuelve `subject_name` y `professor_name`, nunca el career. El frontend deriva la lista de carreras desde `offer.courses`, por lo que siempre recibe un array vacío.

### Solución

**Backend** (`backend/app/schemas/offer.py`):
- Agregar `career_id: Optional[int] = None` y `career_name: Optional[str] = None` a `CourseSchema`.

**Backend** (`backend/app/routers/offers.py`):
- En `_enrich_course`, resolver el career a partir del `subject.career_id` consultando el modelo `Career`.
- Incluir `career_id` y `career_name` en el `CourseSchema` retornado.

**Frontend** — sin cambios. El código existente en `OffersPage` ya usa `c.career_id` y `c.career_name`.

---

## 2. Reabrir oferta publicada

### Comportamiento

Una oferta en estado `published` puede volver a `draft`. Los cursos se mantienen intactos — no se resetea nada.

### Backend

- Nuevo endpoint: `POST /offers/{offer_id}/reopen`
- Valida que la oferta exista y pertenezca al tenant.
- Valida que el estado sea `published`; si no, retorna 400.
- Cambia `status` a `draft` y hace commit.
- Retorna `{ "id": offer.id, "status": "draft" }`.

### Frontend

**`useOffer.js`:**
- Nueva función `reopen()`: llama a `POST /offers/{id}/reopen` y recarga la oferta.

**`OffersPage.jsx`:**
- Botón "Reabrir" visible solo cuando `offer.status === "published"`.
- Al hacer clic abre un `AlertDialog` de confirmación antes de ejecutar.
- Toast de éxito al completar.

### Estado de botones por status

| Estado | Botones visibles |
|---|---|
| `draft` | Regenerar · Aprobar oferta |
| `published` | Reabrir · Exportar |

---

## 3. Validación de docente en edición manual

### Regla

Un docente no puede tener dos cursos asignados en la misma franja horaria. Esta validación se aplica al editar manualmente — el optimizador ya la garantiza al generar.

### Implementación (frontend-only)

La validación compara el nuevo `professor_id` y/o el nuevo `time_slot` contra los cursos existentes en `offer.courses`, excluyendo el curso que se está editando.

**Detección de conflicto:**
```
conflict = offer.courses.find(c =>
  c.id !== editingCourse.id &&
  c.professor_id === newProfessorId &&
  c.time_slot.day === targetSlot.day &&
  c.time_slot.start === targetSlot.start
)
```

**En `CourseEditModal`:**
- Al hacer clic en "Guardar", si `professor_id` cambió, verificar conflicto.
- Si hay conflicto: mostrar mensaje de error inline en el modal ("Este docente ya tiene un curso en esta franja horaria") y no ejecutar el PATCH.
- Si no hay conflicto: proceder normalmente.

**En drag & drop (`OffersPage` / `useOffer`):**
- En `handleCourseDrop`, antes del PATCH, verificar si el profesor del curso a mover ya tiene otro curso en el slot destino.
- Si hay conflicto: mostrar toast de error y cancelar (no hacer PATCH).
- Si no hay conflicto: proceder normalmente.

---

## 4. Export JSON

### Disponibilidad

Solo cuando `offer.status === "published"`.

### Backend

- Nuevo endpoint: `GET /offers/{offer_id}/export`
- Valida que la oferta exista y pertenezca al tenant.
- Retorna `Content-Type: application/json` con la estructura completa:

```json
{
  "semester": "2026-2",
  "generated_at": "2026-06-17T10:00:00",
  "status": "published",
  "courses": [
    {
      "subject_id": 1,
      "subject_name": "Álgebra",
      "career_id": 1,
      "career_name": "Ingeniería en Sistemas",
      "year": 2,
      "professor_id": 5,
      "professor_name": "García, Juan",
      "time_slot": {
        "day": "Lunes",
        "start": "08:00",
        "end": "10:00",
        "duration_hours": 2.0
      },
      "expected_students": 35,
      "manually_modified": false
    }
  ]
}
```

### Frontend

**`useOffer.js`:**
- Nueva función `exportOffer()`: llama a `GET /offers/{id}/export`, recibe el JSON y lo descarga como archivo `oferta-{semester}.json` usando un `<a download>` programático.

**`OffersPage.jsx`:**
- Botón "Exportar" visible solo cuando `offer.status === "published"`.
- Sin modal de confirmación — la descarga es no destructiva.

---

## Arquitectura de cambios

### Backend

| Archivo | Cambio |
|---|---|
| `app/schemas/offer.py` | Agregar `career_id` y `career_name` a `CourseSchema` |
| `app/routers/offers.py` | `_enrich_course` incluye career; nuevos endpoints `reopen` y `export` |

### Frontend

| Archivo | Cambio |
|---|---|
| `src/hooks/useOffer.js` | Agregar `reopen()` y `exportOffer()` |
| `src/pages/OffersPage.jsx` | Botones Reabrir y Exportar; validación en `handleCourseDrop` |
| `src/components/calendar/CourseEditModal.jsx` | Validación de conflicto de docente antes del PATCH |
