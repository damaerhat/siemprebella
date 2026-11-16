from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Equipo, Recurso, RecursoEquipo
from app.schemas import AsignacionIn, EquipoIn, EquipoOut, RecursoIn, RecursoOut
from app.security import get_current_user, solo_admin

# Lectura: cualquier usuario logueado. Escritura: solo admin.
router = APIRouter(
    prefix="/recursos",
    tags=["recursos"],
    dependencies=[Depends(get_current_user)],
)

equipos_router = APIRouter(
    prefix="/equipos",
    tags=["equipos"],
    dependencies=[Depends(get_current_user)],
)


def _salida(r: Recurso) -> RecursoOut:
    return RecursoOut(
        id=r.id,
        nombre=r.nombre,
        tipo=r.tipo,
        orden=r.orden,
        activo=r.activo,
        equipos=[EquipoOut.model_validate(re.equipo) for re in r.equipos],
    )


def _cargar(db: Session, id: int) -> Recurso:
    r = db.scalars(
        select(Recurso)
        .where(Recurso.id == id)
        .options(selectinload(Recurso.equipos).selectinload(RecursoEquipo.equipo))
    ).first()
    if r is None:
        raise HTTPException(404, "Recurso no encontrado")
    return r


def _cargar_equipo(db: Session, id: int) -> Equipo:
    e = db.get(Equipo, id)
    if e is None:
        raise HTTPException(404, "Equipo no encontrado")
    return e


# ---------- Recursos (camillas y uñas) ----------

@router.get("", response_model=list[RecursoOut])
def listar(db: Session = Depends(get_db)):
    stmt = (
        select(Recurso)
        .options(selectinload(Recurso.equipos).selectinload(RecursoEquipo.equipo))
        .order_by(Recurso.orden, Recurso.nombre)
    )
    return [_salida(r) for r in db.scalars(stmt).all()]


@router.post("", response_model=RecursoOut, status_code=201, dependencies=[Depends(solo_admin)])
def crear(datos: RecursoIn, db: Session = Depends(get_db)):
    r = Recurso(**datos.model_dump())
    db.add(r)
    db.commit()
    return _salida(_cargar(db, r.id))


@router.put("/{id}", response_model=RecursoOut, dependencies=[Depends(solo_admin)])
def editar(id: int, datos: RecursoIn, db: Session = Depends(get_db)):
    r = _cargar(db, id)
    if datos.tipo != "camilla" and r.equipos:
        raise HTTPException(400, "No se puede cambiar a este tipo: tiene equipos asignados")
    for campo, valor in datos.model_dump().items():
        setattr(r, campo, valor)
    db.commit()
    return _salida(_cargar(db, id))


@router.put("/{id}/equipos", response_model=RecursoOut, dependencies=[Depends(solo_admin)])
def asignar_equipos(id: int, datos: AsignacionIn, db: Session = Depends(get_db)):
    r = _cargar(db, id)
    ids = list(dict.fromkeys(datos.equipo_ids))  # sin repetidos, mantiene el orden

    if ids and r.tipo != "camilla":
        raise HTTPException(400, "Solo las camillas pueden tener equipos asignados")
    if ids:
        existentes = db.scalars(select(Equipo.id).where(Equipo.id.in_(ids))).all()
        if len(existentes) != len(ids):
            raise HTTPException(400, "Algún equipo no existe")

    # Igual que en tratamientos: borrar primero y flushear para no chocar con la PK compuesta
    r.equipos.clear()
    db.flush()
    for eid in ids:
        r.equipos.append(RecursoEquipo(equipo_id=eid))
    db.commit()
    return _salida(_cargar(db, id))


# ---------- Equipos ----------

@equipos_router.get("", response_model=list[EquipoOut])
def listar_equipos(db: Session = Depends(get_db)):
    return [EquipoOut.model_validate(e) for e in db.scalars(select(Equipo).order_by(Equipo.nombre)).all()]


@equipos_router.post("", response_model=EquipoOut, status_code=201, dependencies=[Depends(solo_admin)])
def crear_equipo(datos: EquipoIn, db: Session = Depends(get_db)):
    e = Equipo(**datos.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    return EquipoOut.model_validate(e)


@equipos_router.put("/{id}", response_model=EquipoOut, dependencies=[Depends(solo_admin)])
def editar_equipo(id: int, datos: EquipoIn, db: Session = Depends(get_db)):
    e = _cargar_equipo(db, id)
    for campo, valor in datos.model_dump().items():
        setattr(e, campo, valor)
    db.commit()
    db.refresh(e)
    return EquipoOut.model_validate(e)