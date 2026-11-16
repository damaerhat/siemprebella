from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ServicioDepilacion
from app.schemas import ServicioDepilacionIn, ServicioDepilacionOut
from app.security import get_current_user

router = APIRouter(
    prefix="/servicios-depilacion",
    tags=["servicios-depilacion"],
    dependencies=[Depends(get_current_user)],
)


def _cargar(db: Session, id: int) -> ServicioDepilacion:
    s = db.get(ServicioDepilacion, id)
    if s is None:
        raise HTTPException(404, "Servicio no encontrado")
    return s


@router.get("", response_model=list[ServicioDepilacionOut])
def listar(incluir_inactivos: bool = Query(False), db: Session = Depends(get_db)):
    q = select(ServicioDepilacion).order_by(ServicioDepilacion.orden, ServicioDepilacion.nombre)
    if not incluir_inactivos:
        q = q.where(ServicioDepilacion.activo.is_(True))
    return db.scalars(q).all()


@router.post("", response_model=ServicioDepilacionOut, status_code=201)
def crear(datos: ServicioDepilacionIn, db: Session = Depends(get_db)):
    s = ServicioDepilacion(**datos.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/{id}", response_model=ServicioDepilacionOut)
def editar(id: int, datos: ServicioDepilacionIn, db: Session = Depends(get_db)):
    s = _cargar(db, id)
    for campo, valor in datos.model_dump().items():
        setattr(s, campo, valor)
    db.commit()
    db.refresh(s)
    return s


@router.post("/{id}/desactivar", response_model=ServicioDepilacionOut)
def desactivar(id: int, db: Session = Depends(get_db)):
    s = _cargar(db, id)
    s.activo = False
    db.commit()
    db.refresh(s)
    return s


@router.post("/{id}/activar", response_model=ServicioDepilacionOut)
def activar(id: int, db: Session = Depends(get_db)):
    s = _cargar(db, id)
    s.activo = True
    db.commit()
    db.refresh(s)
    return s