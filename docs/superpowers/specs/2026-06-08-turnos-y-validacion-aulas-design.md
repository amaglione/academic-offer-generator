# Turnos Configurables y Validación de Aulas

**Fecha:** 2026-06-08
**Estado:** Aprobado por usuario

---

## Resumen

Dos features relacionados con la configuración de la oferta académica: (1) reemplazar los horarios hardcodeados por turnos configurables por el admin (con días habilitados por turno), y (2) validar disponibilidad de aulas al mover cursos manualmente en el calendario.

---

## Scope

| # | Feature | Tipo |
|---|---|---|
| 1 | Turnos y días habilitados como parámetros | Feature |
| 2 | Validación de aulas en edición manual | Feature |

**Fuera de scope:**
- Duración de materias por subject (diferido — MVP mantiene una clase = un turno completo)
- Scheduling secuencial de clases dentro de un turno
- Cambios al algoritmo del optimizador (sigue consumiendo `time_slots` como antes)

---

## 1. Turnos configurables

### Modelo de datos

Nuevo campo `turnos` (JSON) en `GlobalParameters` y `TenantParameters`. Requiere Alembic migration.

**Estructura de cada turno:**
```json
{
  "id": 1,
  "name": "Turno mañana",
  "start_hour": 8,
  "end_hour": 12,
  "days": [0, 1, 2, 3, 4, 5]
}
```

- `days`: índices de días habilitados para este turno. 0=Lunes, 1=Martes, 2=Miércoles, 3=Jueves, 4=Viernes, 5=Sábado.
- Un turno puede estar habilitado en cualquier subconjunto de días.

**Defaults (seed y GlobalParameters):**

| Turno | Inicio | Fin | Días por defecto |
|---|---|---|---|
| Turno mañana | 8 | 12 | Lunes-Viernes (0-4) |
| Turno tarde | 14 | 18 | Lunes-Viernes (0-4) |
| Turno noche | 19 | 23 | Lunes-Viernes (0-4) |

El Sábado queda deshabilitado por defecto en todos los turnos.

### Generación de time_slots

`get_effective_parameters` genera `time_slots` en runtime a partir de `turnos`:

```python
def generate_time_slots(turnos: list[dict]) -> list[dict]:
    day_names = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    slots = []
    slot_id = 0
    for turno in turnos:
        for day in turno["days"]:
            slots.append({
                "id": slot_id,
                "turno_id": turno["id"],
                "turno_name": turno["name"],
                "day": day,
                "day_name": day_names[day],
                "start_hour": turno["start_hour"],
                "end_hour": turno["end_hour"],
                "duration_hours": turno["end_hour"] - turno["start_hour"],
            })
            slot_id += 1
    return slots
```

El optimizador y el calendario siguen consumiendo `time_slots` sin cambios — la generación es transparente.

### Backend

**`backend/app/models/parameters.py`:**
- Agregar `turnos = Column(JSON, nullable=True)` a `GlobalParameters` y `TenantParameters`.
- Definir `DEFAULT_TURNOS` como lista de 3 turnos (mañana, tarde, noche) con días 0-4.
- Mantener `DEFAULT_TIME_SLOTS` para retrocompatibilidad pero generarlo desde `DEFAULT_TURNOS`.

**`backend/alembic/versions/`:**
- Nueva migración: `ADD COLUMN turnos JSON` en ambas tablas.
- La migración no necesita rellenar datos existentes — `get_effective_parameters` usa `DEFAULT_TURNOS` si el campo es `None`.

**`backend/app/services/parameter_service.py`:**
- Agregar `"turnos"` a `PARAM_FIELDS`.
- En `get_effective_parameters`, después de resolver los params, llamar a `generate_time_slots(result["turnos"] or DEFAULT_TURNOS)` y setear `result["time_slots"]`.
- Exportar `generate_time_slots` para uso en tests.

**`backend/app/schemas/parameters.py`** (si existe) o directo en el router:
- El endpoint `GET /parameters` ya devuelve el dict de params — `turnos` y `time_slots` se incluyen automáticamente.
- El endpoint `PUT /parameters` acepta `turnos` como parte del body.

### Frontend — Página de Parámetros

Nueva card "Turnos" debajo de las cards existentes (Capacidad y Solver), ancho completo.

