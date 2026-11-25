from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Clienta, FichaSesion, FichaTratamiento, Tratamiento, ahora_ar
from app.schemas import FichaEditarIn, FichaNuevaIn, FichaOut, SesionFichaOut
from app.security import get_current_user

router = APIRouter(
    prefix="/fichas",
    tags=["fichas"],
    dependencies=[Depends(get_current_user)],
)

ZONAS = (
    "abdomen_alto", "abdomen_circ",
    "gluteos_alto", "gluteos_circ",
    "pierna_der_alto", "pierna_der_circ",
    "pierna_izq_alto", "pierna_izq_circ",
)


def _cargar(db: Session, id: int) -> FichaTratamiento:
    f = db.scalars(
        select(FichaTratamiento)
        .where(FichaTratamiento.id == id)
        .options(selectinload(FichaTratamiento.sesiones))
    ).first()
    if f is None:
        raise HTTPException(404, "Ficha no encontrada")
    return f


def _salida(f: FichaTratamiento) -> FichaOut:
    return FichaOut(
        id=f.id,
        clienta_id=f.clienta_id,
        tratamiento_id=f.tratamiento_id,
        nombre_tratamiento=f.nombre_tratamiento,
        total_sesiones=f.total_sesiones,
        realizadas=sum(1 for s in f.sesiones if s.fecha is not None),
        estado=f.estado,
        fecha_inicio=f.fecha_inicio,
        fecha_fin=f.fecha_fin,
        observacion=f.observacion,
        foto=f.foto,
        sesiones=[SesionFichaOut(numero=s.numero, fecha=s.fecha, detalle=s.detalle) for s in f.sesiones],
        **{zona: getattr(f, zona) for zona in ZONAS},
    )


@router.get("", response_model=list[FichaOut])
def listar(clienta_id: int = Query(...), db: Session = Depends(get_db)):
    fichas = db.scalars(
        select(FichaTratamiento)
        .where(FichaTratamiento.clienta_id == clienta_id)
        .options(selectinload(FichaTratamiento.sesiones))
        .order_by(FichaTratamiento.id)
    ).all()
    return [_salida(f) for f in fichas]


@router.post("", response_model=FichaOut, status_code=201)
def crear(datos: FichaNuevaIn, db: Session = Depends(get_db)):
    if db.get(Clienta, datos.clienta_id) is None:
        raise HTTPException(400, "La clienta no existe")
    t = db.get(Tratamiento, datos.tratamiento_id)
    if t is None or not t.activo:
        raise HTTPException(400, "El tratamiento no existe o está inactivo")

    f = FichaTratamiento(
        clienta_id=datos.clienta_id,
        tratamiento_id=t.id,
        nombre_tratamiento=t.nombre,
        total_sesiones=datos.total_sesiones,
        estado="activo",
        fecha_inicio=ahora_ar().date(),
    )
    f.sesiones = [FichaSesion(numero=n) for n in range(1, datos.total_sesiones + 1)]
    db.add(f)
    db.commit()
    return _salida(_cargar(db, f.id))


@router.put("/{id}", response_model=FichaOut)
def editar(id: int, datos: FichaEditarIn, db: Session = Depends(get_db)):
    f = _cargar(db, id)
    for campo, valor in datos.model_dump(exclude={"sesiones"}).items():
        setattr(f, campo, valor)

    por_numero = {s.numero: s for s in f.sesiones}
    for s in datos.sesiones:
        if s.numero > f.total_sesiones:
            raise HTTPException(400, f"La ficha tiene {f.total_sesiones} sesiones")
        renglon = por_numero.get(s.numero)
        if renglon is None:
            raise HTTPException(400, f"No existe la sesión {s.numero}")
        renglon.fecha = s.fecha
        renglon.detalle = s.detalle

    db.commit()
    return _salida(_cargar(db, id))


@router.post("/{id}/terminar", response_model=FichaOut)
def terminar(id: int, db: Session = Depends(get_db)):
    f = _cargar(db, id)
    f.estado = "terminado"
    f.fecha_fin = ahora_ar().date()
    db.commit()
    return _salida(_cargar(db, id))


@router.post("/{id}/reabrir", response_model=FichaOut)
def reabrir(id: int, db: Session = Depends(get_db)):
    f = _cargar(db, id)
    f.estado = "activo"
    f.fecha_fin = None
    db.commit()
    return _salida(_cargar(db, id))