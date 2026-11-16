from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AtencionJornada,
    AtencionServicio,
    Clienta,
    Equipo,
    Gasto,
    Jornada,
    Pago,
    Recurso,
    ServicioDepilacion,
    ahora_ar,
)
from app.schemas import (
    AtencionIn,
    AtencionOut,
    CierreIn,
    GastoJornadaIn,
    GastoOut,
    JornadaIn,
    JornadaOut,
    TratamientoAtencionOut,
    TratamientosPagoIn,
)
from app.security import get_current_user

router = APIRouter(
    prefix="/jornadas",
    tags=["jornadas"],
    dependencies=[Depends(get_current_user)],
)

FORMAS = ("efectivo", "transferencia")
CERO = Decimal("0")
RECARGO_TRANSFERENCIA = Decimal("1000")


# ---------- Auxiliares ----------

def _cargar(db: Session, id: int) -> Jornada:
    j = db.get(Jornada, id)
    if j is None:
        raise HTTPException(404, "Jornada no encontrada")
    return j


def _cargar_atencion(db: Session, id: int) -> AtencionJornada:
    a = db.get(AtencionJornada, id)
    if a is None:
        raise HTTPException(404, "Turno no encontrado")
    return a


def _exigir_abierta(j: Jornada) -> None:
    if j.estado == "cerrada":
        raise HTTPException(400, "La jornada ya está cerrada")


def _pagos_de(db: Session, atencion_id: int) -> list[Pago]:
    return db.scalars(select(Pago).where(Pago.atencion_jornada_id == atencion_id)).all()


def _camilla_por_defecto(db: Session) -> Recurso:
    """La jornada siempre usa la primera camilla activa (Camilla 1)."""
    r = db.scalars(
        select(Recurso)
        .where(Recurso.tipo == "camilla", Recurso.activo.is_(True))
        .order_by(Recurso.orden, Recurso.id)
    ).first()
    if r is None:
        raise HTTPException(400, "No hay camillas activas configuradas")
    return r


def _validar_clienta(db: Session, datos: AtencionIn) -> None:
    if datos.clienta_id is None and not (datos.nombre_libre and datos.nombre_libre.strip()):
        raise HTTPException(400, "Indicá la clienta o su nombre")
    if datos.clienta_id is not None and db.get(Clienta, datos.clienta_id) is None:
        raise HTTPException(400, "La clienta no existe")


def _sincronizar_pago(db: Session, a: AtencionJornada, pagado: bool) -> None:
    """Un turno tiene como máximo un cobro. Refleja monto y forma actuales."""
    pagos = _pagos_de(db, a.id)
    if not pagado:
        for p in pagos:
            db.delete(p)
        return
    if pagos:
        pagos[0].monto = a.monto
        pagos[0].forma_pago = a.forma_pago
    else:
        db.add(
            Pago(
                origen="jornada",
                atencion_jornada_id=a.id,
                monto=a.monto,
                forma_pago=a.forma_pago,
            )
        )


def _atencion_out(a: AtencionJornada, pago: Pago | None) -> AtencionOut:
    servicios = [
        TratamientoAtencionOut(
            servicio_id=i.servicio_id,
            nombre=i.servicio.nombre,
            precio=i.precio,
        )
        for i in a.items
    ]
    return AtencionOut(
        id=a.id,
        clienta_id=a.clienta_id,
        nombre=a.nombre_cliente,
        hora=a.hora,
        observaciones=a.observaciones,
        tratamientos=servicios,
        subtotal=sum((i.precio for i in a.items), CERO),
        recargo=a.recargo,
        monto=a.monto,
        forma_pago=a.forma_pago,
        estado_pago="pagado" if pago else "pendiente",
        pagado=pago.monto if pago else CERO,
    )


def _detalle(db: Session, j: Jornada) -> JornadaOut:
    atenciones = db.scalars(
        select(AtencionJornada)
        .where(AtencionJornada.jornada_id == j.id)
        .order_by(AtencionJornada.hora)
    ).all()
    ids = [a.id for a in atenciones]
    pagos = (
        db.scalars(select(Pago).where(Pago.atencion_jornada_id.in_(ids))).all() if ids else []
    )
    pago_por_atencion = {p.atencion_jornada_id: p for p in pagos}

    por_forma = {f: CERO for f in FORMAS}
    for p in pagos:
        por_forma[p.forma_pago] = por_forma.get(p.forma_pago, CERO) + p.monto

    gastos = db.scalars(
        select(Gasto).where(Gasto.jornada_id == j.id).order_by(Gasto.id)
    ).all()

    total_recaudado = sum(por_forma.values(), CERO)
    total_gastos = sum((g.monto for g in gastos), CERO)
    pendiente = sum(
        (
            a.monto - (pago_por_atencion[a.id].monto if a.id in pago_por_atencion else CERO)
            for a in atenciones
        ),
        CERO,
    )

    return JornadaOut(
        id=j.id,
        fecha=j.fecha,
        hora_inicio=j.hora_inicio,
        hora_fin=j.hora_fin,
        estado=j.estado,
        equipo_id=j.equipo_id,
        equipo_nombre=j.equipo.nombre if j.equipo else None,
        notas=j.notas,
        atenciones=[_atencion_out(a, pago_por_atencion.get(a.id)) for a in atenciones],
        gastos=[GastoOut.model_validate(g) for g in gastos],
        total_atenciones=len(atenciones),
        total_recaudado=total_recaudado,
        total_gastos=total_gastos,
        ganancia_neta=total_recaudado - total_gastos,
        pendiente_cobro=pendiente,
        por_forma_pago=por_forma,
    )