**Layout de la card:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Turnos                                                          │
│ Define las franjas horarias disponibles                         │
│─────────────────────────────────────────────────────────────────│
│  Nombre         Inicio  Fin    Lu  Ma  Mi  Ju  Vi  Sa    [x]   │
│  Turno mañana    8     12      ☑   ☑   ☑   ☑   ☑   ☐    [x]   │
│  Turno tarde    14     18      ☑   ☑   ☑   ☑   ☑   ☐    [x]   │
│  Turno noche    19     23      ☑   ☑   ☑   ☑   ☑   ☐    [x]   │
│                                                                 │
│  [+ Agregar turno]                                              │
└─────────────────────────────────────────────────────────────────┘
```

**Comportamiento:**
- Cada fila es editable inline: nombre (input texto), inicio/fin (inputs numéricos, mín 0, máx 23), checkboxes Lu-Sa.
- Botón `[x]` elimina el turno — sin confirmación (se confirma al "Guardar cambios").
- "+ Agregar turno" añade una fila vacía al final (sin id asignado aún, se genera en frontend con `Date.now()` como id temporal).
- Al guardar, los turnos se incluyen en el payload de `PUT /parameters`.
- Validación mínima: `end_hour > start_hour`, al menos un día habilitado por turno. Mostrar error inline si no se cumple.

**`frontend/src/pages/ParametersPage.jsx`:**
- Agregar `turnos` al estado local (inicializado desde `params.turnos`).
- Nuevo componente `TurnosCard` en el mismo archivo (no vale la pena un archivo separado dado su tamaño).
- En `handleSave`, incluir `turnos` en el objeto enviado a `save()`.

**`frontend/src/hooks/useParameters.js`:**
- Sin cambios estructurales — `params.turnos` llega como parte del objeto de parámetros.

### Frontend — CalendarGrid

**`frontend/src/components/calendar/CalendarGrid.jsx`:**

- Las filas del calendario pasan de ser "horas únicas" (`uniqueHours`) a ser "turnos únicos" derivados de `timeSlots`.
- El key de slot cambia de `${day}-${start_hour}` a `${turno_id}-${day}` para evitar colisiones si hubiera dos turnos con el mismo `start_hour`.
- El label de fila muestra: nombre del turno + rango horario (`Turno mañana · 8:00-12:00`).
- Las columnas muestran solo los días que aparecen en al menos un slot (`uniqueDays` derivado de `timeSlots`).
- Celda sin slot correspondiente (turno no habilitado ese día): `bg-gray-50`, no es drop zone.
- `SlotCell` recibe `id={turno_id}-${day}` en lugar de `id="${day}-${start_hour}"`.

**`frontend/src/components/calendar/SlotCell.jsx`:**
- Sin cambios en lógica — solo recibe un `id` diferente.

---

## 2. Validación de aulas en edición manual

**`frontend/src/pages/OffersPage.jsx` — función `handleCourseDrop`:**

Segunda validación (después del check de docente), antes de llamar a `patchCourse`:

```js
const coursesInSlot = offer.courses.filter(c =>
  c.id !== courseId &&
  c.time_slot?.day === newSlot.day &&
  c.time_slot?.turno_id === newSlot.turno_id
)
if (coursesInSlot.length >= params.available_classrooms) {
  toast.error('No hay aulas disponibles en esa franja')
  return
}
```

- `params` ya está disponible via `useParameters` en `OffersPage`.
- Sin cambios al backend.

---

## Arquitectura de cambios

### Backend

| Archivo | Cambio |
|---|---|
| `backend/app/models/parameters.py` | Agregar `turnos` column + `DEFAULT_TURNOS` + actualizar `DEFAULT_TIME_SLOTS` |
| `backend/alembic/versions/<hash>_add_turnos.py` | Nueva migración: ADD COLUMN turnos |
| `backend/app/services/parameter_service.py` | Agregar `"turnos"` a `PARAM_FIELDS`, `generate_time_slots()`, generar `time_slots` en runtime |

### Frontend

| Archivo | Cambio |
|---|---|
| `frontend/src/pages/ParametersPage.jsx` | Nueva card Turnos con CRUD inline + incluir turnos en save |
| `frontend/src/components/calendar/CalendarGrid.jsx` | Filas por turno, columnas por día, key de slot con turno_id |
| `frontend/src/pages/OffersPage.jsx` | Segunda validación en handleCourseDrop (disponibilidad de aulas) |

### Seed

| Archivo | Cambio |
|---|---|
| `backend/seed/seed.py` | No requiere cambio — GlobalParameters usa DEFAULT_TURNOS como default |
