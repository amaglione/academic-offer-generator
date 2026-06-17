def test_login_success(client):
    r = client.post("/api/auth/login", json={"username": "admin@test.edu", "password": "password123"})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login_wrong_password(client):
    r = client.post("/api/auth/login", json={"username": "admin@test.edu", "password": "wrong"})
    assert r.status_code == 401


def test_protected_endpoint_without_token(client):
    r = client.get("/api/parameters")
    assert r.status_code == 403


def test_protected_endpoint_with_token(client, auth_headers):
    r = client.get("/api/parameters", headers=auth_headers)
    assert r.status_code == 200
