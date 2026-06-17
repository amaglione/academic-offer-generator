# Pantallas de Consulta — Carreras, Materias y Docentes

**Fecha:** 2026-06-17
**Estado:** Aprobado por usuario

---

## Resumen

Pantalla de consulta de datos de integración (Sigedu): carreras, materias y docentes. Layout de dos columnas (lista de carreras + tabla de materias) con panel lateral al seleccionar una materia. Las materias incluyen configuración de turnos habilitados (`allowed_turnos`) editable desde la UI. El optimizador respeta estas restricciones al generar la oferta.

---

## Scope

| # | Feature | Tipo |
|---|---|---|
| 1 | Endpoint `GET /careers` | Backend |
| 2 | Endpoint `GET /careers/{id}/subjects` con docentes embebidos | Backend |
| 3 | Endpoint `PATCH /subjects/{id}/turnos` | Backend |
| 4 | Campo `allowed_turnos` en `Subject` + Alembic migration | Backend |
| 5 | Optimizador respeta `allowed_turnos` | Backend |
| 6 | Página `/careers` con dos columnas + panel lateral | Frontend |
| 7 | Sidebar — nuevo ítem "Carreras" | Frontend |

**Fuera de scope:**
- Alta/baja/modificación de carreras, materias o docentes (datos de integración, solo lectura)
- Paginación (volumen de datos de seed es pequeño)
- Búsqueda/filtro de materias dentro de una carrera

---

## 1. Modelo de datos

### Nuevo campo en `subjects`

```python
allowed_turnos = Column(JSON, nullable=True)
```

- `null` → sin restricción, la materia puede asignarse a cualquier turno
- `[1, 3]` → la materia solo puede asignarse a los turnos con esos IDs
- Se almacena como lista de IDs de turno (no nombres, para sobrevivir renombrados)

### Alembic migration

Nueva migración: `ADD COLUMN allowed_turnos JSON` en tabla `subjects`. No necesita backfill — `null` por defecto significa sin restricción.

---

## 2. Backend

### Endpoints nuevos

**`GET /api/careers`**
- Requiere autenticación
- Filtra por `tenant_id` del usuario autenticado
- Respuesta:
```json
[
  { "id": 1, "name": "Ingeniería en Sistemas" },
  { "id": 2, "name": "Licenciatura en Ciencias de la Computación" }
]
```

**`GET /api/careers/{career_id}/subjects`**
- Requiere autenticación
- Valida que la carrera pertenezca al tenant del usuario (404 si no existe o es de otro tenant)
- Un solo query con JOIN a `professor_subjects` y `professors` para evitar N+1
- Respuesta:
```json
[
  {
    "id": 10,
    "name": "Álgebra",
    "year": 1,
    "allowed_turnos": null,
    "professors": [
      { "id": 5, "name": "García, Juan" },
      { "id": 7, "name": "López, Ana" }
    ]
  }
]
```
- Los subjects se devuelven ordenados por `year` ASC, luego `name` ASC

**`PATCH /api/subjects/{subject_id}/turnos`**
- Requiere autenticación
- Valida que el subject pertenezca al tenant del usuario (404 si no)
- Body: `{ "allowed_turnos": [1, 3] }` o `{ "allowed_turnos": null }` para quitar restricción
- Respuesta: el subject actualizado con el mismo shape que en el GET anterior
- No toca ningún otro campo del subject

### Schemas Pydantic

```python
class ProfessorInSubject(BaseModel):
    id: int
    name: str

class SubjectResponse(BaseModel):
    id: int
    name: str
    year: int
    allowed_turnos: Optional[List[int]] = None
    professors: List[ProfessorInSubject] = []

class CareerResponse(BaseModel):
    id: int
    name: str

class SubjectTurnosUpdate(BaseModel):
    allowed_turnos: Optional[List[int]] = None
```

### Router

Nuevo archivo `backend/app/routers/careers.py`, montado en `/api/careers`.

### Tests

```
tests/test_careers.py:
- test_list_careers_returns_tenant_careers
- test_list_careers_excludes_other_tenant
- test_get_subjects_returns_subjects_with_professors
- test_get_subjects_404_wrong_tenant
- test_patch_turnos_updates_allowed_turnos
- test_patch_turnos_null_clears_restriction
- test_patch_turnos_404_wrong_tenant
```

---

## 3. Optimizador

**Archivo:** `backend/app/services/optimizer.py`

Al construir las variables de asignación para cada materia, filtrar los slots válidos:

```python
subject_allowed = subject.allowed_turnos  # None o lista de IDs

for slot in time_slots:
    if subject_allowed and slot["turno_id"] not in subject_allowed:
        continue  # slot no permitido para esta materia
    # crear variable de asignación para (subject, slot)
```

