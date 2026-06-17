from collections import defaultdict
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.dependencies import get_current_user
from app.models.tenant import User
from app.models.offer import Offer, Course
from app.schemas.job import JobResponse
from app.services import job_store, data_layer, demand_analyzer, optimizer, parameter_service

router = APIRouter()


def _compute_insights(
    demand: list[dict],
    result: dict,
    professors: list[dict],
    params: dict,
) -> list[dict]:
    insights = []
    status = result["status"]
    assignments = result["assignments"]
    unassigned = result.get("unassigned_subjects", [])

    prof_by_id = {p["id"]: p["name"] for p in professors}
    demand_by_subject = {d["subject_id"]: d for d in demand}

    # Alert: solver timeout (FEASIBLE = encontró solución pero no óptima)
    if status == "feasible":
        insights.append({
            "type": "alert",
            "severity": "warning",
            "key": "solver_timeout",
            "title": "Solución no óptima",
            "value": (
                f"El solver alcanzó el límite de {params['solver_timeout_seconds']} segundos. "
                "Puede existir una mejor distribución."
            ),
            "items": None,
        })

    # Alert: materias sin asignar
    if unassigned:
        reason_labels = {
            "no_valid_slot": "Turno restringido",
            "infeasible": "Sin solución",
            "No feasible assignment": "Sin solución",
        }
        seen = set()
        items = []
        for u in unassigned:
            sid = u["subject_id"]
            if sid in seen:
                continue
            seen.add(sid)
            d = demand_by_subject.get(sid, {})
            items.append({
                "name": d.get("name", f"Materia {sid}"),
                "demand": d.get("demand", 0),
                "reason": reason_labels.get(u.get("reason", "infeasible"), "Sin solución"),
            })
        insights.append({
            "type": "alert",
            "severity": "error",
            "key": "unassigned_subjects",
            "title": f"{len(items)} materia(s) sin asignar",
            "value": None,
            "items": items,
        })

    # Stat: total cursos asignados (siempre presente)
    insights.append({
        "type": "stat",
        "severity": None,
        "key": "courses_assigned",
        "title": "Cursos asignados",
        "value": len(assignments),
        "items": None,
    })

    if not assignments:
        return insights

    # Alert: solapamiento horario (mismo año/carrera en mismo slot)
    subject_meta = {d["subject_id"]: {"year": d["year"], "career_id": d["career_id"]} for d in demand}
    year_career_slot = defaultdict(list)
    for a in assignments:
        meta = subject_meta.get(a["subject_id"], {})
        year = meta.get("year")
        career_id = meta.get("career_id")
        if year is not None and career_id is not None:
            slot = a["time_slot"]
            key = (year, career_id, slot.get("day"), slot.get("start_hour"))
            year_career_slot[key].append(a["subject_id"])
    conflicts = sum(1 for courses_in_slot in year_career_slot.values() if len(courses_in_slot) > 1)
    if conflicts > 0:
        insights.append({
            "type": "alert",
            "severity": "warning",
            "key": "slot_conflicts",
            "title": "Solapamiento de horarios",
            "value": f"{conflicts} franja(s) con materias del mismo año/carrera superpuestas.",
            "items": None,
        })

    # Alert: docentes con alta carga (>= 80% del límite semanal)
    prof_hours: dict[int, float] = defaultdict(float)
    for a in assignments:
        prof_hours[a["professor_id"]] += a["time_slot"].get("duration_hours", 0)
    hours_limit = params["max_weekly_hours_per_professor"]
    overloaded = [
        {
            "name": prof_by_id.get(pid, f"Docente {pid}"),
            "hours_assigned": round(hrs, 1),
            "hours_limit": hours_limit,
        }
        for pid, hrs in prof_hours.items()
        if hrs >= 0.8 * hours_limit
    ]
    if overloaded:
        insights.append({
            "type": "alert",
            "severity": "warning",
            "key": "professor_overload",
            "title": f"{len(overloaded)} docente(s) con alta carga horaria",
            "value": None,
            "items": overloaded,
        })

    # Stat: distribución por turno
    slot_dist: dict[str, int] = defaultdict(int)
    for a in assignments:
        turno_name = a["time_slot"].get("turno_name", "Sin turno")
        slot_dist[turno_name] += 1
    insights.append({
        "type": "stat",
        "severity": None,
        "key": "slot_distribution",
        "title": "Distribución por turno",
        "value": None,
        "items": [{"name": k, "count": v} for k, v in sorted(slot_dist.items())],
    })

    # Stat: pico de aulas (máx. cursos simultáneos en un mismo slot día/hora)
    slot_counts: dict[tuple, int] = defaultdict(int)
    for a in assignments:
        slot = a["time_slot"]
        key = (slot.get("day"), slot.get("start_hour"))
        slot_counts[key] += 1
    peak = max(slot_counts.values()) if slot_counts else 0
    insights.append({
        "type": "stat",
        "severity": None,
        "key": "classroom_peak",
        "title": "Pico de aulas",
        "value": None,
        "items": [{"peak": peak, "limit": params["available_classrooms"]}],
    })

    return insights


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
        insights = _compute_insights(demand, result, professors, params)

        offer = Offer(tenant_id=tenant_id, semester=semester, status="draft", insights=insights)
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
