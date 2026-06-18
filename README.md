# Generador de Oferta Académica

Sistema que genera automáticamente la oferta académica de una universidad a partir del historial académico de los alumnos, el plan de estudios, la disponibilidad docente y la capacidad de aulas. Un administrador revisa y aprueba la oferta antes de publicarla.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0, Alembic |
| Base de datos | PostgreSQL 16 |
| Optimizador | OR-Tools CP-SAT (Google) |
| Autenticación | JWT (python-jose + passlib) |
| Frontend | React 18, Vite 5, Axios |
| Infraestructura | Docker Compose |

## Arquitectura

```
Dataset de simulación →(seed)→ Backend FastAPI →(REST)→ Frontend React
                                      ↕
                               PostgreSQL (Docker)
```

El backend tiene 5 componentes principales:

- **Data Layer** — lee carreras, materias, alumnos e historial desde la BD
- **Demand Analyzer** — calcula alumnos habilitados por materia y cursos necesarios
- **Optimizer (CP-SAT)** — asigna docente + franja a cada curso respetando restricciones
- **Parameter Store** — reglas globales con overrides por tenant
- **Offer Store** — persistencia de ofertas y estado (borrador / publicada)

## Estructura del proyecto

```
academic-offer-generator/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   ├── models/          # SQLAlchemy: tenant, academic, parameters, offer
│   │   ├── schemas/         # Pydantic: auth, parameters, offer, job
│   │   ├── routers/         # auth, generate, offers, parameters
│   │   └── services/        # auth, data_layer, demand_analyzer, optimizer, parameter, job_store
│   ├── seed/
│   │   └── seed.py          # Carga 2 carreras, 380 alumnos, 40 docentes
│   ├── tests/               # 11 tests (pytest)
│   ├── alembic/             # Migraciones
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── api/client.js        # Axios + interceptor JWT
│       ├── context/AuthContext.jsx
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── OffersPage.jsx   # Calendario + generación + aprobación
│       │   └── ParametersPage.jsx
│       └── components/
│           ├── CalendarGrid.jsx
│           ├── CourseCard.jsx
│           ├── CareerFilter.jsx
│           └── CourseEditModal.jsx
└── docker-compose.yml
```

## Levantar el proyecto

### Requisitos

- Docker Desktop
- Python 3.11
- Node.js 20+
- [uv](https://github.com/astral-sh/uv) (gestor de paquetes Python)

### 1. Base de datos

```bash
docker compose up db -d
```

### 2. Backend

```bash
cd backend

# Crear entorno virtual e instalar dependencias
uv venv --python 3.11
uv pip install -r requirements.txt

# Copiar variables de entorno
cp .env.example .env

# Crear tablas
.venv/bin/alembic upgrade head

# Cargar datos de simulación
.venv/bin/python -m seed.seed

# Levantar servidor
PYTHONPATH=. .venv/bin/uvicorn app.main:app --reload
```

El backend queda disponible en `http://localhost:8000`.  
Documentación interactiva: `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend queda disponible en `http://localhost:5173`.

## API

```
POST   /api/auth/login                       Autenticación, devuelve JWT
POST   /api/auth/logout

POST   /api/generate?semester=2026-2         Lanza optimizador en background
GET    /api/jobs/{job_id}                    Estado del job: running / done / failed

GET    /api/offers                           Lista de ofertas del tenant
GET    /api/offers/{id}                      Detalle con todos los cursos
PATCH  /api/offers/{id}/courses/{course_id}  Editar docente o franja de un curso
POST   /api/offers/{id}/approve              Publicar oferta

GET    /api/parameters                       Parámetros efectivos (global + overrides)
PUT    /api/parameters                       Guardar overrides del tenant
```

## Tests

```bash
cd backend
PYTHONPATH=. .venv/bin/pytest tests/ -v
```

11 tests cubriendo: auth, parameters, demand analyzer, optimizer y offers API.

## Flujo de uso

1. **Login** en `http://localhost:5173`
2. *(Opcional)* Ajustar parámetros del optimizador en la página de Parámetros
3. Hacer clic en **"Generar oferta"** — el optimizador corre en background (puede tardar varios minutos)
4. Revisar el **calendario semanal** con los cursos asignados por franja horaria
5. Filtrar por carrera con el dropdown multi-selección
6. Hacer clic en un curso para editar docente o franja
7. Hacer clic en **"✓ Aprobar oferta"** para publicarla

Los cursos se colorean por año de cursada (azul=1°, verde=2°, violeta=3°, naranja=4°, rojo=5°). Los cursos modificados manualmente se marcan con ✎.

## Multitenancy

El sistema soporta múltiples universidades en una misma instancia. Cada tenant tiene sus datos completamente aislados. Las reglas del optimizador se resuelven en dos capas: defaults globales + overrides por tenant.
