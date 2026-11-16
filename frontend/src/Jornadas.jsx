import { useEffect, useState } from "react";
import { api } from "./api";

const FORMAS = [
  { id: "efectivo", label: "Efectivo" },
  { id: "transferencia", label: "Transferencia" },
];

const CATEGORIAS = [
  { id: "servicios", label: "Servicios" },
  { id: "insumos", label: "Insumos" },
  { id: "alquiler_equipo", label: "Equipo" },
];

const ESTADO = {
  planificada: { label: "Planificada", cls: "bg-slate-100 text-slate-700" },
  en_curso: { label: "En curso", cls: "bg-amber-100 text-amber-800" },
  cerrada: { label: "Cerrada", cls: "bg-emerald-100 text-emerald-800" },
};

const RECARGO_TRANSFERENCIA = 1000;
const CLAVE_RESUMEN = "jornadaResumenOculto";
const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2";

const pesos = (n) =>
  Number(n).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const hoy = () => new Date().toLocaleDateString("en-CA");
const hora = (iso) => iso.slice(11, 16);
const formaLabel = (id) => FORMAS.find((f) => f.id === id)?.label ?? id;
const fechaLarga = (f) =>
  new Date(`${f}T12:00:00`).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const ATENCION_VACIA = {
  tipo: "registrada",
  clienta_id: "",
  nombre_libre: "",
  hora: "",
  observaciones: "",
};

const GASTO_VACIO = { descripcion: "", monto: "", categoria: "insumos" };

function payloadAtencion(f, fecha) {
  return {
    clienta_id: f.tipo === "registrada" ? Number(f.clienta_id) : null,
    nombre_libre: f.tipo === "libre" ? f.nombre_libre.trim() : null,
    hora: `${fecha}T${f.hora}:00`,
    observaciones: f.observaciones.trim() || null,
  };
}

// ---------- Listado de jornadas ----------

