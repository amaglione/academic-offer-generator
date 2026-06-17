from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, generate, parameters

app = FastAPI(title="Generador de Oferta Académica")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(generate.router, prefix="/api", tags=["generate"])
app.include_router(parameters.router, prefix="/api/parameters", tags=["parameters"])