# ---------- Jornadas ----------

@router.get("", response_model=list[JornadaOut])
def listar(db: Session = Depends(get_db)):
    jornadas = db.scalars(
        select(Jornada).order_by(Jornada.fecha.desc(), Jornada.id.desc())
    ).all()
    return [_detalle(db, j) for j in jornadas]


@router.post("", response_model=JornadaOut, status_code=201)
def crear(datos: JornadaIn, db: Session = Depends(get_db)):
    if datos.equipo_id is not None and db.get(Equipo, datos.equipo_id) is None:
        raise HTTPException(400, "El equipo no existe")
    j = Jornada(
        fecha=datos.fecha,
        equipo_id=datos.equipo_id,
        notas=datos.notas,
        estado="planificada",
    )
    db.add(j)
    db.commit()
    return _detalle(db, j)


@router.get("/{id}", response_model=JornadaOut)
def obtener(id: int, db: Session = Depends(get_db)):
    return _detalle(db, _cargar(db, id))


@router.post("/{id}/iniciar", response_model=JornadaOut)
def iniciar(id: int, db: Session = Depends(get_db)):
    j = _cargar(db, id)
    if j.estado != "planificada":
        raise HTTPException(400, "La jornada ya fue iniciada o cerrada")
    j.hora_inicio = ahora_ar()
    j.estado = "en_curso"
    db.commit()
    return _detalle(db, j)


@router.post("/{id}/cerrar", response_model=JornadaOut)
def cerrar(id: int, datos: CierreIn, db: Session = Depends(get_db)):
    """Cierra la jornada. No cobra nada: los cobros se marcan en cada turno."""
    j = _cargar(db, id)
    _exigir_abierta(j)

    ahora = ahora_ar()
    if j.hora_inicio is None:
        j.hora_inicio = ahora
    fin = datos.hora_fin or ahora
    if fin < j.hora_inicio:
        raise HTTPException(400, "La hora de fin es anterior al inicio")

    j.hora_fin = fin
    j.estado = "cerrada"
    db.commit()
    return _detalle(db, j)


# ---------- Turnos ----------

@router.post("/{id}/atenciones", response_model=JornadaOut, status_code=201)
def crear_atencion(id: int, datos: AtencionIn, db: Session = Depends(get_db)):
    """Alta de turno: solo clienta, hora y observaciones. El tratamiento se asigna después."""
    j = _cargar(db, id)
    _exigir_abierta(j)
    _validar_clienta(db, datos)
    a = AtencionJornada(
        jornada_id=j.id,
        recurso_id=_camilla_por_defecto(db).id,
        clienta_id=datos.clienta_id,
        nombre_libre=None if datos.clienta_id else datos.nombre_libre.strip(),
        hora=datos.hora,
        observaciones=datos.observaciones,
        monto=CERO,
        recargo=CERO,
    )
    db.add(a)
    db.commit()
    return _detalle(db, j)


@router.put("/atenciones/{id}/tratamientos", response_model=JornadaOut)
def asignar_tratamientos(id: int, datos: TratamientosPagoIn, db: Session = Depends(get_db)):
    """Asigna uno o más servicios de depilación, la forma de pago y el estado."""
    a = _cargar_atencion(db, id)
    j = a.jornada
    _exigir_abierta(j)

    ids = list(dict.fromkeys(datos.servicio_ids))
    if not ids:
        raise HTTPException(400, "Elegí al menos un servicio")

    servicios = db.scalars(
        select(ServicioDepilacion).where(ServicioDepilacion.id.in_(ids))
    ).all()
    if len(servicios) != len(ids):
        raise HTTPException(400, "Algún servicio no existe")
    if any(not s.activo for s in servicios):
        raise HTTPException(400, "Hay servicios inactivos")

    subtotal = sum((s.precio for s in servicios), CERO)
    recargo = RECARGO_TRANSFERENCIA if datos.forma_pago == "transferencia" else CERO

    a.items.clear()
    db.flush()
    for s in servicios:
        a.items.append(AtencionServicio(servicio_id=s.id, precio=s.precio))

    a.forma_pago = datos.forma_pago
    a.recargo = recargo
    a.monto = subtotal + recargo
    _sincronizar_pago(db, a, datos.pagado)
    db.commit()
    return _detalle(db, j)


@router.delete("/atenciones/{id}")
def eliminar_atencion(id: int, db: Session = Depends(get_db)):
    a = _cargar_atencion(db, id)
    _exigir_abierta(a.jornada)
    for p in _pagos_de(db, a.id):
        db.delete(p)
    db.delete(a)
    db.commit()
    return {"ok": True}


# ---------- Gastos de la jornada ----------

@router.post("/{id}/gastos", response_model=GastoOut, status_code=201)
def crear_gasto(id: int, datos: GastoJornadaIn, db: Session = Depends(get_db)):
    j = _cargar(db, id)
    _exigir_abierta(j)
    g = Gasto(fecha=j.fecha, jornada_id=j.id, **datos.model_dump())
    db.add(g)
    db.commit()
    db.refresh(g)
    return GastoOut.model_validate(g)