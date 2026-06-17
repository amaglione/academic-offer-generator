import math


def analyze_demand(
    subjects: list[dict],
    prerequisites: dict[int, list[int]],
    students: list[dict],
    prof_subjects: dict[int, list[int]],
    params: dict,
) -> list[dict]:
    """
    Returns [{subject_id, name, year, career_id, demand, num_courses, eligible_professor_ids}]
    for every subject that has eligible students and at least one professor.
    """
    students_by_career: dict[int, list[dict]] = {}
    for student in students:
        students_by_career.setdefault(student["career_id"], []).append(student)

    result = []
    for subject in subjects:
        sid = subject["id"]
        prereq_ids = set(prerequisites.get(sid, []))
        career_students = students_by_career.get(subject["career_id"], [])

        eligible_count = sum(
            1 for s in career_students
            if sid not in s["passed_subject_ids"]
            and prereq_ids.issubset(s["passed_subject_ids"])
        )

        if eligible_count == 0:
            continue

        eligible_prof_ids = prof_subjects.get(sid, [])
        if not eligible_prof_ids:
            continue

        num_courses = math.ceil(eligible_count / params["max_students_per_course"])
        result.append({
            "subject_id": sid,
            "name": subject["name"],
            "year": subject["year"],
            "career_id": subject["career_id"],
            "demand": eligible_count,
            "num_courses": num_courses,
            "eligible_professor_ids": eligible_prof_ids,
            "allowed_turnos": subject.get("allowed_turnos"),
        })

    return result
