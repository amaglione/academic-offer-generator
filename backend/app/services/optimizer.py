import math
from collections import defaultdict
from ortools.sat.python import cp_model


def run_optimizer(
    demand: list[dict],
    professors: list[dict],
    time_slots: list[dict],
    params: dict,
) -> dict:
    if not demand:
        return {"status": "optimal", "assignments": [], "unassigned_subjects": []}

    model = cp_model.CpModel()

    # Build flat course list
    courses = []
    for item in demand:
        students_each = math.ceil(item["demand"] / item["num_courses"])
        for _ in range(item["num_courses"]):
            courses.append({
                "subject_id": item["subject_id"],
                "year": item["year"],
                "career_id": item["career_id"],
                "eligible_professor_ids": set(item["eligible_professor_ids"]),
                "expected_students": min(students_each, params["max_students_per_course"]),
                "allowed_turnos": item.get("allowed_turnos"),
            })

    num_courses = len(courses)
    num_slots = len(time_slots)
    prof_by_id = {p["id"]: i for i, p in enumerate(professors)}
    num_professors = len(professors)

    # x[c, p, s] = 1 if course c is taught by professor p at slot s
    x = {}
    for c, course in enumerate(courses):
        allowed_turnos = course.get("allowed_turnos")
        for prof_id in course["eligible_professor_ids"]:
            if prof_id not in prof_by_id:
                continue
            p = prof_by_id[prof_id]
            for s, slot in enumerate(time_slots):
                if allowed_turnos and slot["turno_id"] not in allowed_turnos:
                    continue
                x[c, p, s] = model.NewBoolVar(f"x_{c}_{p}_{s}")

    # Each course assigned to exactly one (professor, slot).
    # Courses with no valid (professor, slot) pair are collected as no_valid_slot
    # and excluded from the model; the solver runs for the rest.
    no_valid_slot_subjects = []
    for c, course in enumerate(courses):
        vars_for_course = [
            x[c, prof_by_id[pid], s]
            for pid in course["eligible_professor_ids"]
            if pid in prof_by_id
            for s in range(num_slots)
            if (c, prof_by_id[pid], s) in x
        ]
        if vars_for_course:
            model.AddExactlyOne(vars_for_course)
        else:
            no_valid_slot_subjects.append(
                {"subject_id": course["subject_id"], "reason": "no_valid_slot"}
            )

    # Professor can't teach two courses in the same slot
    for p in range(num_professors):
        for s in range(num_slots):
            vars_in_slot = [x[c, p, s] for c in range(num_courses) if (c, p, s) in x]
            if len(vars_in_slot) > 1:
                model.AddAtMostOne(vars_in_slot)

    # Professor weekly hour limit
    max_minutes = params["max_weekly_hours_per_professor"] * 60
    for p in range(num_professors):
        terms = []
        for c in range(num_courses):
            for s, slot in enumerate(time_slots):
                if (c, p, s) in x:
                    terms.append(x[c, p, s] * int(slot["duration_hours"] * 60))
        if terms:
            model.Add(sum(terms) <= max_minutes)

    # Max simultaneous courses <= available classrooms
    max_rooms = params["available_classrooms"]
    for s in range(num_slots):
        vars_in_slot = [x[c, p, s] for c in range(num_courses) for p in range(num_professors) if (c, p, s) in x]
        if vars_in_slot:
            model.Add(sum(vars_in_slot) <= max_rooms)

    # Objective: minimize same-year/career slot conflicts + slot overload
    penalties = []

    year_career_groups: dict[tuple, list[int]] = defaultdict(list)
    for c, course in enumerate(courses):
        year_career_groups[(course["year"], course["career_id"])].append(c)

    for (year, career_id), group in year_career_groups.items():
        if len(group) < 2:
            continue
        for s in range(num_slots):
            slot_vars = [x[c, p, s] for c in group for p in range(num_professors) if (c, p, s) in x]
            if len(slot_vars) > 1:
                count = model.NewIntVar(0, len(slot_vars), f"cnt_{year}_{career_id}_{s}")
                model.Add(count == sum(slot_vars))
                overlap = model.NewIntVar(0, len(slot_vars), f"ovl_{year}_{career_id}_{s}")
                model.Add(overlap >= count - 1)
                model.Add(overlap >= 0)
                penalties.append(overlap * 10)

    avg_load = max(1, num_courses // max(1, num_slots))
    for s in range(num_slots):
        all_vars = [x[c, p, s] for c in range(num_courses) for p in range(num_professors) if (c, p, s) in x]
        if all_vars:
            load = model.NewIntVar(0, num_courses, f"load_{s}")
            model.Add(load == sum(all_vars))
            overload = model.NewIntVar(0, num_courses, f"ovld_{s}")
            model.Add(overload >= load - avg_load)
            model.Add(overload >= 0)
            penalties.append(overload)

    if penalties:
        model.Minimize(sum(penalties))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = params["solver_timeout_seconds"]
    status = solver.Solve(model)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        assignments = []
        for c, course in enumerate(courses):
            for prof_id in course["eligible_professor_ids"]:
                if prof_id not in prof_by_id:
                    continue
                p = prof_by_id[prof_id]
                for s in range(num_slots):
                    if (c, p, s) in x and solver.Value(x[c, p, s]) == 1:
                        assignments.append({
                            "subject_id": course["subject_id"],
                            "professor_id": prof_id,
                            "time_slot": time_slots[s],
                            "expected_students": course["expected_students"],
                        })
        return {
            "status": "optimal" if status == cp_model.OPTIMAL else "feasible",
            "assignments": assignments,
            "unassigned_subjects": no_valid_slot_subjects,
        }

    no_valid_slot_ids = {u["subject_id"] for u in no_valid_slot_subjects}
    return {
        "status": "infeasible",
        "assignments": [],
        "unassigned_subjects": no_valid_slot_subjects + [
            {"subject_id": c["subject_id"], "reason": "infeasible"}
            for c in courses
            if c["subject_id"] not in no_valid_slot_ids
        ],
    }
