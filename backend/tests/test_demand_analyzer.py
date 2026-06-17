import math
from app.services.demand_analyzer import analyze_demand


def make_subjects(data):
    return [{"id": s[0], "name": s[1], "year": s[2], "career_id": 1} for s in data]


def make_students(passed_map):
    return [{"id": sid, "career_id": 1, "passed_subject_ids": set(passed)} for sid, passed in passed_map.items()]


def test_counts_eligible_students():
    subjects = make_subjects([(1, "Álgebra", 1), (2, "Análisis I", 2)])
    prerequisites = {2: [1]}  # Análisis I requires Álgebra
    students = make_students({
        1: [1],     # passed Álgebra only → eligible for Análisis I
        2: [1, 2],  # passed both → NOT eligible (already passed Análisis I)
        3: [],      # passed nothing → eligible for Álgebra, not Análisis I
    })
    prof_subjects = {1: [10], 2: [11]}
    params = {"max_students_per_course": 40, "available_classrooms": 10}

    result = analyze_demand(subjects, prerequisites, students, prof_subjects, params)
    by_id = {r["subject_id"]: r for r in result}

    assert by_id[1]["demand"] == 1   # student 3 eligible
    assert by_id[2]["demand"] == 1   # student 1 eligible


def test_num_courses_ceiling():
    subjects = make_subjects([(1, "Álgebra", 1)])
    students = make_students({i: [] for i in range(1, 90)})  # 89 students, no prereqs
    prof_subjects = {1: [10]}
    params = {"max_students_per_course": 40, "available_classrooms": 10}

    result = analyze_demand(subjects, {}, students, prof_subjects, params)
    assert result[0]["num_courses"] == 3  # ceil(89/40) = 3


def test_no_demand_excluded():
    subjects = make_subjects([(1, "Álgebra", 1)])
    students = make_students({1: [1]})  # already passed
    prof_subjects = {1: [10]}
    params = {"max_students_per_course": 40, "available_classrooms": 10}

    result = analyze_demand(subjects, {}, students, prof_subjects, params)
    assert result == []


def test_no_professor_excluded():
    subjects = make_subjects([(1, "Álgebra", 1)])
    students = make_students({1: []})
    prof_subjects = {}  # no professors
    params = {"max_students_per_course": 40, "available_classrooms": 10}

    result = analyze_demand(subjects, {}, students, prof_subjects, params)
    assert result == []
