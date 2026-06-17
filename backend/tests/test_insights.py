from app.routers.generate import _compute_insights

PROFESSORS = [{"id": 1, "name": "Prof García"}, {"id": 2, "name": "Prof López"}]
PARAMS = {
    "max_students_per_course": 40,
    "max_weekly_hours_per_professor": 30,
    "available_classrooms": 10,
    "solver_timeout_seconds": 30,
}
SLOT_MANANA = {"day": 0, "start_hour": 8, "duration_hours": 2, "turno_name": "Mañana"}
SLOT_TARDE = {"day": 0, "start_hour": 14, "duration_hours": 2, "turno_name": "Tarde"}


def _result(status="optimal", assignments=None, unassigned=None):
    return {"status": status, "assignments": assignments or [], "unassigned_subjects": unassigned or []}


def test_courses_assigned_zero_when_no_assignments():
    demand = [{"subject_id": 1, "name": "Álgebra", "year": 1, "career_id": 1,
               "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]}]
    insights = _compute_insights(demand, _result(), PROFESSORS, PARAMS)
    stat = next(i for i in insights if i["key"] == "courses_assigned")
    assert stat["value"] == 0


def test_solver_timeout_alert_when_feasible_status():
    demand = [{"subject_id": 1, "name": "Álgebra", "year": 1, "career_id": 1,
               "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]}]
    result = _result(
        status="feasible",
        assignments=[{"subject_id": 1, "professor_id": 1, "time_slot": SLOT_MANANA, "expected_students": 30}],
    )
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    alert = next((i for i in insights if i["key"] == "solver_timeout"), None)
    assert alert is not None
    assert alert["severity"] == "warning"
    assert "30 segundos" in alert["value"]


def test_no_solver_timeout_alert_when_optimal():
    demand = [{"subject_id": 1, "name": "Álgebra", "year": 1, "career_id": 1,
               "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]}]
    result = _result(
        status="optimal",
        assignments=[{"subject_id": 1, "professor_id": 1, "time_slot": SLOT_MANANA, "expected_students": 30}],
    )
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    assert not any(i["key"] == "solver_timeout" for i in insights)


def test_unassigned_subjects_alert_enriches_name_and_demand():
    demand = [{"subject_id": 5, "name": "Física II", "year": 2, "career_id": 1,
               "demand": 47, "num_courses": 1, "eligible_professor_ids": [1]}]
    result = _result(unassigned=[{"subject_id": 5, "reason": "no_valid_slot"}])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    alert = next(i for i in insights if i["key"] == "unassigned_subjects")
    assert alert["severity"] == "error"
    assert alert["items"][0]["name"] == "Física II"
    assert alert["items"][0]["demand"] == 47
    assert alert["items"][0]["reason"] == "Turno restringido"


def test_unassigned_infeasible_reason_label():
    demand = [{"subject_id": 1, "name": "Álgebra", "year": 1, "career_id": 1,
               "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]}]
    result = _result(unassigned=[{"subject_id": 1, "reason": "infeasible"}])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    alert = next(i for i in insights if i["key"] == "unassigned_subjects")
    assert alert["items"][0]["reason"] == "Sin solución"


def test_unassigned_subjects_deduplicates_by_subject():
    demand = [{"subject_id": 1, "name": "Álgebra", "year": 1, "career_id": 1,
               "demand": 30, "num_courses": 2, "eligible_professor_ids": [1]}]
    result = _result(unassigned=[
        {"subject_id": 1, "reason": "infeasible"},
        {"subject_id": 1, "reason": "infeasible"},
    ])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    alert = next(i for i in insights if i["key"] == "unassigned_subjects")
    assert len(alert["items"]) == 1


def test_slot_conflict_alert_same_year_career_same_slot():
    demand = [
        {"subject_id": 1, "name": "A", "year": 1, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]},
        {"subject_id": 2, "name": "B", "year": 1, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [2]},
    ]
    result = _result(assignments=[
        {"subject_id": 1, "professor_id": 1, "time_slot": SLOT_MANANA, "expected_students": 30},
        {"subject_id": 2, "professor_id": 2, "time_slot": SLOT_MANANA, "expected_students": 30},
    ])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    alert = next((i for i in insights if i["key"] == "slot_conflicts"), None)
    assert alert is not None
    assert "1 franja" in alert["value"]


def test_no_slot_conflict_when_different_year():
    demand = [
        {"subject_id": 1, "name": "A", "year": 1, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]},
        {"subject_id": 2, "name": "B", "year": 2, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [2]},
    ]
    result = _result(assignments=[
        {"subject_id": 1, "professor_id": 1, "time_slot": SLOT_MANANA, "expected_students": 30},
        {"subject_id": 2, "professor_id": 2, "time_slot": SLOT_MANANA, "expected_students": 30},
    ])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    assert not any(i["key"] == "slot_conflicts" for i in insights)


def test_professor_overload_alert_when_above_80_percent():
    demand = [{"subject_id": 1, "name": "A", "year": 1, "career_id": 1,
               "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]}]
    # 25h de 30h límite = 83% → alerta
    result = _result(assignments=[
        {"subject_id": 1, "professor_id": 1,
         "time_slot": {"day": 0, "start_hour": 8, "duration_hours": 25.0, "turno_name": "Mañana"},
         "expected_students": 30},
    ])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    alert = next((i for i in insights if i["key"] == "professor_overload"), None)
    assert alert is not None
    assert alert["items"][0]["name"] == "Prof García"
    assert alert["items"][0]["hours_assigned"] == 25.0


def test_no_professor_overload_when_below_80_percent():
    demand = [{"subject_id": 1, "name": "A", "year": 1, "career_id": 1,
               "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]}]
    # 10h de 30h límite = 33% → sin alerta
    result = _result(assignments=[
        {"subject_id": 1, "professor_id": 1, "time_slot": SLOT_MANANA, "expected_students": 30},
    ])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    assert not any(i["key"] == "professor_overload" for i in insights)


def test_slot_distribution_counts_by_turno_name():
    demand = [
        {"subject_id": 1, "name": "A", "year": 1, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]},
        {"subject_id": 2, "name": "B", "year": 2, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [2]},
    ]
    result = _result(assignments=[
        {"subject_id": 1, "professor_id": 1, "time_slot": SLOT_MANANA, "expected_students": 30},
        {"subject_id": 2, "professor_id": 2, "time_slot": SLOT_TARDE, "expected_students": 30},
    ])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    stat = next(i for i in insights if i["key"] == "slot_distribution")
    dist = {item["name"]: item["count"] for item in stat["items"]}
    assert dist["Mañana"] == 1
    assert dist["Tarde"] == 1


def test_classroom_peak_two_concurrent_courses():
    demand = [
        {"subject_id": 1, "name": "A", "year": 1, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [1]},
        {"subject_id": 2, "name": "B", "year": 2, "career_id": 1,
         "demand": 30, "num_courses": 1, "eligible_professor_ids": [2]},
    ]
    result = _result(assignments=[
        {"subject_id": 1, "professor_id": 1, "time_slot": SLOT_MANANA, "expected_students": 30},
        {"subject_id": 2, "professor_id": 2, "time_slot": SLOT_MANANA, "expected_students": 30},
    ])
    insights = _compute_insights(demand, result, PROFESSORS, PARAMS)
    stat = next(i for i in insights if i["key"] == "classroom_peak")
    assert stat["items"][0]["peak"] == 2
    assert stat["items"][0]["limit"] == 10
