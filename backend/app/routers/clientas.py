from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Clienta, FichaTecnica, SesionFicha
from app.schemas import ClientaIn, ClientaOut, FichaTecnicaIn
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


def _opciones():
    return selectinload(Clienta.ficha).selectinload(FichaTecnica.sesiones)


def _cargar(db: Session, id: int) -> Clienta:
    c = db.scalars(select(Clienta).where(Clienta.id == id).options(_opciones())).first()
    if c is None:
        raise HTTPException(404, "Clienta no encontrada")
    return c


@router.get("", response_model=list[ClientaOut])
def listar(
    q: str | None = Query(None),
    incluir_inactivas: bool = Query(False),
    db: Session = Depends(get_db),
):
    stmt = select(Clienta).options(_opciones()).order_by(Clienta.apellido, Clienta.nombre)
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
    return [ClientaOut.model_validate(c) for c in db.scalars(stmt.limit(200)).all()]


@router.get("/{id}", response_model=ClientaOut)
def obtener(id: int, db: Session = Depends(get_db)):
    return ClientaOut.model_validate(_cargar(db, id))


@router.post("", response_model=ClientaOut, status_code=201)
def crear(datos: ClientaIn, db: Session = Depends(get_db)):
    c = Clienta(**_datos(datos))
    db.add(c)
    db.commit()
    return ClientaOut.model_validate(_cargar(db, c.id))


@router.put("/{id}", response_model=ClientaOut)
def editar(id: int, datos: ClientaIn, db: Session = Depends(get_db)):
    c = _cargar(db, id)
    for campo, valor in _datos(datos).items():
        setattr(c, campo, valor)
    db.commit()
    return ClientaOut.model_validate(_cargar(db, id))


@router.put("/{id}/ficha", response_model=ClientaOut)
def guardar_ficha(id: int, datos: FichaTecnicaIn, db: Session = Depends(get_db)):
    """Crea o actualiza la ficha técnica. Los renglones de sesiones se reemplazan completos."""
    c = _cargar(db, id)
    ficha = c.ficha or FichaTecnica(clienta_id=c.id)
    for campo, valor in datos.model_dump(exclude={"sesiones"}).items():
        setattr(ficha, campo, valor)
    db.add(ficha)
    db.flush()

    # Igual que en otros módulos: borrar, flushear y recién después insertar
    ficha.sesiones.clear()
    db.flush()
    for s in datos.sesiones:
        ficha.sesiones.append(SesionFicha(numero=s.numero, detalle=s.detalle))

    db.commit()
    return ClientaOut.model_validate(_cargar(db, id))