from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import ComboItem, Tratamiento
from app.schemas import ComboItemOut, TratamientoIn, TratamientoOut
from app.security import get_current_user

router = APIRouter(
    prefix="/tratamientos",
    tags=["tratamientos"],
    dependencies=[Depends(get_current_user)],
)


def _salida(t: Tratamiento) -> TratamientoOut:
    return TratamientoOut(
        id=t.id,
        nombre=t.nombre,
        categoria=t.categoria,
        tipo=t.tipo,
        duracion_min=t.duracion_min,
        precio=t.precio,
        activo=t.activo,
        items=[
            ComboItemOut(
                tratamiento_id=i.tratamiento_id,
                nombre=i.tratamiento.nombre,
                cantidad=i.cantidad,
            )
            for i in t.items
        ],
    )


def _validar(db: Session, datos: TratamientoIn, id_actual: int | None = None) -> None:
    if datos.tipo == "individual":
        if datos.duracion_min is None:
            raise HTTPException(400, "Un tratamiento individual necesita duración en minutos")
        if datos.items:
            raise HTTPException(400, "Un tratamiento individual no puede tener componentes")
        return

    if not datos.items:
        raise HTTPException(400, "Un combo necesita al menos un tratamiento")

    ids = [i.tratamiento_id for i in datos.items]
    if len(set(ids)) != len(ids):
        raise HTTPException(400, "Un tratamiento aparece repetido en el combo")
    if id_actual is not None and id_actual in ids:
        raise HTTPException(400, "Un combo no puede contenerse a sí mismo")

    encontrados = db.scalars(select(Tratamiento).where(Tratamiento.id.in_(ids))).all()
    if len(encontrados) != len(ids):
        raise HTTPException(400, "Algún tratamiento del combo no existe")
    if any(t.tipo != "individual" for t in encontrados):
        raise HTTPException(400, "Los combos solo pueden contener tratamientos individuales")


def _aplicar(db: Session, t: Tratamiento, datos: TratamientoIn) -> None:
    t.nombre = datos.nombre
    t.categoria = datos.categoria
    t.tipo = datos.tipo
    t.precio = datos.precio
    t.activo = datos.activo
    t.duracion_min = datos.duracion_min if datos.tipo == "individual" else None

    t.items.clear()
    db.flush()
    if datos.tipo == "combo":
        for i in datos.items:
            t.items.append(ComboItem(tratamiento_id=i.tratamiento_id, cantidad=i.cantidad))


def _cargar(db: Session, id: int) -> Tratamiento:
    t = db.scalars(
        select(Tratamiento)
        .where(Tratamiento.id == id)
        .options(selectinload(Tratamiento.items).selectinload(ComboItem.tratamiento))
    ).first()
    if t is None:
        raise HTTPException(404, "Tratamiento no encontrado")
    return t


@router.get("", response_model=list[TratamientoOut])
def listar(incluir_inactivos: bool = Query(False), db: Session = Depends(get_db)):
    q = (
        select(Tratamiento)
        .options(selectinload(Tratamiento.items).selectinload(ComboItem.tratamiento))
        .order_by(Tratamiento.categoria, Tratamiento.nombre)
    )
    if not incluir_inactivos:
        q = q.where(Tratamiento.activo.is_(True))
    return [_salida(t) for t in db.scalars(q).all()]


@router.get("/{id}", response_model=TratamientoOut)
def obtener(id: int, db: Session = Depends(get_db)):
    return _salida(_cargar(db, id))


@router.post("", response_model=TratamientoOut, status_code=201)
def crear(datos: TratamientoIn, db: Session = Depends(get_db)):
    _validar(db, datos)
    t = Tratamiento()
    db.add(t)
    _aplicar(db, t, datos)
    db.commit()
    return _salida(_cargar(db, t.id))


@router.put("/{id}", response_model=TratamientoOut)
def editar(id: int, datos: TratamientoIn, db: Session = Depends(get_db)):
    t = _cargar(db, id)
    _validar(db, datos, id_actual=id)
    _aplicar(db, t, datos)
    db.commit()
    return _salida(_cargar(db, id))


@router.post("/{id}/desactivar", response_model=TratamientoOut)
def desactivar(id: int, db: Session = Depends(get_db)):
    t = _cargar(db, id)
    t.activo = False
    db.commit()
    return _salida(_cargar(db, id))


@router.post("/{id}/activar", response_model=TratamientoOut)
def activar(id: int, db: Session = Depends(get_db)):
    t = _cargar(db, id)
    t.activo = True
    db.commit()
    return _salida(_cargar(db, id))