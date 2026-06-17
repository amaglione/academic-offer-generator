# Generador Automático de Oferta Académica — Diseño

**Fecha:** 2026-06-16  
**Estado:** Revisado — pendiente de aprobación final

---

## Resumen

Sistema independiente que genera automáticamente la oferta académica del próximo cuatrimestre a partir del historial académico de los alumnos, el plan de estudios vigente, la disponibilidad docente y la capacidad física de la institución. En esta versión (v1), los datos de entrada provienen de un dataset de simulación precargado que representa fielmente la estructura de SIGEDU. Un administrador revisa y aprueba la oferta generada antes de publicarla para inscripciones.

---

## Terminología

- **Materia**: asignatura definida en el plan de estudios (ej: "Análisis Matemático I").
- **Curso**: instancia específica de una materia en un cuatrimestre, con docente y franja horaria asignados (ej: "Análisis Matemático I · Prof. García · Lunes 18-21hs").
- **Oferta académica**: conjunto de cursos generados para un cuatrimestre.

---

## Arquitectura general

El sistema es completamente independiente de SIGEDU. Tiene su propia base de datos, backend y frontend. En v1, los datos de entrada se cargan desde un dataset de simulación en lugar de conectarse a SIGEDU directamente.

```
Dataset de simulación  →(seed)→  Backend FastAPI (Python)  →(REST)→  Frontend React
                                          ↕
                                   BD propia (PostgreSQL)
```

### Componentes del backend

| Componente | Responsabilidad |
|---|---|
| **Data Layer** | Carga historial académico, planes de estudio y docentes desde la BD propia (poblada con el dataset de simulación) |
| **Demand Analyzer** | Calcula demanda por materia y número de cursos a abrir |
| **Optimization Engine** (OR-Tools CP-SAT) | Asigna docente y franja a cada curso |
| **Parameter Store** | Persiste la configuración del administrador |
| **Offer Store** | Guarda ofertas generadas y su estado |

### Base de datos propia

Tablas de datos de entrada (pobladas por el dataset de simulación, todas con `tenant_id`):

- `careers` — id, tenant_id, nombre
- `subjects` — id, tenant_id, nombre, career_id, año de cursada
- `prerequisites` — subject_id, requires_subject_id
- `professors` — id, tenant_id, nombre
- `professor_subjects` — professor_id, subject_id
- `students` — id, tenant_id, career_id
- `academic_history` — student_id, subject_id, aprobada (bool)

Tablas operativas (todas con `tenant_id`):

- `tenants` — id, nombre, activo (bool)
- `users` — id, tenant_id, username, hashed_password, activo (bool)
- `global_parameters` — reglas globales por defecto
- `tenant_parameters` — overrides por tenant (campos nulos heredan el global)
- `offers` — id, tenant_id, cuatrimestre, fecha de generación, estado (`borrador` / `publicada`)
- `courses` — id, offer_id, subject_id, professor_id, franja, cantidad_alumnos_esperados, modificado_por_admin (bool)

---

## Flujo de generación

### 1. Dataset de simulación

El sistema incluye un script de seed que carga la BD propia con datos representativos de una universidad real:
- **Carreras y plan de estudios:** 2-3 carreras con 30-50 materias cada una, correlativas definidas por año de cursada.
- **Alumnos:** ~500 alumnos con historial académico variado (alumnos avanzados, regulares, con materias pendientes de distintos años).
- **Docentes:** ~40 docentes con sus materias asignadas.

El Data Layer lee estos datos directamente desde la BD propia. El diseño del Data Layer está preparado para ser reemplazado por queries a SIGEDU en una v2 sin cambios en el resto del sistema.

### 2. Análisis de demanda

Por cada materia:
1. Contar alumnos habilitados: tienen todas las correlativas aprobadas y aún no aprobaron la materia.
2. Calcular cursos necesarios: `⌈demanda / max_alumnos_por_curso⌉`.
3. Aplicar restricción global: la cantidad de cursos activos en simultáneo no puede superar la cantidad de aulas disponibles.

### 3. Motor de optimización (OR-Tools CP-SAT)

**Variables:** `asignacion[curso][docente][franja] ∈ {0, 1}`

**Restricciones duras:**
- Un docente no puede tener dos cursos en la misma franja horaria.
- Un docente no puede superar el máximo de horas semanales configurado.
- Un docente solo puede ser asignado a materias que tiene asignadas en SIGEDU.
- La cantidad de cursos activos en simultáneo no puede superar la cantidad de aulas disponibles.
- Cada curso recibe exactamente un docente y una franja horaria.

**Función objetivo (minimizar):**
- Conflictos entre materias del mismo año/cuatrimestre de una carrera (cursos que se solapan y perjudican a alumnos que cursan varias materias simultáneamente).
- Concentración excesiva de cursos en pocas franjas (distribuir la carga a lo largo de la semana).

**Timeout:** 600 segundos (configurable). Si se alcanza el límite, el solver devuelve la mejor solución encontrada hasta ese momento.

### 4. Resultado

La oferta generada se persiste en la BD propia con estado `borrador`. Cada curso incluye: materia, docente asignado, franja horaria y cantidad de alumnos esperados.

---

## Multitenancy

El sistema es compartido por múltiples universidades (tenants) en una única instancia. Cada tenant tiene sus datos completamente aislados. Lo único compartido es el código y las reglas globales por defecto.

### Aislamiento de datos

Todas las tablas operativas y de datos de entrada incluyen `tenant_id`. Un usuario autenticado solo puede acceder a datos de su propio tenant.

