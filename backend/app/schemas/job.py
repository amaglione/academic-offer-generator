from pydantic import BaseModel
from typing import Optional


class JobResponse(BaseModel):
    job_id: str
    status: str
    offer_id: Optional[int] = None
    error: Optional[str] = None
