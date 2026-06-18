# Academic Offer Generator — Guía de desarrollo

## Stack y estructura

- **Backend**: Python 3.11, FastAPI, SQLAlchemy 2.0, Alembic, OR-Tools CP-SAT
- **Frontend**: React 18, Vite 5, Axios
- **DB**: PostgreSQL 16 vía Docker Compose

```
backend/app/
  routers/       # Endpoints FastAPI (auth, generate, offers, parameters, careers)
  services/      # Lógica de negocio (optimizer, demand_analyzer, data_layer, parameter_service)
  models/        # SQLAlchemy ORM
  schemas/       # Pydantic (validación/serialización)
```

## Reglas del proyecto

### Configuración y parámetros

- **NUNCA hardcodear** valores configurables (límite de alumnos, horas docente, timeout del solver).
- Todo valor de configuración vive en `GlobalParameters` / `TenantParameters` y se obtiene a través de `parameter_service.get_effective_parameters()`.
- Los overrides por tenant ya están resueltos en esa función; no reimplementar esa lógica.

### Base de datos y migraciones

- Cualquier cambio en `models/` **requiere una migración Alembic** antes de mergear.
- Generar con: `alembic revision --autogenerate -m "descripción"` y revisar el archivo generado.
- Nunca modificar una migración ya aplicada en producción; crear una nueva.

### Optimizador CP-SAT

- Las restricciones nuevas van en `services/optimizer.py`, dentro de `run_optimizer()`.
- Cada restricción nueva debe tener al menos un test en `tests/test_optimizer.py`.
- Usar `model.Add(...)` para restricciones hard; soft constraints via objetivo.
- Para restricciones de turno, verificar siempre el campo `allowed_turnos` en el curso.

### API y autenticación

- Todos los endpoints (excepto `/auth/token`) requieren `Depends(get_current_user)`.
- Las operaciones largas (generación de oferta) deben usar `BackgroundTasks`; el cliente recibe un job ID y consulta el estado con polling.
- Errores se devuelven con el código HTTP correcto y `detail` descriptivo en español.

### Frontend

- Todas las llamadas HTTP van por `src/api/client.js` (tiene interceptor JWT y manejo de 401).
- No usar `fetch` ni instancias de Axios fuera de ese cliente.
- Estado global de autenticación en `AuthContext`; no duplicar en localStorage manualmente.

### Tests

- Correr `pytest` desde `backend/` antes de considerar un feature completo.
- Los tests de optimizer usan datos sintéticos pequeños; mantener ese patrón para velocidad.
- No mockear la DB en tests de integración; usar la fixture `db` de `conftest.py`.

### Documentación

- **Al finalizar toda nueva feature o modificación significativa**, actualizar `README.md` para reflejar los cambios: nuevos endpoints, parámetros, componentes de UI, comportamientos del optimizador, o cualquier instrucción de uso que haya cambiado.
- No crear documentación en archivos separados; mantener `README.md` como fuente única de verdad para quien usa/desarrolla el proyecto.
- El README debe describir QUÉ hace el sistema y CÓMO usarlo; no incluir detalles de implementación interna (esos van en comentarios de código o mensajes de commit).

### Información sensible

- **NUNCA incluir en README, comentarios, código ni ningún archivo del repositorio**: contraseñas, tokens, API keys, cadenas de conexión con credenciales, usuarios reales, o cualquier secreto.
- Los secretos van exclusivamente en `.env` (ignorado por git); documentar solo que existe un `.env.example` con las variables necesarias.
- **Ante cualquier duda sobre si un dato es sensible, detener la acción y pedir confirmación al usuario antes de continuar.**

## Comandos útiles

Ver `/seed-db`, `/run-tests` y `/dev` en `.claude/commands/`.
