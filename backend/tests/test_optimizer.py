from app.services.optimizer import run_optimizer

SLOTS = [
    {"id": i, "day": i % 5, "day_name": "Lunes", "start_hour": 8 + (i // 5) * 2,
     "end_hour": 10 + (i // 5) * 2, "duration_hours": 2}
    for i in range(10)
]
PROFESSORS = [{"id": 1, "name": "Prof A"}, {"id": 2, "name": "Prof B"}]
PARAMS = {
    "max_students_per_course": 40,
    "max_weekly_hours_per_professor": 30,
    "available_classrooms": 10,
    "solver_timeout_seconds": 30,
}


def test_simple_assignment():
    demand = [{
        "subject_id": 1, "name": "Álgebra", "year": 1, "career_id": 1,
        "demand": 30, "num_courses": 1, "eligible_professor_ids": [1],
    }]
    result = run_optimizer(demand, PROFESSORS, SLOTS, PARAMS)
    assert result["status"] in ("optimal", "feasible")
    assert len(result["assignments"]) == 1
    assert result["assignments"][0]["subject_id"] == 1
    assert result["assignments"][0]["professor_id"] == 1


def test_professor_not_double_booked():
    demand = [
        {"subject_id": 1, "name": "A", "year": 1, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]},
        {"subject_id": 2, "name": "B", "year": 1, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]},
    ]
    result = run_optimizer(demand, PROFESSORS, SLOTS, PARAMS)
    assert result["status"] in ("optimal", "feasible")
    slots_used = [a["time_slot"]["id"] for a in result["assignments"]]
    assert len(set(slots_used)) == 2  # different slots


def test_infeasible_no_classrooms():
    params = {**PARAMS, "available_classrooms": 0}
    demand = [{"subject_id": 1, "name": "A", "year": 1, "career_id": 1,
               "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]}]
    result = run_optimizer(demand, PROFESSORS, SLOTS, params)
    assert result["status"] == "infeasible"


def test_empty_demand():
    result = run_optimizer([], PROFESSORS, SLOTS, PARAMS)
    assert result["status"] == "optimal"
    assert result["assignments"] == []
