# Generador de Oferta Académica
### Introducción al Desarrollo de Software Asistido por IA

---

## Introducción y descripción del trabajo

**Problema:** Armar la oferta académica de una universidad es un proceso complejo y en muchos casos termina siendo manual. 
Diversos factores afectan al armado de una oferta: rendimiento academico de los alumnos activos, docentes habilitados, franjas horarias, capacidad de aulas, etc.

**Solución:** Este trabajo tiene por objetivo el armado de un sistema web que automatiza este proceso mediante un **optimizador combinatorial** (CP-SAT de Google OR-Tools). El usuario ingresa datos académicos, presiona "Generar" y obtiene un calendario editable con asignaciones optimizadas.

**Alcance del MVP:**
- Gestión de carreras, materias, docentes y alumnos con historial académico
- Análisis de demanda automático (cuántos alumnos pueden cursar cada materia)
- Generación de oferta mediante optimización matemática
- Visualización en calendario con edición manual
- Insights del optimizador: alertas y estadísticas post-generación
- Arquitectura **multi-tenant**: múltiples universidades en una sola instancia

---

## Tecnologías

### Backend
| Componente | Tecnología |
|---|---|
| Lenguaje | Python 3.11 |
| API | FastAPI |
| ORM / Migraciones | SQLAlchemy 2.0 + Alembic |
| Base de datos | PostgreSQL (SQLite en tests) |
| Optimizador | Google OR-Tools — CP-SAT solver |
| Autenticación | JWT (python-jose) |
| Testing | pytest — 59 tests |

### Frontend
| Componente | Tecnología |
|---|---|
| Framework | React 18 + Vite |
| Estilos | Tailwind CSS + shadcn/ui |
| Íconos | lucide-react |
| HTTP client | axios con interceptores JWT |
| Notificaciones | sonner (toasts) |

---

## Modelo de datos

```
Tenant (universidad)
  └── Career (carrera)
        └── Subject (materia)  ←→  Professor (docente)
                                         ↑
                                   ProfessorSubject
  └── Student (alumno)
        └── AcademicHistory (materia / aprobada)

  └── Offer (oferta semestral)
        └── Course (materia + docente + franja + alumnos estimados)
              └── insights (alertas y estadísticas del solver)
```

**Flujo de generación:**
```
Datos académicos
    → demand_analyzer (calcula demanda y elegibilidad)
    → optimizer CP-SAT (asigna docentes y franjas)
    → _compute_insights (alertas + estadísticas)
    → Offer persistida en DB
    → GET /offers/{id} → frontend
```

---

## Reglas del motor de optimización

El optimizador usa **programación por restricciones** (CP-SAT). Define variables booleanas `x[curso, docente, franja]` y las siguientes reglas:

### Restricciones duras (no se pueden violar)
1. **Asignación única:** cada curso debe asignarse a exactamente un par (docente, franja horaria).
2. **Sin doble reserva docente:** un docente no puede dar dos cursos en la misma franja.
3. **Límite de horas semanales:** la suma de horas asignadas a un docente no puede superar el máximo configurado.
4. **Capacidad de aulas:** la cantidad de cursos simultáneos no puede superar el número de aulas disponibles.
5. **Turnos permitidos por materia:** una materia puede tener restricciones de turnos.

### Pre-procesamiento (demand_analyzer)
- Solo se incluyen materias con **alumnos elegibles** (que aprobaron los prerequisitos y aún no aprobaron la materia)
- Solo se incluyen materias con **al menos un docente** habilitado para dictarlas
- La cantidad de cursos por materia se calcula como `ceil(demanda / max_alumnos_por_curso)`

### Objetivo de optimización (restricciones blandas)
- **Minimizar solapamientos:** penaliza que materias del mismo año/carrera caigan en la misma franja horaria.
- **Balancear carga:** penaliza franjas con muchos más cursos que el promedio.
- Si el solver alcanza el timeout → devuelve la mejor solución encontrada hasta ese momento (status `feasible`, no `optimal`)

---

## Decisiones de diseño

### 1. CP-SAT en lugar de heurísticas
**Decisión:** usar un solver de programación por restricciones en lugar de algoritmos greedy o genéticos.
**Razonamiento:** garantiza optimalidad (o falla explícita con razón concreta). Las heurísticas pueden dar soluciones "razonables" sin garantías.

### 2. Generación como background task
**Decisión:** el endpoint `POST /generate` devuelve inmediatamente un `job_id`; el solver corre en background.
**Razonamiento:** la optimización puede tardar minutos. Bloquear la API degradaría la experiencia y agotaría timeouts.

### 3. Multi-tenant desde el día 1
**Decisión:** todas las tablas tienen `tenant_id`; todos los queries filtran por él.
**Razonamiento:** agregar multi-tenancy retroactivamente es costoso y riesgoso. Hacerlo desde el inicio no agrega complejidad significativa.

### 4. Insights en el backend
**Decisión:** `_compute_insights` corre en `generate.py` (no en el frontend) y persiste el resultado en `Offer.insights`.
**Razonamiento:** el backend tiene acceso a todos los datos con nombres resueltos. El frontend solo renderiza. Además, las estadísticas quedan disponibles para consultas futuras sin recalcular.

