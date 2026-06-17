import uuid
import threading
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Optional


@dataclass
class Job:
    id: str
    tenant_id: int
    status: str = "running"  # running | done | failed
    result: dict = field(default_factory=dict)
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


_jobs: Dict[str, Job] = {}
_lock = threading.Lock()


def create_job(tenant_id: int) -> str:
    job_id = str(uuid.uuid4())
    with _lock:
        _jobs[job_id] = Job(id=job_id, tenant_id=tenant_id)
    return job_id


def get_job(job_id: str) -> Optional[Job]:
    return _jobs.get(job_id)


def finish_job(job_id: str, result: dict):
    with _lock:
        if job_id in _jobs:
            _jobs[job_id].status = "done"
            _jobs[job_id].result = result


def fail_job(job_id: str, error: str):
    with _lock:
        if job_id in _jobs:
            _jobs[job_id].status = "failed"
            _jobs[job_id].error = error
