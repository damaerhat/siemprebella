import { useEffect, useState } from "react";
import { api } from "./api";

const ESTADOS = [
  { id: "reservado", label: "Reservado", color: "bg-slate-400" },
  { id: "confirmado", label: "Confirmado", color: "bg-emerald-500" },
  { id: "en_curso", label: "En curso", color: "bg-amber-400" },
  { id: "atendido", label: "Atendido", color: "bg-sky-500" },
  { id: "cancelado", label: "Cancelado", color: "bg-red-400" },
  { id: "no_vino", label: "No vino", color: "bg-rose-700" },
];

const estadoInfo = (id) => ESTADOS.find((e) => e.id === id) ?? ESTADOS[0];
const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2";
const pesos = (n) =>
  Number(n).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const hoy = () => new Date().toLocaleDateString("en-CA");

function sumarDias(fecha, n) {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
}

const fechaLarga = (fecha) =>
  new Date(`${fecha}T12:00:00`).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const hora = (iso) => iso.slice(11, 16);

function formVacio(fecha, recursoId = "") {
  return {
    id: null,
    clienta_id: "",
    recurso_id: recursoId,
    tratamiento_id: "",
    fecha,
    hora_inicio: "",
    hora_fin: "",
    precio: "",
    estado: "reservado",
    notas: "",
  };
}

function formDesde(t) {
  return {
    id: t.id,
    clienta_id: t.clienta_id,
    recurso_id: t.recurso_id,
    tratamiento_id: t.tratamiento_id,
    fecha: t.inicio.slice(0, 10),
    hora_inicio: hora(t.inicio),
    hora_fin: hora(t.fin),
    precio: t.precio,
    estado: t.estado,
    notas: t.notas ?? "",
  };
}

function payloadDesde(f) {
  return {
    clienta_id: Number(f.clienta_id),
    recurso_id: Number(f.recurso_id),
    tratamiento_id: Number(f.tratamiento_id),
    inicio: `${f.fecha}T${f.hora_inicio}:00`,
    fin: f.hora_fin ? `${f.fecha}T${f.hora_fin}:00` : null,
    precio: f.precio === "" ? null : Number(f.precio),
    estado: f.estado,
    notas: f.notas.trim() || null,
  };
}

