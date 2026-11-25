from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Clienta
from app.schemas import ClientaIn, ClientaOut
from app.security import get_current_user

router = APIRouter(
    prefix="/clientas",
    tags=["clientas"],
    dependencies=[Depends(get_current_user)],
)


def _vacio_a_none(valor: str | None) -> str | None:
    if valor is None:
        return None
    valor = valor.strip()
    return valor or None


def _datos(datos: ClientaIn) -> dict:
    return {
        "nombre": datos.nombre.strip(),
        "apellido": datos.apellido.strip(),
        "telefono": _vacio_a_none(datos.telefono),
        "fecha_nacimiento": datos.fecha_nacimiento,
        "activa": datos.activa,
    }


def _cargar(db: Session, id: int) -> Clienta:
    c = db.scalars(
        select(Clienta).where(Clienta.id == id).options(selectinload(Clienta.fichas))
    ).first()
    if c is None:
        raise HTTPException(404, "Clienta no encontrada")
    return c


def _salida(c: Clienta) -> ClientaOut:
    return ClientaOut(
        id=c.id,
        nombre=c.nombre,
        apellido=c.apellido,
        telefono=c.telefono,
        fecha_nacimiento=c.fecha_nacimiento,
        activa=c.activa,
        fichas_activas=sum(1 for f in c.fichas if f.estado == "activo"),
    )


@router.get("", response_model=list[ClientaOut])
def listar(
    q: str | None = Query(None),
    incluir_inactivas: bool = Query(False),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Clienta)
        .options(selectinload(Clienta.fichas))
        .order_by(Clienta.apellido, Clienta.nombre)
    )
    if not incluir_inactivas:
        stmt = stmt.where(Clienta.activa.is_(True))
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Clienta.nombre.ilike(like),
                Clienta.apellido.ilike(like),
                Clienta.telefono.ilike(like),
            )
        )
    return [_salida(c) for c in db.scalars(stmt.limit(200)).all()]


@router.get("/{id}", response_model=ClientaOut)
def obtener(id: int, db: Session = Depends(get_db)):
    return _salida(_cargar(db, id))


@router.post("", response_model=ClientaOut, status_code=201)
def crear(datos: ClientaIn, db: Session = Depends(get_db)):
    c = Clienta(**_datos(datos))
    db.add(c)
    db.commit()
    return _salida(_cargar(db, c.id))


@router.put("/{id}", response_model=ClientaOut)
def editar(id: int, datos: ClientaIn, db: Session = Depends(get_db)):
    c = _cargar(db, id)
    for campo, valor in _datos(datos).items():
        setattr(c, campo, valor)
    db.commit()
    return _salida(_cargar(db, id))