### 5. Partial infeasibility
**Decisión:** si una materia no tiene turno válido, el solver continúa asignando las demás (en lugar de abortar todo).
**Razonamiento:** reportar "Física II no tiene turno válido" es mucho más útil que "la generación falló". Las otras 20 materias pueden asignarse correctamente.

### 6. Sesión persistente con localStorage
**Decisión:** `{ token, username }` se guarda en `localStorage` al hacer login.
**Razonamiento:** UX básica — recargar la página no debería forzar un nuevo login. El interceptor de 401 limpia el storage automáticamente ante token expirado.

---

## Cómo Claude ayudó

### Herramienta usada
**Claude Code** (CLI) con el plugin **Superpowers** — un conjunto de skills que estructura el proceso de desarrollo asistido por IA.

### Flujo de trabajo por feature
```
/brainstorming
    → Claude hace preguntas una a la vez
    → propone 2-3 enfoques con trade-offs
    → el usuario elige

    → Claude escribe el diseño (spec)
    → el usuario lo revisa y aprueba

/writing-plans
    → Claude genera un plan de implementación paso a paso
    → cada tarea con código exacto, tests, comandos

/subagent-driven-development
    → un subagente implementa cada tarea (contexto limpio)
    → otro subagente revisa: spec ✅/❌ + calidad de código
    → si hay findings importantes → un subagente fixer
    → review final de todo el branch

/finishing-a-development-branch
    → verifica tests → ofrece merge/PR/discard
```

### Skills de Superpowers usadas

| Skill | Propósito |
|---|---|
| `brainstorming` | Diseño colaborativo: qué construir y cómo |
| `writing-plans` | Plan TDD paso a paso con código exacto |
| `subagent-driven-development` | Implementer + reviewer frescos por tarea |
| `requesting-code-review` | Review final de rama completa |
| `finishing-a-development-branch` | Cierre controlado (tests → push/PR) |
| `systematic-debugging` | Diagnóstico con root cause analysis |

### Qué aportó Claude concretamente

- **Diseño:** propuso la arquitectura de multi-tenant, el flujo de background task + job store, la separación demand_analyzer / optimizer / generate
- **Implementación:** escribió el 100% del código (backend + frontend + tests + migraciones)
- **Reviews:** los subagentes de review detectaron bugs reales, por ejemplo:
  - *(C1)* El modelo CP-SAT vacío devolvía `"optimal"` cuando todas las materias tenían turno restringido — se confundía con éxito
  - *(I1)* `slot_distribution` ordenaba turnos alfabéticamente ("Noche" antes que "Tarde") en lugar de por orden de definición
  - *(fix)* `TurnosBadge` no distinguía `null` (todos los turnos) de `[]` (ningún turno)
- **Debugging:** diagnosticó que las materias nunca cargaban porque faltaba correr la migración de Alembic que agregaba `allowed_turnos`

---

## Features desarrolladas

| Feature | Descripción |
|---|---|
| Motor CP-SAT | Asignación óptima de cursos con restricciones duras y blandas |
| Analizador de demanda | Calcula alumnos elegibles considerando prerequisitos y aprobaciones |
| Calendario visual | Vista por turnos/días con drag & drop para edición manual |
| Turnos configurables | Parámetros globales: turnos, días, duración, aulas, límite horario docente |
| Configuración por materia | Restricción de turnos permitidos por materia desde la UI |
| Pantalla de carreras | Vista de materias por año con docentes habilitados |
| Login persistente | Sesión que sobrevive reinicios del browser vía localStorage |
| Insights del optimizador | Drawer con alertas (timeout, sin asignar, solapamientos, carga docente) y estadísticas |
| Exportación | Oferta publicada exportable como JSON estructurado |

---

## Próximos pasos

1. **Notificaciones en tiempo real** — WebSocket o polling en el frontend para avisar cuando el job termina (hoy el usuario recarga)

2. **Gestión de alumnos desde la UI** — actualmente el historial académico se carga directamente en la DB; agregar endpoints y pantalla de carga

3. **Comparación entre versiones** — poder ver diferencias entre la oferta actual y la anterior antes de aprobar

4. **Restricciones de carga por carrera** — hoy el límite de horas es global; permitir configurarlo por carrera o departamento

5. **Export a formatos institucionales** — PDF con formato oficial, Excel para sistemas académicos existentes

6. **Sugerencias para materias sin docentes** — en lugar de silenciar materias sin profesores asignados, sugerir docentes con perfil compatible

7. **Dashboard de demanda** — visualización de cuántos alumnos están esperando cada materia, para planificación de contrataciones

---

## Conclusión

El proyecto demostró que **Claude Code puede actuar como un co-desarrollador completo**: no solo escribe código sino que diseña arquitecturas, propone trade-offs, detecta bugs en revisiones independientes y mantiene la calidad a través de todo el ciclo.

El flujo Superpowers (brainstorming → spec → plan → subagentes implementer/reviewer) permitió desarrollar un sistema con:
- **59 tests automatizados** pasando
- **Arquitectura multi-tenant** limpia desde el inicio
- **Reviews independientes** que detectaron bugs que un solo agente hubiera pasado por alto

El rol del humano fue definir **qué** construir, tomar decisiones de diseño entre opciones propuestas y aprobar cada etapa — Claude se encargó del **cómo**.
