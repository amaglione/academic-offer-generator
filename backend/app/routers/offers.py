from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.tenant import User
from app.models.offer import Offer, Course
from app.models.academic import Subject, Professor
from app.schemas.offer import OfferSchema, OfferListItem, CourseSchema, CourseUpdate

router = APIRouter()


def _enrich_course(course: Course, db: Session) -> CourseSchema:
    subject = db.query(Subject).filter(Subject.id == course.subject_id).first()
    professor = db.query(Professor).filter(Professor.id == course.professor_id).first()
    return CourseSchema(
        id=course.id,
        subject_id=course.subject_id,
        subject_name=subject.name if subject else None,
        professor_id=course.professor_id,
        professor_name=professor.name if professor else None,
        time_slot=course.time_slot,
        expected_students=course.expected_students,
        manually_modified=course.manually_modified,
    )


@router.get("", response_model=list[OfferListItem])
def list_offers(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    offers = db.query(Offer).filter(Offer.tenant_id == current_user.tenant_id).order_by(Offer.generated_at.desc()).all()
    return [
        OfferListItem(
            id=o.id, semester=o.semester, generated_at=o.generated_at,
            status=o.status,
            total_courses=db.query(Course).filter(Course.offer_id == o.id).count(),
        )
        for o in offers
    ]


@router.get("/{offer_id}", response_model=OfferSchema)
def get_offer(offer_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    offer = db.query(Offer).filter(Offer.id == offer_id, Offer.tenant_id == current_user.tenant_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    courses = db.query(Course).filter(Course.offer_id == offer_id).all()
    return OfferSchema(
        id=offer.id, semester=offer.semester, generated_at=offer.generated_at,
        status=offer.status,
        courses=[_enrich_course(c, db) for c in courses],
    )


@router.patch("/{offer_id}/courses/{course_id}", response_model=CourseSchema)
def update_course(
    offer_id: int, course_id: int, body: CourseUpdate,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    offer = db.query(Offer).filter(Offer.id == offer_id, Offer.tenant_id == current_user.tenant_id).first()
    if not offer or offer.status == "published":
        raise HTTPException(status_code=404 if not offer else 400, detail="Offer not found or already published")
    course = db.query(Course).filter(Course.id == course_id, Course.offer_id == offer_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if body.professor_id is not None:
        course.professor_id = body.professor_id
    if body.time_slot is not None:
        course.time_slot = body.time_slot
    course.manually_modified = True
    db.commit()
    return _enrich_course(course, db)


@router.post("/{offer_id}/approve")
def approve_offer(offer_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    offer = db.query(Offer).filter(Offer.id == offer_id, Offer.tenant_id == current_user.tenant_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    offer.status = "published"
    db.commit()
    return {"id": offer.id, "status": offer.status}
