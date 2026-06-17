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


def test_reopen_offer(client, auth_headers, db):
    offer = Offer(tenant_id=1, semester="2026-2", status="published")
    db.add(offer)
    db.commit()

    r = client.post(f"/api/offers/{offer.id}/reopen", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "draft"

    r2 = client.get(f"/api/offers/{offer.id}", headers=auth_headers)
    assert r2.json()["status"] == "draft"


def test_reopen_draft_offer_returns_400(client, auth_headers, db):
    offer = Offer(tenant_id=1, semester="2026-2", status="draft")
    db.add(offer)
    db.commit()

    r = client.post(f"/api/offers/{offer.id}/reopen", headers=auth_headers)
    assert r.status_code == 400


def test_reopen_nonexistent_offer_returns_404(client, auth_headers):
    r = client.post("/api/offers/999/reopen", headers=auth_headers)
    assert r.status_code == 404


def test_export_published_offer(client, auth_headers, db):
    from app.models.academic import Subject, Professor
    offer = Offer(tenant_id=1, semester="2026-2", status="published")
    db.add(offer)
    db.flush()
    subject = Subject(tenant_id=1, career_id=1, name="Álgebra", year=2)
    db.add(subject)
    professor = Professor(tenant_id=1, name="García")
    db.add(professor)
    db.flush()
    course = Course(
        offer_id=offer.id, subject_id=subject.id, professor_id=professor.id,
        time_slot={"day": 0, "start_hour": 8, "end_hour": 10, "duration_hours": 2},
        expected_students=30,
    )
    db.add(course)
    db.commit()

    r = client.get(f"/api/offers/{offer.id}/export", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["semester"] == "2026-2"
    assert data["status"] == "published"
    assert len(data["courses"]) == 1
    c = data["courses"][0]
    assert c["subject_name"] == "Álgebra"
    assert c["career_name"] == "Test Career"
    assert c["year"] == 2
    assert c["professor_name"] == "García"
    assert c["expected_students"] == 30


def test_patch_course_rejects_cross_tenant_professor(client, auth_headers, db):
    from app.models.academic import Subject, Professor
    from app.models.tenant import Tenant
    other_tenant = Tenant(id=2, name="Other University", active=True)
    db.add(other_tenant)
    db.flush()
    offer = Offer(tenant_id=1, semester="2026-2", status="draft")
    db.add(offer)
    db.flush()
    subject = Subject(tenant_id=1, career_id=1, name="Álgebra", year=1)
    db.add(subject)
    own_professor = Professor(tenant_id=1, name="Own Prof")
    db.add(own_professor)
    other_professor = Professor(tenant_id=2, name="Foreign Prof")
    db.add(other_professor)
    db.flush()
    course = Course(offer_id=offer.id, subject_id=subject.id, professor_id=own_professor.id,
                    time_slot={"id": 0, "day": 0}, expected_students=20)
    db.add(course)
    db.commit()

    r = client.patch(f"/api/offers/{offer.id}/courses/{course.id}",
                     headers=auth_headers, json={"professor_id": other_professor.id})
    assert r.status_code == 400
    assert "not in tenant" in r.json()["detail"]


def test_export_draft_offer_returns_400(client, auth_headers, db):
    offer = Offer(tenant_id=1, semester="2026-2", status="draft")
    db.add(offer)
    db.commit()

    r = client.get(f"/api/offers/{offer.id}/export", headers=auth_headers)
    assert r.status_code == 400


def test_export_nonexistent_offer_returns_404(client, auth_headers):
    r = client.get("/api/offers/999/export", headers=auth_headers)
    assert r.status_code == 404
