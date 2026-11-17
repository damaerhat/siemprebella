from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    auth,
    caja,
    clientas,
    inicio,
    jornadas,
    recursos,
    reportes,
    servicios_depilacion,
    tratamientos,
    turnos,
)

app = FastAPI(title="Siempre Bella")

app.add_middleware(
    CORSMiddleware,
        allow_origins=[
        "http://localhost:5173",
        "https://siemprebella1.vercel.app",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(tratamientos.router)
app.include_router(servicios_depilacion.router)
app.include_router(clientas.router)
app.include_router(recursos.router)
app.include_router(recursos.equipos_router)
app.include_router(turnos.router)
app.include_router(caja.router)
app.include_router(inicio.router)
app.include_router(jornadas.router)
app.include_router(reportes.router)


@app.get("/health")
def health():
    return {"ok": True}