# Insights del Optimizador

**Goal:** Acompañar la oferta académica generada con alertas y estadísticas que expliquen el resultado del optimizador, incluyendo materias que no pudieron asignarse y su demanda estimada.

**Tech Stack:** Python 3.11 / FastAPI / SQLAlchemy 2.0 / Alembic · React 18 / Tailwind / shadcn/ui · lucide-react

---

## Contexto

El proceso de generación de oferta es actualmente una caja negra: el usuario sabe cuántos cursos se generaron pero no qué pasó durante la optimización, qué materias quedaron sin asignar, si la solución es óptima o si hay problemas de carga docente o solapamientos. Esta feature agrega un campo `insights` a la oferta que el backend computa y persiste, y un drawer lateral en el frontend que lo renderiza.

---

## Arquitectura

### Flujo de datos

```
optimizer.run_optimizer() → insights_raw (IDs)
       ↓
generate._run_generation() → resuelve nombres → Offer.insights (JSON)
       ↓
GET /offers/{id} → OfferSchema.insights → frontend
       ↓
InsightsDrawer (botón "Ver resumen" en OffersPage header)
```

### Separación de responsabilidades

- **`optimizer.py`**: computa insights usando solo IDs (se mantiene puro). Retorna `insights_raw` junto con `assignments`.
- **`generate.py`**: enriquece `insights_raw` con nombres (subjects, professors) y guarda en `Offer.insights`.
- **`Offer` model**: campo `insights = Column(JSON, nullable=True)`.
- **`OfferSchema`**: incluye `insights` en el response de `GET /offers/{id}`.
- **`InsightsDrawer.jsx`**: renderiza las dos secciones (alertas + estadísticas).

---

## Backend

### Insights que computa el optimizador

#### Alertas

| key | severity | Condición | Datos adicionales |
|---|---|---|---|
| `solver_timeout` | warning | `status == FEASIBLE` (solver alcanzó el timeout) | `timeout_seconds` |
| `unassigned_subjects` | error | Materias sin poder asignar | lista de `{subject_id, reason, demand}` |
| `slot_conflicts` | warning | > 0 cursos del mismo año/carrera en el mismo horario | `count` (cantidad de conflictos) |
| `professor_overload` | warning | Algún docente supera el 80% del límite de horas semanales | lista de `{professor_id, hours_assigned, hours_limit}` |

#### Estadísticas

| key | Datos |
|---|---|
| `courses_assigned` | `count` — total cursos asignados |
| `slot_distribution` | `{turno_name: count}` — cursos por nombre de turno |
| `classroom_peak` | `{peak: int, limit: int}` — máx. cursos simultáneos vs aulas disponibles |

#### Motivos para `unassigned_subjects`

- `"no_professors"` — la materia no tiene docentes elegibles en `professor_subjects`
- `"no_valid_slot"` — tiene docentes pero todos los slots están bloqueados por `allowed_turnos`
- `"infeasible"` — el problema global resultó infactible (constraints mutuamente excluyentes)

### Estructura de cada insight

```python
{
    "type": "alert" | "stat",
    "severity": "error" | "warning" | "info" | None,
    "key": str,
    "title": str,          # enriquecido con nombres en generate.py
    "value": str | int | None,   # para stats simples
    "items": list | None,        # para listas de detalles
}
```

### Ejemplo de payload `insights`

```json
[
  {
    "type": "alert",
    "severity": "warning",
    "key": "solver_timeout",
    "title": "Solución no óptima",
    "value": "El solver alcanzó el límite de 30 segundos. Puede existir una mejor distribución.",
    "items": null
  },
  {
    "type": "alert",
    "severity": "error",
    "key": "unassigned_subjects",
    "title": "2 materia(s) sin asignar",
    "value": null,
    "items": [
      {"name": "Álgebra I", "demand": 47, "reason": "no_professors"},
      {"name": "Física II", "demand": 23, "reason": "no_valid_slot"}
    ]
  },
  {
    "type": "stat",
    "severity": null,
    "key": "courses_assigned",
    "title": "Cursos asignados",
    "value": 18,
    "items": null
  },
  {
    "type": "stat",
    "severity": null,
    "key": "slot_distribution",
    "title": "Distribución por turno",
    "value": null,
    "items": [
      {"name": "Mañana", "count": 10},
      {"name": "Tarde", "count": 8}
    ]
  },
  {
    "type": "stat",
    "severity": null,
    "key": "classroom_peak",
    "title": "Pico de aulas",
    "value": null,
    "items": [{"peak": 7, "limit": 10}]
  }
]
```

### Cambios en archivos backend

| Archivo | Cambio |
|---|---|
| `backend/app/services/optimizer.py` | Agregar cómputo de `insights_raw` (con IDs), retornar junto con `assignments` |
| `backend/app/services/generate.py` | Resolver nombres en insights, guardar `Offer.insights` |
| `backend/app/models/offer.py` | Agregar `insights = Column(JSON, nullable=True)` |
| `backend/alembic/versions/<hash>_add_offer_insights.py` | Migración: `op.add_column('offers', sa.Column('insights', sa.JSON(), nullable=True))` |
| `backend/app/schemas/offer.py` | Agregar `insights: list | None = None` a `OfferSchema` |
| `backend/app/routers/offers.py` | Incluir `insights=offer.insights` en `GET /offers/{id}` |

---

## Frontend

### Componente `InsightsDrawer`

- Panel lateral fijo (fixed) desde la derecha, igual patrón que `SubjectPanel`
- Se abre con botón "Ver resumen" en el header de `OffersPage`
- Solo visible cuando `offer` está cargado

#### Sección Alertas

Muestra solo los insights con `type == "alert"`, ordenados por severidad (`error` primero, luego `warning`). Ícono según severidad:
- 🔴 `error` → `AlertCircle` rojo
- 🟡 `warning` → `AlertTriangle` amarillo

Para `unassigned_subjects`: tabla con columnas Materia / Demanda / Motivo (el motivo se traduce: `no_professors` → "Sin docentes", `no_valid_slot` → "Turno restringido", `infeasible` → "Sin solución").

Para `professor_overload`: lista de docentes con barra de progreso de horas.

Para `slot_conflicts` y `solver_timeout`: mensaje simple con ícono.

#### Sección Estadísticas

Muestra los insights con `type == "stat"`:
- `courses_assigned`: número grande destacado
- `slot_distribution`: lista con nombre de turno y cantidad (sin gráfico)
- `classroom_peak`: "Pico: X / Y aulas" con indicador visual si peak > 80% del límite

### Cambios en archivos frontend

| Archivo | Cambio |
|---|---|
| `frontend/src/components/offers/InsightsDrawer.jsx` | Nuevo componente drawer |
| `frontend/src/pages/OffersPage.jsx` | Botón "Ver resumen" en header, estado `showInsights`, renderizar `InsightsDrawer` |

---

## Constraints

- No agregar paquetes npm ni Python nuevos
- Test command: `cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v`
- Alembic command: `cd backend && PYTHONPATH=. .venv/bin/alembic revision --autogenerate -m "add_offer_insights"`
- Multi-tenant: todos los queries filtran por `tenant_id` (no cambia — insights se guardan en `Offer` que ya tiene tenant)
- Ofertas existentes en DB tendrán `insights = null` — el drawer muestra "Sin datos de análisis disponibles" en ese caso
- `insights_raw` del optimizer usa IDs; `generate.py` resuelve nombres antes de persistir
- El drawer es de solo lectura — no hay acciones dentro de él