export default function Agenda() {
  const [fecha, setFecha] = useState(hoy);
  const [recursos, setRecursos] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [clientas, setClientas] = useState([]);
  const [tratamientos, setTratamientos] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function cargarTurnos() {
    try {
      setTurnos(await api.turnos(fecha));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargarTurnos();
  }, [fecha]);

  // Datos de referencia: se cargan una sola vez
  useEffect(() => {
    (async () => {
      try {
        const [r, c, t] = await Promise.all([
          api.recursos(),
          api.clientas("", false),
          api.tratamientos(false),
        ]);
        setRecursos(r);
        setClientas(c);
        setTratamientos(t);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  function abrirNuevo(recursoId = "") {
    setError("");
    setForm(formVacio(fecha, recursoId));
  }

  function abrirEditar(t) {
    setError("");
    setForm(formDesde(t));
  }

  function elegirTratamiento(id) {
    const trat = tratamientos.find((t) => String(t.id) === String(id));
    setForm((f) => ({
      ...f,
      tratamiento_id: id,
      // Si el precio está vacío, toma el del tratamiento
      precio: f.precio === "" && trat ? trat.precio : f.precio,
    }));
  }

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const datos = payloadDesde(form);
      if (form.id) await api.editarTurno(form.id, datos);
      else await api.crearTurno(datos);
      setForm(null);
      await cargarTurnos();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  const tratamientoElegido = tratamientos.find((t) => String(t.id) === String(form?.tratamiento_id));

  return (
    <div className="space-y-4">
      {/* Cabecera con navegación de fechas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-azul">Agenda</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFecha(sumarDias(fecha, -1))}
            className="rounded-lg bg-white px-3 py-2 shadow-sm hover:bg-slate-100"
            aria-label="Día anterior"
          >
            ‹
          </button>
          <input
            type="date"
            value={fecha}
            onChange={(e) => e.target.value && setFecha(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
          <button
            onClick={() => setFecha(sumarDias(fecha, 1))}
            className="rounded-lg bg-white px-3 py-2 shadow-sm hover:bg-slate-100"
            aria-label="Día siguiente"
          >
            ›
          </button>
          <button
            onClick={() => setFecha(hoy())}
            className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-100"
          >
            Hoy
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="capitalize text-slate-600">{fechaLarga(fecha)}</p>
        <button
          onClick={() => abrirNuevo()}
          className="rounded-lg bg-naranja px-4 py-2 font-semibold text-white hover:opacity-90"
        >
          + Nuevo turno
        </button>
      </div>

      {error && !form && <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      {/* Formulario de alta y edición */}
      {form && (
        <form onSubmit={guardar} className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">
            {form.id ? "Editar turno" : "Nuevo turno"}
          </h2>

          {error && <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <select
              required
              value={form.clienta_id}
              onChange={(e) => setForm({ ...form, clienta_id: e.target.value })}
              className={inputCls}
            >
              <option value="">Elegí la clienta</option>
              {clientas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.apellido}, {c.nombre}
                </option>
              ))}
            </select>

            <select
              required
              value={form.tratamiento_id}
              onChange={(e) => elegirTratamiento(e.target.value)}
              className={inputCls}
            >
              <option value="">Elegí el tratamiento</option>
              {tratamientos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre} ({t.tipo === "combo" ? "combo" : `${t.duracion_min} min`})
                </option>
              ))}
            </select>

            <select
              required
              value={form.recurso_id}
              onChange={(e) => setForm({ ...form, recurso_id: e.target.value })}
              className={inputCls}
            >
              <option value="">Elegí el puesto</option>
              {recursos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>

            <input
              required
              type="date"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className={inputCls}
            />

            <div>
              <label className="text-xs text-slate-500">Hora de inicio</label>
              <input
                required
                type="time"
                value={form.hora_inicio}
                onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">
                Hora de fin{" "}
                {tratamientoElegido?.tipo === "individual" ? "(vacía = duración del tratamiento)" : "(obligatoria)"}
              </label>
              <input
                type="time"
                value={form.hora_fin}
                onChange={(e) => setForm({ ...form, hora_fin: e.target.value })}
                className={inputCls}
              />
            </div>

            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Precio"
              value={form.precio}
              onChange={(e) => setForm({ ...form, precio: e.target.value })}
              className={inputCls}
            />

            <select
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value })}
              className={inputCls}
            >
              {ESTADOS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>

          <textarea
            placeholder="Notas del turno"
            rows={2}
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            className={inputCls}
          />

          <div className="flex gap-2">
            <button
              disabled={cargando}
              className="rounded-lg bg-azul px-4 py-2 font-semibold text-white hover:bg-azul-oscuro disabled:opacity-50"
            >
              {cargando ? "Guardando..." : "Guardar turno"}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Columnas por puesto */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {recursos.map((r) => {
          const delPuesto = turnos.filter((t) => t.recurso_id === r.id);
          return (
            <div key={r.id} className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-semibold text-slate-800">{r.nombre}</h2>
                <span className="text-xs text-slate-500">
                  {delPuesto.length} {delPuesto.length === 1 ? "turno" : "turnos"}
                </span>
              </div>

              {delPuesto.length === 0 && (
                <p className="px-1 py-4 text-center text-sm text-slate-400">Sin turnos</p>
              )}

              {delPuesto.map((t) => {
                const est = estadoInfo(t.estado);
                const apagado = t.estado === "cancelado" || t.estado === "no_vino";
                return (
                  <button
                    key={t.id}
                    onClick={() => abrirEditar(t)}
                    className={`w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left hover:bg-slate-100 ${
                      apagado ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-azul">
                        {hora(t.inicio)} – {hora(t.fin)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${est.color}`} />
                        {est.label}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-medium text-slate-800">{t.clienta_nombre}</p>
                    <p className="truncate text-sm text-slate-600">{t.tratamiento_nombre}</p>
                    <p className="text-sm font-semibold text-slate-700">{pesos(t.precio)}</p>
                  </button>
                );
              })}

              <button
                onClick={() => abrirNuevo(r.id)}
                className="mt-1 rounded-lg border border-dashed border-azul px-3 py-2 text-sm text-azul hover:bg-azul/5"
              >
                + Agendar turno
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}