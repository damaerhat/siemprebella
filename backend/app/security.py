import base64
import hashlib
import hmac
import json
import os
import time

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Usuario

HORAS_SESION = 12
ITERACIONES = 200_000
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERACIONES)
    return f"pbkdf2${ITERACIONES}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iteraciones, salt_hex, dk_hex = stored.split("$")
    except ValueError:
        return False
    dk = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt_hex), int(iteraciones)
    )
    return hmac.compare_digest(dk.hex(), dk_hex)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(texto: str) -> bytes:
    return base64.urlsafe_b64decode(texto + "=" * (-len(texto) % 4))


def _firma(payload: str) -> str:
    raw = hmac.new(settings.secret_key.encode(), payload.encode(), hashlib.sha256).digest()
    return _b64(raw)


def crear_token(usuario_id: int) -> str:
    datos = {"sub": usuario_id, "exp": int(time.time()) + HORAS_SESION * 3600}
    payload = _b64(json.dumps(datos).encode())
    return f"{payload}.{_firma(payload)}"


def leer_token(token: str) -> int | None:
    try:
        payload, firma = token.split(".")
    except ValueError:
        return None
    if not hmac.compare_digest(firma, _firma(payload)):
        return None
    datos = json.loads(_unb64(payload))
    if datos["exp"] < time.time():
        return None
    return datos["sub"]


def get_current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    error = HTTPException(
        status_code=401,
        detail="Sesión no válida o vencida",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if cred is None:
        raise error
    usuario_id = leer_token(cred.credentials)
    if usuario_id is None:
        raise error
    usuario = db.get(Usuario, usuario_id)
    if usuario is None or not usuario.activo:
        raise error
    return usuario


def solo_admin(usuario: Usuario = Depends(get_current_user)) -> Usuario:
    if usuario.rol != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")
    return usuario