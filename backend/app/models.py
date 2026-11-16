from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Clienta(Base):
    __tablename__ = "clientas"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(80))
    apellido: Mapped[str] = mapped_column(String(80))
    dni: Mapped[str | None] = mapped_column(String(20), unique=True)
    telefono: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(120))
    fecha_nacimiento: Mapped[date | None] = mapped_column(Date)
    notas: Mapped[str | None] = mapped_column(Text)
    activa: Mapped[bool] = mapped_column(Boolean, default=True)
    creada_en: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: ahora_ar(), server_default=func.now()
    )

    ficha: Mapped["FichaTecnica | None"] = relationship(
        back_populates="clienta", uselist=False, cascade="all, delete-orphan"
    )


class FichaTecnica(Base):
    """Ficha técnica de depilación definitiva: sesiones y medidas de la clienta."""

    __tablename__ = "fichas_tecnicas"
    __table_args__ = (
        CheckConstraint(
            "forma_pago IS NULL OR forma_pago IN ('efectivo', 'transferencia')",
            name="ck_ficha_forma_pago",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    clienta_id: Mapped[int] = mapped_column(ForeignKey("clientas.id"), unique=True)
    observacion: Mapped[str | None] = mapped_column(Text)
    fecha: Mapped[date | None] = mapped_column(Date)
    monto: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    forma_pago: Mapped[str | None] = mapped_column(String(20))
    sesion: Mapped[str | None] = mapped_column(String(300))
    medidas: Mapped[str | None] = mapped_column(String(120))
    foto: Mapped[bool] = mapped_column(Boolean, default=False)
    abdomen_alto: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    abdomen_circ: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    gluteos_alto: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    gluteos_circ: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    pierna_der_alto: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    pierna_der_circ: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    pierna_izq_alto: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    pierna_izq_circ: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))

    clienta: Mapped[Clienta] = relationship(back_populates="ficha")
    sesiones: Mapped[list["SesionFicha"]] = relationship(
        back_populates="ficha",
        cascade="all, delete-orphan",
        order_by="SesionFicha.numero",
    )