Si `allowed_turnos` es `None` o lista vacía → todos los turnos permitidos (sin restricción). Esta lógica no cambia la estructura del solver, solo reduce el dominio de la variable de asignación por materia.

---

## 4. Frontend

### Estructura de archivos

| Archivo | Cambio |
|---|---|
| `frontend/src/pages/CareersPage.jsx` | Nueva página — orquesta las tres zonas |
| `frontend/src/hooks/useCareers.js` | Fetch `GET /careers` |
| `frontend/src/hooks/useCareerSubjects.js` | Fetch `GET /careers/{id}/subjects`, reload al cambiar carrera seleccionada |
| `frontend/src/components/careers/SubjectPanel.jsx` | Panel lateral — lista de docentes + checkboxes de turnos + botón guardar |
| `frontend/src/components/layout/Sidebar.jsx` | Agrega ítem "Carreras" entre Calendario y Parámetros |
| `frontend/src/App.jsx` | Agrega ruta `/careers` |

### Layout de `CareersPage`

```
┌── columna carreras (w-64, border-r) ──┬──── área materias (flex-1) ────┐
│ [input buscar...]                      │  Ingeniería en Sistemas         │
│                                        │  ───────────────────────────    │
│ ● Ingeniería en Sistemas               │  Año 1                          │
│ ○ Licenciatura en Cs. Comp.            │  Álgebra          [Todos]   [›] │
│ ○ ...                                  │  Análisis Mat.    [Todos]   [›] │
│                                        │  Año 2                          │
│                                        │  Programación II  [M, N]    [›] │
└────────────────────────────────────────┴─────────────────────────────────┘
```

- La lista de carreras tiene un input de búsqueda local (filtra por nombre sin llamar al backend)
- La carrera seleccionada se marca con fondo azul claro
- Las materias se agrupan por año con un header `Año N`
- Cada fila muestra: nombre, badge de turnos (`Todos` si `allowed_turnos` es null, o abreviaciones de nombres de turno si tiene restricciones), ícono chevron para abrir el panel

### Panel lateral (`SubjectPanel`)

- Se superpone desde la derecha (`fixed right-0`, `w-80`, `shadow-xl`) sin empujar el layout
- Header: nombre de la materia + botón cerrar (X)
- Sección "Docentes": lista de nombres de profesores elegibles
- Sección "Turnos habilitados": un checkbox por cada turno del sistema (obtenidos de `useParameters`)
  - Todos marcados si `allowed_turnos` es null
  - Al marcar/desmarcar se actualiza estado local
  - Botón "Guardar" llama `PATCH /subjects/{id}/turnos`
  - Toast de éxito/error al guardar
  - Si se marcan todos → envía `null` (sin restricción) en lugar de lista completa

### Estado de `CareersPage`

```js
const [selectedCareerId, setSelectedCareerId] = useState(null)
const [selectedSubject, setSelectedSubject] = useState(null)  // objeto completo
```

Al guardar turnos en el panel: actualiza el subject en el estado local de `useCareerSubjects` (sin recargar toda la lista).

### Sidebar

Agrega entre Calendario y Parámetros:
```jsx
{navItem('/careers', BookOpen, 'Carreras')}
```

---

## 5. Arquitectura de cambios

### Backend

| Archivo | Cambio |
|---|---|
| `backend/app/models/academic.py` | Agregar `allowed_turnos = Column(JSON, nullable=True)` a `Subject` |
| `backend/alembic/versions/<hash>_add_subject_allowed_turnos.py` | Nueva migración |
| `backend/app/schemas/careers.py` | Nuevos schemas: `CareerResponse`, `SubjectResponse`, `ProfessorInSubject`, `SubjectTurnosUpdate` |
| `backend/app/routers/careers.py` | Nuevo router con los 3 endpoints |
| `backend/app/main.py` | Registrar nuevo router en `/api/careers` |
| `backend/app/services/optimizer.py` | Filtrar slots por `subject.allowed_turnos` |
| `backend/tests/test_careers.py` | 7 tests nuevos |

### Frontend

| Archivo | Cambio |
|---|---|
| `frontend/src/pages/CareersPage.jsx` | Nueva página |
| `frontend/src/hooks/useCareers.js` | Nuevo hook |
| `frontend/src/hooks/useCareerSubjects.js` | Nuevo hook |
| `frontend/src/components/careers/SubjectPanel.jsx` | Nuevo componente |
| `frontend/src/components/layout/Sidebar.jsx` | Agregar ítem Carreras |
| `frontend/src/App.jsx` | Agregar ruta `/careers` |
