from datetime import datetime, time, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Clienta, Turno, ahora_ar
from app.security import get_current_user

router = APIRouter(
    prefix="/inicio",
    tags=["inicio"],
    dependencies=[Depends(get_current_user)],
)

NO_ACTIVOS = ("cancelado", "no_vino")


@router.get("/resumen")
def resumen(db: Session = Depends(get_db)):
    dia = ahora_ar().date()
    desde = datetime.combine(dia, time.min)
    hasta = desde + timedelta(days=1)

    turnos_hoy = db.scalar(
        select(func.count(Turno.id)).where(
            Turno.inicio >= desde,
            Turno.inicio < hasta,
            Turno.estado.not_in(NO_ACTIVOS),
        )
    ) or 0

    clientas_nuevas = db.scalar(
        select(func.count(Clienta.id)).where(
            Clienta.creada_en >= desde,
            Clienta.creada_en < hasta,
        )
    ) or 0

    return {
        "fecha": dia.isoformat(),
        "turnos_hoy": turnos_hoy,
        "clientas_nuevas": clientas_nuevas,
    }