class SesionFicha(Base):
    """Renglones 1 a 8 de la ficha técnica."""

    __tablename__ = "sesiones_ficha"
    __table_args__ = (
        UniqueConstraint("ficha_id", "numero", name="uq_sesion_ficha_numero"),
        CheckConstraint("numero BETWEEN 1 AND 8", name="ck_sesion_ficha_numero"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    ficha_id: Mapped[int] = mapped_column(ForeignKey("fichas_tecnicas.id"))
    numero: Mapped[int] = mapped_column(Integer)
    detalle: Mapped[str | None] = mapped_column(Text)

    ficha: Mapped[FichaTecnica] = relationship(back_populates="sesiones")


class Tratamiento(Base):
    """Catálogo de estética: individuales y combos con sesiones."""

    __tablename__ = "tratamientos"
    __table_args__ = (
        CheckConstraint("tipo IN ('individual', 'combo')", name="ck_tratamiento_tipo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    categoria: Mapped[str] = mapped_column(String(60))
    tipo: Mapped[str] = mapped_column(String(10))
    duracion_min: Mapped[int | None] = mapped_column(Integer)  # solo para individuales
    precio: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    items: Mapped[list["ComboItem"]] = relationship(
        back_populates="combo",
        foreign_keys="ComboItem.combo_id",
        cascade="all, delete-orphan",
    ) 


class ComboItem(Base):
    """Qué tratamientos y cuántas sesiones incluye un combo."""

    __tablename__ = "combo_items"
    __table_args__ = (
        UniqueConstraint("combo_id", "tratamiento_id", name="uq_combo_tratamiento"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    combo_id: Mapped[int] = mapped_column(ForeignKey("tratamientos.id"))
    tratamiento_id: Mapped[int] = mapped_column(ForeignKey("tratamientos.id"))
    cantidad: Mapped[int] = mapped_column(Integer, default=1)

    combo: Mapped[Tratamiento] = relationship(back_populates="items", foreign_keys=[combo_id])
    tratamiento: Mapped[Tratamiento] = relationship(foreign_keys=[tratamiento_id])


class Equipo(Base):
    __tablename__ = "equipos"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(80))
    estado: Mapped[str] = mapped_column(String(20), default="disponible")
    costo_alquiler: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class Recurso(Base):
    """Puestos de atención: camillas y uñas. Son lo que aparece como columnas en la agenda."""

    __tablename__ = "recursos"
    __table_args__ = (
        CheckConstraint("tipo IN ('camilla', 'unas')", name="ck_recurso_tipo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(40))
    tipo: Mapped[str] = mapped_column(String(10))
    orden: Mapped[int] = mapped_column(Integer, default=0)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    equipos: Mapped[list["RecursoEquipo"]] = relationship(
        back_populates="recurso", cascade="all, delete-orphan"
    )


class RecursoEquipo(Base):
    """Asignación de equipos a camillas. Se puede cambiar sin tocar los turnos cargados."""

    __tablename__ = "recurso_equipos"

    recurso_id: Mapped[int] = mapped_column(ForeignKey("recursos.id"), primary_key=True)
    equipo_id: Mapped[int] = mapped_column(ForeignKey("equipos.id"), primary_key=True)

    recurso: Mapped[Recurso] = relationship(back_populates="equipos")
    equipo: Mapped[Equipo] = relationship()


class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = (
        CheckConstraint("rol IN ('admin', 'operador')", name="ck_usuario_rol"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    nombre: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(String(255))
    rol: Mapped[str] = mapped_column(String(20), default="operador")
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())




class Turno(Base):
    __tablename__ = "turnos"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('reservado', 'confirmado', 'en_curso', 'atendido', 'cancelado', 'no_vino')",
            name="ck_turno_estado",
        ),
        CheckConstraint("fin > inicio", name="ck_turno_fin_mayor"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    clienta_id: Mapped[int] = mapped_column(ForeignKey("clientas.id"))
    recurso_id: Mapped[int] = mapped_column(ForeignKey("recursos.id"))
    tratamiento_id: Mapped[int] = mapped_column(ForeignKey("tratamientos.id"))
    inicio: Mapped[datetime] = mapped_column(DateTime)
    fin: Mapped[datetime] = mapped_column(DateTime)
    precio: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    estado: Mapped[str] = mapped_column(String(20), default="reservado")
    notas: Mapped[str | None] = mapped_column(Text)
    creado_en: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    clienta: Mapped[Clienta] = relationship()
    recurso: Mapped[Recurso] = relationship()
    tratamiento: Mapped[Tratamiento] = relationship()




def ahora_ar() -> datetime:
    """Hora de Argentina, sin zona horaria (UTC-3, no tiene cambio de horario)."""
    return datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=3)


class Pago(Base):
    __tablename__ = "pagos"
    __table_args__ = (
        CheckConstraint("origen IN ('turno', 'manual', 'jornada')", name="ck_pago_origen"),
        CheckConstraint(
            "forma_pago IN ('efectivo', 'transferencia', 'tarjeta')", name="ck_pago_forma"
        ),
        CheckConstraint("monto > 0", name="ck_pago_monto"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    origen: Mapped[str] = mapped_column(String(20))
    turno_id: Mapped[int | None] = mapped_column(ForeignKey("turnos.id"))
    atencion_jornada_id: Mapped[int | None] = mapped_column(ForeignKey("atenciones_jornada.id"))
    concepto: Mapped[str | None] = mapped_column(String(120))  # solo para origen manual
    monto: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    forma_pago: Mapped[str] = mapped_column(String(20))
    fecha: Mapped[datetime] = mapped_column(DateTime, default=ahora_ar)
    notas: Mapped[str | None] = mapped_column(Text)

    turno: Mapped["Turno | None"] = relationship()
    atencion: Mapped["AtencionJornada | None"] = relationship()


class Gasto(Base):
    __tablename__ = "gastos"
    __table_args__ = (
        CheckConstraint(
            "categoria IN ('alquiler_equipo', 'insumos', 'servicios', 'otros')",
            name="ck_gasto_categoria",
        ),
        CheckConstraint("monto > 0", name="ck_gasto_monto"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    fecha: Mapped[date] = mapped_column(Date)
    monto: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    categoria: Mapped[str] = mapped_column(String(30))
    descripcion: Mapped[str] = mapped_column(String(200))
    jornada_id: Mapped[int | None] = mapped_column(ForeignKey("jornadas.id"))




class Jornada(Base):
    __tablename__ = "jornadas"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('planificada', 'en_curso', 'cerrada')", name="ck_jornada_estado"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    fecha: Mapped[date] = mapped_column(Date)
    hora_inicio: Mapped[datetime | None] = mapped_column(DateTime)
    hora_fin: Mapped[datetime | None] = mapped_column(DateTime)
    equipo_id: Mapped[int | None] = mapped_column(ForeignKey("equipos.id"))
    estado: Mapped[str] = mapped_column(String(20), default="planificada")
    notas: Mapped[str | None] = mapped_column(Text)
    creada_en: Mapped[datetime] = mapped_column(DateTime, default=ahora_ar)

    equipo: Mapped[Equipo | None] = relationship()
    atenciones: Mapped[list["AtencionJornada"]] = relationship(
        back_populates="jornada", order_by="AtencionJornada.hora"
    )


class AtencionJornada(Base):
    __tablename__ = "atenciones_jornada"
    __table_args__ = (
        CheckConstraint("monto >= 0", name="ck_atencion_monto"),
        CheckConstraint("recargo >= 0", name="ck_atencion_recargo"),
        CheckConstraint(
            "forma_pago IS NULL OR forma_pago IN ('efectivo', 'transferencia')",
            name="ck_atencion_forma",
        ),
        CheckConstraint(
            "clienta_id IS NOT NULL OR nombre_libre IS NOT NULL", name="ck_atencion_clienta"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    jornada_id: Mapped[int] = mapped_column(ForeignKey("jornadas.id"))
    clienta_id: Mapped[int | None] = mapped_column(ForeignKey("clientas.id"))
    nombre_libre: Mapped[str | None] = mapped_column(String(120))  # clienta sin ficha
    recurso_id: Mapped[int] = mapped_column(ForeignKey("recursos.id"))  # siempre Camilla 1
    hora: Mapped[datetime] = mapped_column(DateTime)
    monto: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), server_default="0"
    )  # total: combos + recargo
    recargo: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), server_default="0"
    )
    forma_pago: Mapped[str | None] = mapped_column(String(20))
    observaciones: Mapped[str | None] = mapped_column(Text)

    jornada: Mapped[Jornada] = relationship(back_populates="atenciones")
    clienta: Mapped[Clienta | None] = relationship()
    recurso: Mapped[Recurso] = relationship()
    items: Mapped[list["AtencionServicio"]] = relationship(
        back_populates="atencion", cascade="all, delete-orphan"
    )

    @property
    def nombre_cliente(self) -> str:
        if self.clienta is not None:
            return f"{self.clienta.nombre} {self.clienta.apellido}"
        return self.nombre_libre or ""


class AtencionServicio(Base):
    """Servicios de depilación asignados a un turno de jornada. El precio queda congelado."""

    __tablename__ = "atencion_servicios"
    __table_args__ = (
        UniqueConstraint("atencion_id", "servicio_id", name="uq_atencion_servicio"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    atencion_id: Mapped[int] = mapped_column(ForeignKey("atenciones_jornada.id"))
    servicio_id: Mapped[int] = mapped_column(ForeignKey("servicios_depilacion.id"))
    precio: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    atencion: Mapped["AtencionJornada"] = relationship(back_populates="items")
    servicio: Mapped["ServicioDepilacion"] = relationship()


class ServicioDepilacion(Base):
    """Catálogo de depilación definitiva: servicios sueltos, sin sesiones."""

    __tablename__ = "servicios_depilacion"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    precio: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    orden: Mapped[int] = mapped_column(Integer, default=0)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)