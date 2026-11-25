from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------- Tratamientos ----------

class ComboItemIn(BaseModel):
    tratamiento_id: int
    cantidad: int = Field(ge=1)


class TratamientoIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    categoria: str = Field(min_length=1, max_length=60)
    tipo: Literal["individual", "combo"]
    duracion_min: int | None = Field(default=None, ge=1)
    precio: Decimal = Field(ge=0)
    activo: bool = True
    items: list[ComboItemIn] = Field(default_factory=list)


class ComboItemOut(BaseModel):
    tratamiento_id: int
    nombre: str
    cantidad: int


class TratamientoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    categoria: str
    tipo: str
    duracion_min: int | None
    precio: Decimal
    activo: bool
    items: list[ComboItemOut] = Field(default_factory=list)


# ---------- Clientas ----------

class ClientaIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)
    apellido: str = Field(min_length=1, max_length=80)
    telefono: str | None = Field(default=None, max_length=30)
    fecha_nacimiento: date | None = None
    activa: bool = True


class ClientaOut(BaseModel):
    id: int
    nombre: str
    apellido: str
    telefono: str | None
    fecha_nacimiento: date | None
    activa: bool
    fichas_activas: int = 0


# ---------- Fichas de tratamiento ----------

class FichaNuevaIn(BaseModel):
    clienta_id: int
    tratamiento_id: int
    total_sesiones: int = Field(ge=1, le=50)


class ZonasIn(BaseModel):
    abdomen_alto: Decimal | None = Field(default=None, ge=0)
    abdomen_circ: Decimal | None = Field(default=None, ge=0)
    gluteos_alto: Decimal | None = Field(default=None, ge=0)
    gluteos_circ: Decimal | None = Field(default=None, ge=0)
    pierna_der_alto: Decimal | None = Field(default=None, ge=0)
    pierna_der_circ: Decimal | None = Field(default=None, ge=0)
    pierna_izq_alto: Decimal | None = Field(default=None, ge=0)
    pierna_izq_circ: Decimal | None = Field(default=None, ge=0)


class SesionFichaIn(BaseModel):
    numero: int = Field(ge=1, le=50)
    fecha: date | None = None
    detalle: str | None = Field(default=None, max_length=300)


class FichaEditarIn(ZonasIn):
    observacion: str | None = Field(default=None, max_length=500)
    foto: bool = False
    sesiones: list[SesionFichaIn] = Field(default_factory=list)


class SesionFichaOut(BaseModel):
    numero: int
    fecha: date | None
    detalle: str | None


class FichaOut(ZonasIn):
    id: int
    clienta_id: int
    tratamiento_id: int | None
    nombre_tratamiento: str
    total_sesiones: int
    realizadas: int
    estado: str
    fecha_inicio: date
    fecha_fin: date | None
    observacion: str | None
    foto: bool
    sesiones: list[SesionFichaOut] = Field(default_factory=list)



# ---------- Recursos y equipos ----------

class EquipoIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)
    estado: Literal["disponible", "mantenimiento"] = "disponible"
    costo_alquiler: Decimal | None = Field(default=None, ge=0)
    activo: bool = True


class EquipoOut(EquipoIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class RecursoIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=40)
    tipo: Literal["camilla", "unas"]
    orden: int = 0
    activo: bool = True


class RecursoOut(BaseModel):
    id: int
    nombre: str
    tipo: str
    orden: int
    activo: bool
    equipos: list[EquipoOut] = Field(default_factory=list)


class AsignacionIn(BaseModel):
    equipo_ids: list[int] = Field(default_factory=list)




# ---------- Turnos ----------

ESTADOS_TURNO = Literal["reservado", "confirmado", "en_curso", "atendido", "cancelado", "no_vino"]


class TurnoIn(BaseModel):
    clienta_id: int
    recurso_id: int
    tratamiento_id: int
    inicio: datetime
    fin: datetime | None = None  # si no viene, se calcula con la duración del tratamiento
    precio: Decimal | None = Field(default=None, ge=0)  # si no viene, se usa el precio del tratamiento
    estado: ESTADOS_TURNO = "reservado"
    notas: str | None = Field(default=None, max_length=500)


