from datetime import date, datetime, time, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import AtencionJornada, Gasto, Jornada, Pago, Turno, ahora_ar
from app.routers.jornadas import _detalle
from app.security import get_current_user

router = APIRouter(
    prefix="/reportes",
    tags=["reportes"],
    dependencies=[Depends(get_current_user)],
)

CERO = Decimal("0")


def _rango_dt(desde: date, hasta: date) -> tuple[datetime, datetime]:
    if hasta < desde:
        raise HTTPException(400, "La fecha 'hasta' es anterior a 'desde'")
    return datetime.combine(desde, time.min), datetime.combine(hasta, time.min) + timedelta(days=1)


def _pagos(db: Session, desde: date, hasta: date) -> list[Pago]:
    inicio, fin = _rango_dt(desde, hasta)
    return db.scalars(
        select(Pago)
        .where(Pago.fecha >= inicio, Pago.fecha < fin)
        .options(
            selectinload(Pago.turno).selectinload(Turno.tratamiento),
        )
    ).all()


def _gastos(db: Session, desde: date, hasta: date) -> list[Gasto]:
    _rango_dt(desde, hasta)  # valida el rango
    return db.scalars(
        select(Gasto).where(Gasto.fecha >= desde, Gasto.fecha <= hasta)
    ).all()


# ---------- Ingresos por mes (resumen anual) ----------

@router.get("/ingresos-mensuales")
def ingresos_mensuales(anio: int | None = Query(None), db: Session = Depends(get_db)):
    anio = anio or ahora_ar().year
    desde, hasta = date(anio, 1, 1), date(anio, 12, 31)
    pagos = _pagos(db, desde, hasta)
    gastos = _gastos(db, desde, hasta)

    meses = {
        m: {"mes": m, "cobros": 0, "ingresos": CERO, "gastos": CERO}
        for m in range(1, 13)
    }
    for p in pagos:
        meses[p.fecha.month]["cobros"] += 1
        meses[p.fecha.month]["ingresos"] += p.monto
    for g in gastos:
        meses[g.fecha.month]["gastos"] += g.monto

    lista = []
    for m in meses.values():
        lista.append({**m, "ganancia": m["ingresos"] - m["gastos"]})

    total_ingresos = sum((m["ingresos"] for m in lista), CERO)
    total_gastos = sum((m["gastos"] for m in lista), CERO)
    return {
        "anio": anio,
        "meses": lista,
        "total_ingresos": total_ingresos,
        "total_gastos": total_gastos,
        "total_ganancia": total_ingresos - total_gastos,
    }


# ---------- Tratamientos más vendidos ----------

@router.get("/tratamientos")
def tratamientos_vendidos(desde: date, hasta: date, db: Session = Depends(get_db)):
    acumulado: dict[str, dict] = {}

    def sumar(nombre: str, monto: Decimal) -> None:
        fila = acumulado.setdefault(nombre, {"nombre": nombre, "cobros": 0, "total": CERO})
        fila["cobros"] += 1
        fila["total"] += monto

    for p in _pagos(db, desde, hasta):
        if p.origen == "turno" and p.turno is not None:
            sumar(p.turno.tratamiento.nombre, p.monto)
        elif p.origen == "jornada":
            sumar("Depilación definitiva", p.monto)
        elif p.origen == "manual":
            sumar(p.concepto or "Cobro manual", p.monto)

    lista = sorted(acumulado.values(), key=lambda f: f["total"], reverse=True)
    total = sum((f["total"] for f in lista), CERO)
    return {"total": total, "tratamientos": lista}


# ---------- Ganancia por jornada ----------

@router.get("/jornadas")
def jornadas_rango(desde: date, hasta: date, db: Session = Depends(get_db)):
    _rango_dt(desde, hasta)
    jornadas = db.scalars(
        select(Jornada)
        .where(Jornada.fecha >= desde, Jornada.fecha <= hasta, Jornada.estado == "cerrada")
        .order_by(Jornada.fecha)
    ).all()

    filas = []
    for j in jornadas:
        d = _detalle(db, j)
        filas.append(
            {
                "id": d.id,
                "fecha": d.fecha.isoformat(),
                "equipo_nombre": d.equipo_nombre,
                "total_atenciones": d.total_atenciones,
                "total_recaudado": d.total_recaudado,
                "total_gastos": d.total_gastos,
                "ganancia_neta": d.ganancia_neta,
            }
        )
    return {
        "jornadas": filas,
        "total_recaudado": sum((f["total_recaudado"] for f in filas), CERO),
        "total_gastos": sum((f["total_gastos"] for f in filas), CERO),
        "total_ganancia": sum((f["ganancia_neta"] for f in filas), CERO),
    }


# ---------- Resumen del período ----------

@router.get("/resumen")
def resumen(desde: date, hasta: date, db: Session = Depends(get_db)):
    pagos = _pagos(db, desde, hasta)
    gastos = _gastos(db, desde, hasta)
    ingresos = sum((p.monto for p in pagos), CERO)
    egresos = sum((g.monto for g in gastos), CERO)
    return {
        "desde": desde.isoformat(),
        "hasta": hasta.isoformat(),
        "ingresos": ingresos,
        "gastos": egresos,
        "ganancia_neta": ingresos - egresos,
        "cobros": len(pagos),
    }