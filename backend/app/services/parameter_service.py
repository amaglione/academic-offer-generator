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
