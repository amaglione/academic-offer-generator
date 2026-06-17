from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.dependencies import get_current_user
from app.models.tenant import User
from app.models.offer import Offer, Course
from app.schemas.job import JobResponse
from app.services import job_store, data_layer, demand_analyzer, optimizer, parameter_service

router = APIRouter()


def _run_generation(job_id: str, tenant_id: int, semester: str):
    db = SessionLocal()
    try:
        params = parameter_service.get_effective_parameters(db, tenant_id)
        subjects = data_layer.get_subjects(db, tenant_id)
        prerequisites = data_layer.get_prerequisites(db)
        professors = data_layer.get_professors(db, tenant_id)
        prof_subjects = data_layer.get_professor_subjects(db)
        students = data_layer.get_students_with_history(db, tenant_id)

        demand = demand_analyzer.analyze_demand(subjects, prerequisites, students, prof_subjects, params)
        result = optimizer.run_optimizer(demand, professors, params["time_slots"], params)

        offer = Offer(tenant_id=tenant_id, semester=semester, status="draft")
        db.add(offer)
        db.flush()

        for assignment in result["assignments"]:
            db.add(Course(
                offer_id=offer.id,
                subject_id=assignment["subject_id"],
                professor_id=assignment["professor_id"],
                time_slot=assignment["time_slot"],
                expected_students=assignment["expected_students"],
            ))
        db.commit()

        job_store.finish_job(job_id, {
            "offer_id": offer.id,
            "status": result["status"],
            "total_courses": len(result["assignments"]),
            "unassigned_subjects": result["unassigned_subjects"],
        })
    except Exception as e:
        db.rollback()
        job_store.fail_job(job_id, str(e))
    finally:
        db.close()


@router.post("/generate")
def generate(
    semester: str = "2026-2",
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
):
    job_id = job_store.create_job(current_user.tenant_id)
    background_tasks.add_task(_run_generation, job_id, current_user.tenant_id, semester)
    return {"job_id": job_id, "status": "running"}


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: str, current_user: User = Depends(get_current_user)):
    job = job_store.get_job(job_id)
    if not job or job.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse(
        job_id=job.id,
        status=job.status,
        offer_id=job.result.get("offer_id"),
        error=job.error,
    )
