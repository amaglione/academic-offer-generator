import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db
from app.models import *  # noqa
from passlib.context import CryptContext

TEST_DB_URL = "sqlite:///./test.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@pytest.fixture(autouse=True)
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSession()

    tenant = Tenant(id=1, name="Test University", active=True)
    session.add(tenant)
    session.add(User(
        id=1, tenant_id=1,
        username="admin@test.edu",
        hashed_password=pwd_context.hash("password123"),
        active=True,
    ))
    session.add(GlobalParameters(id=1))
    session.add(Career(id=1, tenant_id=1, name="Test Career"))
    session.commit()

    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    r = client.post("/api/auth/login", json={"username": "admin@test.edu", "password": "password123"})
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
