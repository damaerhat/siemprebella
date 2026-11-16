from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario
from app.security import crear_token, get_current_user, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    username: str
    password: str


class UsuarioOut(BaseModel):
    id: int
    username: str
    nombre: str
    rol: str


def _salida(u: Usuario) -> dict:
    return {"id": u.id, "username": u.username, "nombre": u.nombre, "rol": u.rol}


@router.post("/login")
def login(datos: LoginIn, db: Session = Depends(get_db)):
    u = db.scalars(
        select(Usuario).where(Usuario.username == datos.username.strip())
    ).first()
    if u is None or not u.activo or not verify_password(datos.password, u.password_hash):
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    return {"token": crear_token(u.id), "usuario": _salida(u)}


@router.get("/me", response_model=UsuarioOut)
def me(usuario: Usuario = Depends(get_current_user)):
    return _salida(usuario)