### Reglas globales y por tenant

Las reglas del optimizador se resuelven en dos capas:

1. **Reglas globales (defaults):** definidas por el administrador del sistema, aplican a todos los tenants que no tengan override.
2. **Reglas por tenant (overrides):** cada universidad puede sobreescribir cualquier regla global con sus propios valores.

El solver siempre recibe las **reglas efectivas** = global + overrides del tenant (los overrides tienen precedencia).

Reglas configurables:
- Franjas horarias disponibles.
- Máximo de alumnos por curso.
- Máximo de horas semanales por docente.
- Cantidad de aulas disponibles.
- Timeout del solver.

### Tablas adicionales

- `tenants` — id, nombre, activo (bool)
- `users` — id, tenant_id, username, hashed_password, activo (bool)
- `global_parameters` — reglas globales por defecto (una sola fila)
- `tenant_parameters` — overrides por tenant (tenant_id + campos que sobreescriben; campos nulos heredan el global)

## Autenticación

Login con usuario y contraseña. El backend emite un JWT que incluye el `tenant_id` del usuario. Todos los endpoints requieren el token en `Authorization: Bearer <token>` y filtran automáticamente los datos por `tenant_id`.

Los usuarios se crean vía script de seed en v1 (no hay UI de gestión de usuarios).

---

## API REST (FastAPI)

```
POST   /api/auth/login                            Autenticación, devuelve JWT (incluye tenant_id)
POST   /api/auth/logout                           Invalida el token

POST   /api/generate                              Dispara la optimización para el tenant del usuario
GET    /api/jobs/{job_id}                         Estado del proceso: running / done / failed

GET    /api/offers                                Lista de ofertas del tenant
GET    /api/offers/{id}                           Detalle de una oferta con todos sus cursos
PATCH  /api/offers/{id}/courses/{course_id}       Admin ajusta docente o franja de un curso
POST   /api/offers/{id}/approve                   Aprueba la oferta

GET    /api/parameters                            Reglas efectivas del tenant (global + overrides)
PUT    /api/parameters                            Guarda overrides del tenant
```

---

## Interfaz de administración (React)

### Pantalla de login

Formulario de usuario y contraseña. Al autenticarse, el token JWT se guarda en memoria (no en localStorage) y se incluye en todas las requests. Si el token expira, redirige al login automáticamente.

### Panel de parámetros

Permite configurar antes de generar:
- Franjas horarias disponibles (días y rangos de hora).
- Máximo de alumnos por curso.
- Máximo de horas semanales por docente.
- Cantidad de aulas disponibles.
- Timeout del solver (segundos).

### Vista de calendario

Grilla semanal (días × franjas horarias). Cada celda muestra los cursos asignados a esa franja.

- Cursos coloreados por año de cursada para detectar visualmente conflictos entre materias del mismo año.
- Cursos con conflictos detectados se marcan en rojo con indicador de advertencia.
- Cursos ajustados manualmente por el admin se distinguen visualmente de los generados automáticamente.

**Filtro por carrera:** dropdown multi-selección que permite ver la oferta de una o varias carreras simultáneamente.

**Acciones del admin:**
- Mover un curso a otra franja (si genera conflicto, se marca en rojo pero no se bloquea la acción).
- Cambiar el docente de un curso (dropdown con docentes habilitados para esa materia).
- **Regenerar:** corre el optimizador desde cero descartando el borrador actual. Requiere confirmación del usuario. Útil si cambió parámetros o si prefiere un nuevo intento sobre ajustar manualmente.
- **Aprobar oferta:** publica la oferta (estado → `publicada`).

---

## Manejo de errores

| Situación | Comportamiento |
|---|---|
| No hay solución feasible | Mensaje claro al admin indicando el cuello de botella (ej: "faltan franjas horarias") |
| Docente sin horas suficientes para todas sus materias | El solver asigna lo que puede; reporta las materias que quedaron sin docente |
| Se alcanza el timeout | Se devuelve la mejor solución parcial encontrada hasta el momento |
| Admin mueve curso a franja conflictiva | La UI marca el conflicto en rojo en tiempo real; el admin decide si lo deja o revierte |

---

## Testing

- **Unitarios:** Demand Analyzer (cálculo de demanda y número de cursos por materia).
- **Integración del motor:** casos con solución conocida, casos infeasibles, casos que llegan al timeout.
- **API:** FastAPI TestClient para todos los endpoints.
- **UI:** prueba manual dado el alcance del proyecto.

---

## Fuera de alcance (v1)

- Integración directa con la BD de SIGEDU (reemplazada por dataset de simulación).
- Asignación de aula específica a cada curso (solo se controla la capacidad global).
- Modelo de comisiones-cohort (grupos de alumnos que cursan múltiples materias juntos).
- Escritura de resultados de vuelta en SIGEDU.
- Gestión de usuarios y tenants desde la UI (se crean vía script de seed).
- Panel de administración global (gestión de tenants y reglas globales).

## Roadmap v2

- **Restricciones personalizadas por tenant:** cada universidad podrá activar/desactivar restricciones adicionales del optimizador (ej: "ningún docente puede dar más de 2 franjas consecutivas", "las materias de primer año solo se dictan a la mañana"). En v1 las restricciones son fijas para todos los tenants y solo varían los parámetros numéricos.
- Integración directa con la BD de SIGEDU vía queries SQL.
- Asignación de aula específica a cada curso.
- Gestión de usuarios y tenants desde la UI.
