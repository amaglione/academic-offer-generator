from app.models.offer import Offer, Course


def test_list_offers_empty(client, auth_headers):
    r = client.get("/api/offers", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == []


def test_get_nonexistent_offer(client, auth_headers):
    r = client.get("/api/offers/999", headers=auth_headers)
    assert r.status_code == 404


def test_approve_offer(client, auth_headers, db):
    offer = Offer(tenant_id=1, semester="2026-2", status="draft")
    db.add(offer)
    db.commit()
    r = client.post(f"/api/offers/{offer.id}/approve", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "published"


def test_cannot_edit_published_offer(client, auth_headers, db):
    from app.models.academic import Subject, Professor
    offer = Offer(tenant_id=1, semester="2026-2", status="published")
    db.add(offer)
    db.flush()
    subject = Subject(tenant_id=1, career_id=1, name="Test", year=1)
    db.add(subject)
    professor = Professor(tenant_id=1, name="Test Prof")
    db.add(professor)
    db.flush()
    course = Course(offer_id=offer.id, subject_id=subject.id, professor_id=professor.id,
                    time_slot={"id": 0, "day": 0}, expected_students=30)
    db.add(course)
    db.commit()
    r = client.patch(f"/api/offers/{offer.id}/courses/{course.id}",
                     headers=auth_headers, json={"professor_id": professor.id})
    assert r.status_code == 400


def test_course_includes_career_and_year(client, auth_headers, db):
    from app.models.academic import Subject, Professor
    offer = Offer(tenant_id=1, semester="2026-2", status="draft")
    db.add(offer)
    db.flush()
    subject = Subject(tenant_id=1, career_id=1, name="Álgebra", year=2)
    db.add(subject)
    professor = Professor(tenant_id=1, name="García")
    db.add(professor)
    db.flush()
    course = Course(
        offer_id=offer.id, subject_id=subject.id, professor_id=professor.id,
        time_slot={"day": 0, "start_hour": 8}, expected_students=30,
    )
    db.add(course)
    db.commit()

    r = client.get(f"/api/offers/{offer.id}", headers=auth_headers)
    assert r.status_code == 200
    c = r.json()["courses"][0]
    assert c["career_id"] == 1
    assert c["career_name"] == "Test Career"
    assert c["year"] == 2
