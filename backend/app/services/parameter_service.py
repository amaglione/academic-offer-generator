from sqlalchemy.orm import Session
from app.models.parameters import GlobalParameters, TenantParameters, DEFAULT_TIME_SLOTS

PARAM_FIELDS = [
    "max_students_per_course",
    "max_weekly_hours_per_professor",
    "available_classrooms",
    "solver_timeout_seconds",
    "time_slots",
]


def get_effective_parameters(db: Session, tenant_id: int) -> dict:
    global_params = db.query(GlobalParameters).filter(GlobalParameters.id == 1).first()
    tenant_params = db.query(TenantParameters).filter(TenantParameters.tenant_id == tenant_id).first()

    result = {field: getattr(global_params, field) for field in PARAM_FIELDS}
    if result["time_slots"] is None:
        result["time_slots"] = DEFAULT_TIME_SLOTS

    if tenant_params:
        for field in PARAM_FIELDS:
            override = getattr(tenant_params, field, None)
            if override is not None:
                result[field] = override

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