export default function Jornadas() {
  const [lista, setLista] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [seleccion, setSeleccion] = useState(null);
  const [nueva, setNueva] = useState(false);
  const [form, setForm] = useState({ fecha: hoy(), equipo_id: "", notas: "" });
  const [error, setError] = useState("");

  async function cargar() {
    try {
      setLista(await api.jornadas());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
    api.equipos().then(setEquipos).catch(() => {});
  }, []);

  async function crear(e) {
    e.preventDefault();
    setError("");
    try {
      const j = await api.crearJornada({
        fecha: form.fecha,
        equipo_id: form.equipo_id ? Number(form.equipo_id) : null,
        notas: form.notas.trim() || null,
      });
      setNueva(false);
      setForm({ fecha: hoy(), equipo_id: "", notas: "" });
      await cargar();
      setSeleccion(j.id);
    } catch (err) {
      setError(err.message);
    }
  }

  if (seleccion) {
    return (
      <JornadaDetalle
        id={seleccion}
        onVolver={() => {
          setSeleccion(null);
          cargar();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-azul">Jornadas de depilación definitiva</h1>
          <p className="text-sm text-slate-500">
            Cada jornada tiene sus propios cobros, gastos y ganancia.
          </p>
        </div>
        <button
          onClick={() => setNueva(!nueva)}
          className="rounded-lg bg-naranja px-4 py-2 font-semibold text-white hover:opacity-90"
        >
          {nueva ? "Cancelar" : "+ Nueva jornada"}
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      {nueva && (
        <form onSubmit={crear} className="grid gap-3 rounded-xl bg-white p-5 shadow-sm sm:grid-cols-3">
          <input
            required
            type="date"
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            className={inputCls}
          />
          <select
            value={form.equipo_id}
            onChange={(e) => setForm({ ...form, equipo_id: e.target.value })}
            className={inputCls}
          >
            <option value="">Sin equipo</option>
            {equipos
              .filter((e) => e.activo)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
          </select>
          <input
            placeholder="Notas"
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            className={inputCls}
          />
          <button className="rounded-lg bg-azul px-4 py-2 font-semibold text-white hover:bg-azul-oscuro sm:col-span-3">
            Crear jornada
          </button>
        </form>
      )}

      <div className="space-y-2">
        {lista.length === 0 && <p className="text-slate-500">No hay jornadas cargadas.</p>}
        {lista.map((j) => (
          <button
            key={j.id}
            onClick={() => setSeleccion(j.id)}
            className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 text-left shadow-sm hover:bg-slate-50"
          >
            <div>
              <p className="font-semibold capitalize text-slate-800">{fechaLarga(j.fecha)}</p>
              <p className="text-sm text-slate-500">
                {j.equipo_nombre ?? "Sin equipo"} · {j.total_atenciones}{" "}
                {j.total_atenciones === 1 ? "turno" : "turnos"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded px-2 py-0.5 text-xs ${ESTADO[j.estado].cls}`}>
                {ESTADO[j.estado].label}
              </span>
              <span
                className={`font-bold ${Number(j.ganancia_neta) >= 0 ? "text-emerald-700" : "text-red-700"}`}
              >
                {pesos(j.ganancia_neta)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Pop-up: asignar combos, forma de pago y estado ----------

function TratamientosModal({ atencion, combos, cargando, onGuardar, onCerrar }) {
  const [ids, setIds] = useState(atencion.tratamientos.map((t) => t.servicio_id));
  const [forma, setForma] = useState(atencion.forma_pago ?? "efectivo");
  const [pagado, setPagado] = useState(atencion.estado_pago === "pagado");

  const subtotal = combos
    .filter((c) => ids.includes(c.id))
    .reduce((acc, c) => acc + Number(c.precio), 0);
  const recargo = forma === "transferencia" ? RECARGO_TRANSFERENCIA : 0;

  function alternar(id) {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const boton = (activa) =>
    `rounded-lg px-3 py-2 text-sm font-medium ${
      activa ? "bg-azul text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCerrar}
    >
      <div
        className="max-h-full w-full max-w-md space-y-4 overflow-y-auto rounded-xl bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Asignar tratamiento</h3>
          <p className="text-sm text-slate-500">
            {atencion.nombre} · {hora(atencion.hora)}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Servicios (podés elegir varios)</p>
          {combos.length === 0 && (
            <p className="text-sm text-slate-500">
              No hay servicios cargados en Tratamientos › Depilación definitiva.
            </p>
          )}
          {combos.map((c) => {
            const elegido = ids.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => alternar(c.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                  elegido ? "border-azul bg-azul/10" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="text-slate-800">
                  {elegido ? "✓ " : ""}
                  {c.nombre}
                </span>
                <span className="font-semibold text-slate-800">{pesos(c.precio)}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Forma de pago</p>
          <div className="grid grid-cols-2 gap-2">
            {FORMAS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setForma(f.id)}
                className={boton(forma === f.id)}
              >
                {f.label}
                {f.id === "transferencia" && " (+$1.000)"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Estado</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPagado(false)} className={boton(!pagado)}>
              Pendiente
            </button>
            <button type="button" onClick={() => setPagado(true)} className={boton(pagado)}>
              Pagado
            </button>
          </div>
        </div>

        <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal servicios</span>
            <span>{pesos(subtotal)}</span>
          </div>
          {recargo > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Recargo transferencia</span>
              <span>{pesos(recargo)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-800">
            <span>Total</span>
            <span>{pesos(subtotal + recargo)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={cargando || ids.length === 0}
            onClick={() => onGuardar({ servicio_ids: ids, forma_pago: forma, pagado })}
            className="flex-1 rounded-lg bg-azul px-4 py-2 font-semibold text-white hover:bg-azul-oscuro disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Detalle de una jornada ----------

function JornadaDetalle({ id, onVolver }) {
  const [j, setJ] = useState(null);
  const [clientas, setClientas] = useState([]);
  const [combos, setCombos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [at, setAt] = useState(ATENCION_VACIA);
  const [gasto, setGasto] = useState(GASTO_VACIO);
  const [asignando, setAsignando] = useState(null);
  const [resumenOculto, setResumenOculto] = useState(
    () => localStorage.getItem(CLAVE_RESUMEN) === "1"
  );
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    try {
      setJ(await api.jornada(id));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
    (async () => {
      try {
        const [c, t, e] = await Promise.all([
          api.clientas("", false),
          api.serviciosDepilacion(false),
          api.equipos(),
        ]);
        setClientas(c);
        setCombos(t);
        setEquipos(e);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [id]);

  // Recuerda si el resumen quedó oculto, para que no se vea al volver a entrar
  useEffect(() => {
    localStorage.setItem(CLAVE_RESUMEN, resumenOculto ? "1" : "0");
  }, [resumenOculto]);

  // Ejecuta una acción, muestra el aviso y recarga la jornada
  async function accion(fn, msg, despues) {
    setError("");
    setAviso("");
    setCargando(true);
    try {
      await fn();
      if (despues) despues();
      setAviso(msg);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  if (!j) {
    return error ? (
      <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>
    ) : (
      <p className="text-slate-500">Cargando...</p>
    );
  }

  const cerrada = j.estado === "cerrada";
  const enCurso = j.estado === "en_curso";
  const sinCobrar = j.atenciones.filter((a) => a.estado_pago === "pendiente").length;
  const equipoElegido = equipos.find((e) => e.id === j.equipo_id);
  const yaHayAlquiler = j.gastos.some((g) => g.categoria === "alquiler_equipo");

  function guardarAtencion(e) {
    e.preventDefault();
    accion(
      () => api.crearAtencion(j.id, payloadAtencion(at, j.fecha)),
      "Turno guardado",
      () => setAt(ATENCION_VACIA)
    );
  }

  function quitarAtencion(a) {
    if (!window.confirm(`¿Eliminar el turno de ${a.nombre}?`)) return;
    accion(() => api.eliminarAtencion(a.id), "Turno eliminado");
  }

  function guardarAsignacion(datos) {
    accion(
      () => api.asignarTratamientos(asignando.id, datos),
      "Tratamiento asignado",
      () => setAsignando(null)
    );
  }

  function cargarGasto(e) {
    e.preventDefault();
    accion(
      () =>
        api.crearGastoJornada(j.id, {
          monto: Number(gasto.monto),
          categoria: gasto.categoria,
          descripcion: gasto.descripcion.trim(),
        }),
      "Gasto cargado",
      () => setGasto(GASTO_VACIO)
    );
  }

  function cargarAlquiler() {
    setGasto({
      descripcion: `Alquiler ${equipoElegido?.nombre ?? "del equipo"}`,
      monto: equipoElegido?.costo_alquiler ?? "",
      categoria: "alquiler_equipo",
    });
  }

  function quitarGasto(g) {
    if (!window.confirm(`¿Eliminar el gasto "${g.descripcion}"?`)) return;
    accion(() => api.eliminarGasto(g.id), "Gasto eliminado");
  }

  function iniciar() {
    accion(() => api.iniciarJornada(j.id), "Jornada iniciada");
  }

  function cerrar() {
    const msg =
      sinCobrar > 0
        ? `Quedan ${sinCobrar} turno(s) sin cobrar. ¿Cerrar igual?`
        : "¿Cerrar la jornada?";
    if (!window.confirm(msg)) return;
    accion(() => api.cerrarJornada(j.id, {}), "Jornada cerrada");
  }

  // ----- Bloques de la pantalla -----

  const resumen = (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-500">Turnos</p>
        <p className="text-xl font-bold text-slate-800">{j.total_atenciones}</p>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-500">Cobrado</p>
        <p className="text-xl font-bold text-slate-800">{pesos(j.total_recaudado)}</p>
        <p className="text-xs text-slate-500">
          {FORMAS.map((f) => `${f.label} ${pesos(j.por_forma_pago[f.id] ?? 0)}`).join(" · ")}
        </p>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-500">Por cobrar</p>
        <p className="text-xl font-bold text-amber-700">{pesos(j.pendiente_cobro)}</p>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-500">Gastos</p>
        <p className="text-xl font-bold text-red-700">{pesos(j.total_gastos)}</p>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-500">Ganancia neta</p>
        <p
          className={`text-xl font-bold ${Number(j.ganancia_neta) >= 0 ? "text-emerald-700" : "text-red-700"}`}
        >
          {pesos(j.ganancia_neta)}
        </p>
      </div>
    </div>
  );

  const formNuevo = (
    <form onSubmit={guardarAtencion} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">Nueva atención</h2>

      <div className="flex gap-2 text-sm">
        {[
          { id: "registrada", label: "Clienta registrada" },
          { id: "libre", label: "Sin ficha (solo nombre)" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setAt({ ...at, tipo: t.id })}
            className={`rounded-lg px-3 py-1.5 ${
              at.tipo === t.id ? "bg-azul text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {at.tipo === "registrada" ? (
          <select
            required
            value={at.clienta_id}
            onChange={(e) => setAt({ ...at, clienta_id: e.target.value })}
            className={inputCls}
          >
            <option value="">Elegí la clienta</option>
            {clientas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.apellido}, {c.nombre}
              </option>
            ))}
          </select>
        ) : (
          <input
            required
            placeholder="Nombre de la clienta"
            value={at.nombre_libre}
            onChange={(e) => setAt({ ...at, nombre_libre: e.target.value })}
            className={inputCls}
          />
        )}

        <div>
          <label className="text-xs text-slate-500">Hora</label>
          <input
            required
            type="time"
            value={at.hora}
            onChange={(e) => setAt({ ...at, hora: e.target.value })}
            className={inputCls}
          />
        </div>

        <input
          placeholder="Observaciones"
          value={at.observaciones}
          onChange={(e) => setAt({ ...at, observaciones: e.target.value })}
          className={`${inputCls} sm:col-span-2`}
        />
      </div>

      <button
        disabled={cargando}
        className="rounded-lg bg-azul px-4 py-2 font-semibold text-white hover:bg-azul-oscuro disabled:opacity-50"
      >
        Guardar
      </button>
    </form>
  );

  const gastos = (
    <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">Gastos de la jornada</h2>

      {j.equipo_id && equipoElegido?.costo_alquiler && !yaHayAlquiler && !cerrada && (
        <button
          type="button"
          onClick={cargarAlquiler}
          className="rounded-lg border border-dashed border-azul px-3 py-2 text-sm text-azul hover:bg-azul/5"
        >
          Completar alquiler de {equipoElegido.nombre} ({pesos(equipoElegido.costo_alquiler)})
        </button>
      )}

      {!cerrada && (
        <form onSubmit={cargarGasto} className="grid gap-3 sm:grid-cols-2">
          <input
            required
            placeholder="Descripción"
            value={gasto.descripcion}
            onChange={(e) => setGasto({ ...gasto, descripcion: e.target.value })}
            className={`${inputCls} sm:col-span-2`}
          />
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Monto"
            value={gasto.monto}
            onChange={(e) => setGasto({ ...gasto, monto: e.target.value })}
            className={inputCls}
          />
          <select
            value={gasto.categoria}
            onChange={(e) => setGasto({ ...gasto, categoria: e.target.value })}
            className={inputCls}
          >
            {CATEGORIAS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            disabled={cargando}
            className="rounded-lg bg-naranja px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50 sm:col-span-2"
          >
            Cargar gasto
          </button>
        </form>
      )}

      {j.gastos.length === 0 && <p className="text-sm text-slate-500">No hay gastos cargados.</p>}
      {j.gastos.map((g) => (
        <div
          key={g.id}
          className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 last:border-0"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">{g.descripcion}</p>
            <p className="text-xs text-slate-500">
              {CATEGORIAS.find((c) => c.id === g.categoria)?.label ?? g.categoria}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-red-700">{pesos(g.monto)}</span>
            {!cerrada && (
              <button
                onClick={() => quitarGasto(g)}
                className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
              >
                Quitar
              </button>
            )}
          </div>
        </div>
      ))}
    </section>
  );

  const turnos = (
    <section className="space-y-2 rounded-xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">Turnos</h2>
      {j.atenciones.length === 0 && (
        <p className="text-sm text-slate-500">Todavía no hay turnos cargados.</p>
      )}

      {j.atenciones.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-2 font-medium">Hora</th>
                <th className="font-medium">Clienta</th>
                <th className="font-medium">Tratamiento</th>
                <th className="font-medium">Pago</th>
                <th className="text-right font-medium">Total</th>
                <th className="text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {j.atenciones.map((a) => {
                const pagada = a.estado_pago === "pagado";
                return (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="py-2 font-medium text-slate-800">{hora(a.hora)}</td>
                    <td className="text-slate-800">
                      {a.nombre}
                      {a.observaciones && (
                        <p className="text-xs text-slate-500">{a.observaciones}</p>
                      )}
                    </td>
                    <td className="text-slate-600">
                      {a.tratamientos.length > 0 ? (
                        a.tratamientos.map((t) => t.nombre).join(", ")
                      ) : (
                        <span className="text-slate-400">Sin asignar</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          pagada
                            ? "bg-green-100 text-green-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {pagada
                          ? `Pagado · ${formaLabel(a.forma_pago)}`
                          : a.forma_pago
                            ? `Pendiente · ${formaLabel(a.forma_pago)}`
                            : "Pendiente"}
                      </span>
                    </td>
                    <td className="text-right font-semibold text-slate-800">
                      {pesos(a.monto)}
                      {Number(a.recargo) > 0 && (
                        <p className="text-xs font-normal text-slate-500">
                          incluye {pesos(a.recargo)} de transferencia
                        </p>
                      )}
                    </td>
                    <td className="text-right">
                      {!cerrada && (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setAsignando(a)}
                            className="rounded px-2 py-1 text-xs font-medium text-azul hover:bg-azul/10"
                          >
                            {a.tratamientos.length > 0 ? "Cambiar" : "Asignar tratamiento"}
                          </button>
                          <button
                            onClick={() => quitarAtencion(a)}
                            className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  // Antes de iniciar: formularios arriba y turnos abajo. Después de iniciar: turnos arriba.
  const formularios = (
    <div className="grid gap-4 md:grid-cols-2">
      {!cerrada && formNuevo}
      {gastos}
    </div>
  );

  return (
    <div className="space-y-5">
      {asignando && (
        <TratamientosModal
          atencion={asignando}
          combos={combos}
          cargando={cargando}
          onGuardar={guardarAsignacion}
          onCerrar={() => setAsignando(null)}
        />
      )}

      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={onVolver} className="text-sm text-azul hover:underline">
            ← Volver a jornadas
          </button>
          <h1 className="text-2xl font-bold capitalize text-azul">{fechaLarga(j.fecha)}</h1>
          <p className="text-sm text-slate-500">
            <span className={`mr-2 rounded px-2 py-0.5 text-xs ${ESTADO[j.estado].cls}`}>
              {ESTADO[j.estado].label}
            </span>
            {j.equipo_nombre ?? "Sin equipo"}
            {j.hora_inicio && ` · inicio ${hora(j.hora_inicio)}`}
            {j.hora_fin && ` · fin ${hora(j.hora_fin)}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setResumenOculto(!resumenOculto)}
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
          >
            {resumenOculto ? "Mostrar resumen" : "Ocultar resumen"}
          </button>

          {j.estado === "planificada" && (
            <button
              onClick={iniciar}
              disabled={cargando}
              className="rounded-lg bg-azul px-4 py-2 font-semibold text-white hover:bg-azul-oscuro disabled:opacity-50"
            >
              Iniciar jornada
            </button>
          )}
          {enCurso && (
            <button
              onClick={cerrar}
              disabled={cargando}
              className="rounded-lg bg-naranja px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Cerrar jornada
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}
      {aviso && <div className="rounded-lg bg-green-100 p-3 text-green-800">{aviso}</div>}

      {!resumenOculto && resumen}

      {enCurso || cerrada ? (
        <>
          {turnos}
          {formularios}
        </>
      ) : (
        <>
          {formularios}
          {turnos}
        </>
      )}
    </div>
  );
}