class TurnoOut(BaseModel):
    id: int
    clienta_id: int
    clienta_nombre: str
    recurso_id: int
    recurso_nombre: str
    tratamiento_id: int
    tratamiento_nombre: str
    inicio: datetime
    fin: datetime
    precio: Decimal
    estado: str
    notas: str | None




# ---------- Caja ----------

FormaPago = Literal["efectivo", "transferencia", "tarjeta"]
CategoriaGasto = Literal["alquiler_equipo", "insumos", "servicios", "otros"]


class PagoIn(BaseModel):
    turno_id: int | None = None  # si viene, es cobro de turno (monto = saldo completo)
    concepto: str | None = Field(default=None, max_length=120)  # si no hay turno, es manual
    monto: Decimal = Field(gt=0)
    forma_pago: FormaPago
    notas: str | None = Field(default=None, max_length=500)


class PagoOut(BaseModel):
    id: int
    origen: str
    turno_id: int | None
    descripcion: str
    monto: Decimal
    forma_pago: str
    fecha: datetime
    notas: str | None


class GastoIn(BaseModel):
    fecha: date
    monto: Decimal = Field(gt=0)
    categoria: CategoriaGasto
    descripcion: str = Field(min_length=1, max_length=200)


class GastoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: date
    monto: Decimal
    categoria: str
    descripcion: str


class CobroPendienteOut(BaseModel):
    turno_id: int
    clienta_nombre: str
    tratamiento_nombre: str
    inicio: datetime
    precio: Decimal
    pagado: Decimal
    saldo: Decimal


class CajaDiaOut(BaseModel):
    fecha: date
    total_pagos: Decimal
    total_gastos: Decimal
    ganancia_neta: Decimal
    por_forma_pago: dict[str, Decimal]
    pagos: list[PagoOut]
    gastos: list[GastoOut]




# ---------- Jornadas de depilación definitiva ----------

FormaPagoJornada = Literal["efectivo", "transferencia"]
CategoriaGastoJornada = Literal["alquiler_equipo", "insumos", "servicios"]


class JornadaIn(BaseModel):
    fecha: date
    equipo_id: int | None = None
    notas: str | None = Field(default=None, max_length=500)


class AtencionIn(BaseModel):
    clienta_id: int | None = None
    nombre_libre: str | None = Field(default=None, max_length=120)
    hora: datetime
    observaciones: str | None = Field(default=None, max_length=500)


class TratamientosPagoIn(BaseModel):
    servicio_ids: list[int] = Field(default_factory=list)
    forma_pago: FormaPagoJornada = "efectivo"
    pagado: bool = False


class TratamientoAtencionOut(BaseModel):
    servicio_id: int
    nombre: str
    precio: Decimal


class AtencionOut(BaseModel):
    id: int
    clienta_id: int | None
    nombre: str
    hora: datetime
    observaciones: str | None
    tratamientos: list[TratamientoAtencionOut]
    subtotal: Decimal
    recargo: Decimal
    monto: Decimal
    forma_pago: str | None
    estado_pago: str  # "pagado" o "pendiente"
    pagado: Decimal


class GastoJornadaIn(BaseModel):
    monto: Decimal = Field(gt=0)
    categoria: CategoriaGastoJornada
    descripcion: str = Field(min_length=1, max_length=200)


class CierreIn(BaseModel):
    hora_fin: datetime | None = None  # si no viene, es la hora actual


class JornadaOut(BaseModel):
    id: int
    fecha: date
    hora_inicio: datetime | None
    hora_fin: datetime | None
    estado: str
    equipo_id: int | None
    equipo_nombre: str | None
    notas: str | None
    atenciones: list[AtencionOut]
    gastos: list[GastoOut]
    total_atenciones: int
    total_recaudado: Decimal
    total_gastos: Decimal
    ganancia_neta: Decimal
    pendiente_cobro: Decimal
    por_forma_pago: dict[str, Decimal]




# ---------- Servicios de depilación definitiva ----------

class ServicioDepilacionIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    precio: Decimal = Field(ge=0)
    orden: int = 0
    activo: bool = True


class ServicioDepilacionOut(ServicioDepilacionIn):
    model_config = ConfigDict(from_attributes=True)

    id: int