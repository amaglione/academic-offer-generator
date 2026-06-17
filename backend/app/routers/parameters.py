from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.tenant import User
from app.schemas.parameters import ParametersResponse, ParametersUpdate
from app.services.parameter_service import get_effective_parameters, save_tenant_parameters

router = APIRouter()


@router.get("", response_model=ParametersResponse)
def get_parameters(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_effective_parameters(db, current_user.tenant_id)


@router.put("", response_model=ParametersResponse)
def update_parameters(
    body: ParametersUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updates = body.model_dump(exclude_none=True)
    if "time_slots" in updates:
        updates["time_slots"] = [s.model_dump() for s in body.time_slots]
    return save_tenant_parameters(db, current_user.tenant_id, updates)
