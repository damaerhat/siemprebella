from datetime import date, datetime, time, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import AtencionJornada, Gasto, Pago, Turno, ahora_ar
from app.schemas import (
    CajaDiaOut,
    CobroPendienteOut,
    GastoIn,
    GastoOut,
    PagoIn,
    PagoOut,
)
from app.security import get_current_user

router = APIRouter(
    prefix="/caja",
    tags=["caja"],
    dependencies=[Depends(get_current_user)],
)

FORMAS = ("efectivo", "transferencia", "tarjeta")
ESTADOS_NO_COBRABLES = ("cancelado", "no_vino")
CERO = Decimal("0")


def _hoy() -> date:
    return ahora_ar().date()


def _rango(dia: date) -> tuple[datetime, datetime]:
    desde = datetime.combine(dia, time.min)
    return desde, desde + timedelta(days=1)


def _pagado_por_turno(db: Session, turno_ids: list[int]) -> dict[int, Decimal]:
    if not turno_ids:
        return {}
    filas = db.execute(
        select(Pago.turno_id, func.sum(Pago.monto))
        .where(Pago.turno_id.in_(turno_ids))
        .group_by(Pago.turno_id)
    ).all()
    return {tid: Decimal(total) for tid, total in filas}


def _opciones_pago():
    return (
        selectinload(Pago.turno).selectinload(Turno.clienta),
        selectinload(Pago.turno).selectinload(Turno.tratamiento),
        selectinload(Pago.atencion).selectinload(AtencionJornada.clienta),
    )


def _pago_salida(p: Pago) -> PagoOut:
    if p.turno_id is not None:
        descripcion = (
            f"{p.turno.clienta.nombre} {p.turno.clienta.apellido} · {p.turno.tratamiento.nombre}"
        )
    elif p.atencion_jornada_id is not None:
        descripcion = f"Jornada de depilación · {p.atencion.nombre_cliente}"
    else:
        descripcion = p.concepto or ""
    return PagoOut(
        id=p.id,
        origen=p.origen,
        turno_id=p.turno_id,
        descripcion=descripcion,
        monto=p.monto,
        forma_pago=p.forma_pago,
        fecha=p.fecha,
        notas=p.notas,
    )


@router.get("/dia", response_model=CajaDiaOut)
def resumen_dia(fecha: date | None = Query(None), db: Session = Depends(get_db)):
    dia = fecha or _hoy()
    desde, hasta = _rango(dia)

    # Los cobros y gastos de jornadas de depilación quedan dentro de cada jornada
    pagos = db.scalars(
        select(Pago)
        .where(Pago.fecha >= desde, Pago.fecha < hasta, Pago.origen != "jornada")
        .options(*_opciones_pago())
        .order_by(Pago.fecha)
    ).all()
    gastos = db.scalars(
        select(Gasto)
        .where(Gasto.fecha == dia, Gasto.jornada_id.is_(None))
        .order_by(Gasto.id)
    ).all()

    total_pagos = sum((p.monto for p in pagos), CERO)
    total_gastos = sum((g.monto for g in gastos), CERO)
    por_forma = {f: CERO for f in FORMAS}
    for p in pagos:
        por_forma[p.forma_pago] += p.monto

    return CajaDiaOut(
        fecha=dia,
        total_pagos=total_pagos,
        total_gastos=total_gastos,
        ganancia_neta=total_pagos - total_gastos,
        por_forma_pago=por_forma,
        pagos=[_pago_salida(p) for p in pagos],
        gastos=[GastoOut.model_validate(g) for g in gastos],
    )


@router.get("/cobros-pendientes", response_model=list[CobroPendienteOut])
def cobros_pendientes(fecha: date | None = Query(None), db: Session = Depends(get_db)):
    """Turnos del día (no cancelados ni 'no vino') con saldo sin cobrar."""
    dia = fecha or _hoy()
    desde, hasta = _rango(dia)
    turnos = db.scalars(
        select(Turno)
        .where(
            Turno.inicio >= desde,
            Turno.inicio < hasta,
            Turno.estado.not_in(ESTADOS_NO_COBRABLES),
        )
        .options(selectinload(Turno.clienta), selectinload(Turno.tratamiento))
        .order_by(Turno.inicio)
    ).all()

    pagado = _pagado_por_turno(db, [t.id for t in turnos])
    salida = []
    for t in turnos:
        cobrado = pagado.get(t.id, CERO)
        saldo = t.precio - cobrado
        if saldo > 0:
            salida.append(
                CobroPendienteOut(
                    turno_id=t.id,
                    clienta_nombre=f"{t.clienta.nombre} {t.clienta.apellido}",
                    tratamiento_nombre=t.tratamiento.nombre,
                    inicio=t.inicio,
                    precio=t.precio,
                    pagado=cobrado,
                    saldo=saldo,
                )
            )
    return salida


@router.post("/pagos", response_model=PagoOut, status_code=201)
def registrar_pago(datos: PagoIn, db: Session = Depends(get_db)):
    if datos.turno_id is not None:
        t = db.scalars(
            select(Turno)
            .where(Turno.id == datos.turno_id)
            .options(selectinload(Turno.clienta), selectinload(Turno.tratamiento))
        ).first()
        if t is None:
            raise HTTPException(404, "Turno no encontrado")
        if t.estado in ESTADOS_NO_COBRABLES:
            raise HTTPException(400, "No se puede cobrar un turno cancelado o que no vino")

        saldo = t.precio - _pagado_por_turno(db, [t.id]).get(t.id, CERO)
        if saldo <= 0:
            raise HTTPException(400, "Este turno ya está pagado")
        if datos.monto != saldo:
            raise HTTPException(
                400, f"El cobro es por el total del turno: ${saldo:.2f}"
            )
        p = Pago(
            origen="turno",
            turno_id=t.id,
            monto=datos.monto,
            forma_pago=datos.forma_pago,
            notas=datos.notas,
        )
    else:
        if not datos.concepto or not datos.concepto.strip():
            raise HTTPException(400, "Un cobro manual necesita un concepto")
        p = Pago(
            origen="manual",
            concepto=datos.concepto.strip(),
            monto=datos.monto,
            forma_pago=datos.forma_pago,
            notas=datos.notas,
        )

    db.add(p)
    db.commit()
    p = db.scalars(select(Pago).where(Pago.id == p.id).options(*_opciones_pago())).first()
    return _pago_salida(p)


@router.delete("/pagos/{id}")
def eliminar_pago(id: int, db: Session = Depends(get_db)):
    p = db.get(Pago, id)
    if p is None:
        raise HTTPException(404, "Pago no encontrado")
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.post("/gastos", response_model=GastoOut, status_code=201)
def crear_gasto(datos: GastoIn, db: Session = Depends(get_db)):
    g = Gasto(**datos.model_dump())
    db.add(g)
    db.commit()
    db.refresh(g)
    return GastoOut.model_validate(g)


@router.delete("/gastos/{id}")
def eliminar_gasto(id: int, db: Session = Depends(get_db)):
    g = db.get(Gasto, id)
    if g is None:
        raise HTTPException(404, "Gasto no encontrado")
    db.delete(g)
    db.commit()
    return {"ok": True}