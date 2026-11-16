from datetime import date, datetime, time, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Clienta, Recurso, Tratamiento, Turno, ahora_ar
from app.schemas import TurnoIn, TurnoOut
from app.security import get_current_user

router = APIRouter(
    prefix="/turnos",
    tags=["turnos"],
    dependencies=[Depends(get_current_user)],
)

# Estados que liberan el horario: no ocupan al puesto
ESTADOS_LIBRES = ("cancelado", "no_vino")


def _cargar(db: Session, id: int) -> Turno:
    t = db.scalars(
        select(Turno)
        .where(Turno.id == id)
        .options(
            selectinload(Turno.clienta),
            selectinload(Turno.recurso),
            selectinload(Turno.tratamiento),
        )
    ).first()
    if t is None:
        raise HTTPException(404, "Turno no encontrado")
    return t


def _salida(t: Turno) -> TurnoOut:
    return TurnoOut(
        id=t.id,
        clienta_id=t.clienta_id,
        clienta_nombre=f"{t.clienta.nombre} {t.clienta.apellido}",
        recurso_id=t.recurso_id,
        recurso_nombre=t.recurso.nombre,
        tratamiento_id=t.tratamiento_id,
        tratamiento_nombre=t.tratamiento.nombre,
        inicio=t.inicio,
        fin=t.fin,
        precio=t.precio,
        estado=t.estado,
        notas=t.notas,
    )


def _validar(db: Session, datos: TurnoIn, id_actual: int | None = None) -> tuple[datetime, Decimal]:
    clienta = db.get(Clienta, datos.clienta_id)
    if clienta is None or not clienta.activa:
        raise HTTPException(400, "La clienta no existe o está inactiva")

    recurso = db.get(Recurso, datos.recurso_id)
    if recurso is None or not recurso.activo:
        raise HTTPException(400, "El puesto no existe o está inactivo")

    tratamiento = db.get(Tratamiento, datos.tratamiento_id)
    if tratamiento is None or not tratamiento.activo:
        raise HTTPException(400, "El tratamiento no existe o está inactivo")

    if datos.fin is not None:
        fin = datos.fin
    elif tratamiento.tipo == "individual" and tratamiento.duracion_min:
        fin = datos.inicio + timedelta(minutes=tratamiento.duracion_min)
    else:
        raise HTTPException(400, "Indicá la hora de fin: los combos no tienen duración fija")

    if fin <= datos.inicio:
        raise HTTPException(400, "La hora de fin tiene que ser posterior al inicio")

    precio = datos.precio if datos.precio is not None else tratamiento.precio

    if datos.estado not in ESTADOS_LIBRES:
        q = select(Turno).where(
            Turno.recurso_id == recurso.id,
            Turno.estado.not_in(ESTADOS_LIBRES),
            Turno.inicio < fin,
            Turno.fin > datos.inicio,
        )
        if id_actual is not None:
            q = q.where(Turno.id != id_actual)
        choque = db.scalars(q.options(selectinload(Turno.clienta))).first()
        if choque is not None:
            raise HTTPException(
                400,
                f"Se pisa con el turno de {choque.clienta.nombre} {choque.clienta.apellido} "
                f"({choque.inicio:%H:%M} a {choque.fin:%H:%M}) en {recurso.nombre}",
            )

    return fin, precio


@router.get("", response_model=list[TurnoOut])
def listar(fecha: date | None = Query(None), db: Session = Depends(get_db)):
    dia = fecha or ahora_ar().date()
    desde = datetime.combine(dia, time.min)
    hasta = desde + timedelta(days=1)
    stmt = (
        select(Turno)
        .where(Turno.inicio >= desde, Turno.inicio < hasta)
        .options(
            selectinload(Turno.clienta),
            selectinload(Turno.recurso),
            selectinload(Turno.tratamiento),
        )
        .order_by(Turno.recurso_id, Turno.inicio)
    )
    return [_salida(t) for t in db.scalars(stmt).all()]


@router.post("", response_model=TurnoOut, status_code=201)
def crear(datos: TurnoIn, db: Session = Depends(get_db)):
    fin, precio = _validar(db, datos)
    t = Turno(
        clienta_id=datos.clienta_id,
        recurso_id=datos.recurso_id,
        tratamiento_id=datos.tratamiento_id,
        inicio=datos.inicio,
        fin=fin,
        precio=precio,
        estado=datos.estado,
        notas=datos.notas,
    )
    db.add(t)
    db.commit()
    return _salida(_cargar(db, t.id))


@router.put("/{id}", response_model=TurnoOut)
def editar(id: int, datos: TurnoIn, db: Session = Depends(get_db)):
    t = _cargar(db, id)
    fin, precio = _validar(db, datos, id_actual=id)
    t.clienta_id = datos.clienta_id
    t.recurso_id = datos.recurso_id
    t.tratamiento_id = datos.tratamiento_id
    t.inicio = datos.inicio
    t.fin = fin
    t.precio = precio
    t.estado = datos.estado
    t.notas = datos.notas
    db.commit()
    return _salida(_cargar(db, id))