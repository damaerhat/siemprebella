import { useEffect, useState } from "react";
import { api } from "./api";

const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2";

const pesos = (n) =>
  Number(n).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const FORM_EQUIPO_VACIO = { nombre: "", estado: "disponible", costo_alquiler: "", activo: true };

// ---------- Equipos ----------

function Equipos() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    try {
      setLista(await api.equipos());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function abrirEditar(e) {
    setError("");
    setForm({
      id: e.id,
      nombre: e.nombre,
      estado: e.estado,
      costo_alquiler: e.costo_alquiler ?? "",
      activo: e.activo,
    });
  }

  async function guardar(ev) {
    ev.preventDefault();
    setError("");
    setCargando(true);
    const datos = {
      nombre: form.nombre.trim(),
      estado: form.estado,
      costo_alquiler: form.costo_alquiler === "" ? null : Number(form.costo_alquiler),
      activo: form.activo,
    };
    try {
      if (form.id) await api.editarEquipo(form.id, datos);
      else await api.crearEquipo(datos);
      setForm(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Equipos</h2>
        <button
          onClick={() => {
            setError("");
            setForm({ ...FORM_EQUIPO_VACIO });
          }}
          className="rounded-lg bg-naranja px-4 py-2 font-semibold text-white hover:opacity-90"
        >
          + Nuevo equipo
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      {form && (
        <form onSubmit={guardar} className="grid gap-3 rounded-xl bg-white p-5 shadow-sm sm:grid-cols-2">
          <input
            required
            placeholder="Nombre del equipo"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className={inputCls}
          />
          <select
            value={form.estado}
            onChange={(e) => setForm({ ...form, estado: e.target.value })}
            className={inputCls}
          >
            <option value="disponible">Disponible</option>
            <option value="mantenimiento">En mantenimiento</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Costo de alquiler (vacío si es propio)"
            value={form.costo_alquiler}
            onChange={(e) => setForm({ ...form, costo_alquiler: e.target.value })}
            className={inputCls}
          />
          <label className="flex items-center gap-2 text-slate-700">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            />
            Activo
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button
              disabled={cargando}
              className="rounded-lg bg-azul px-4 py-2 font-semibold text-white hover:bg-azul-oscuro disabled:opacity-50"
            >
              Guardar
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

      <div className="space-y-2">
        {lista.length === 0 && <p className="text-slate-500">No hay equipos cargados.</p>}
        {lista.map((e) => (
          <div
            key={e.id}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ${
              e.activo ? "" : "opacity-60"
            }`}
          >
            <div>
              <p className="font-semibold text-slate-800">
                {e.nombre}
                {e.estado === "mantenimiento" && (
                  <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    Mantenimiento
                  </span>
                )}
                {!e.activo && (
                  <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                    Inactivo
                  </span>
                )}
              </p>
              <p className="text-sm text-slate-500">
                {e.costo_alquiler != null ? `Alquiler ${pesos(e.costo_alquiler)}` : "Propio"}
              </p>
            </div>
            <button
              onClick={() => abrirEditar(e)}
              className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
            >
              Editar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Camillas: asignación de equipos ----------

function Camillas() {
  const [recursos, setRecursos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  async function cargar() {
    try {
      const [r, e] = await Promise.all([api.recursos(), api.equipos()]);
      setRecursos(r);
      setEquipos(e);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function alternar(recurso, equipoId) {
    setError("");
    setAviso("");
    const actuales = recurso.equipos.map((e) => e.id);
    const nuevos = actuales.includes(equipoId)
      ? actuales.filter((x) => x !== equipoId)
      : [...actuales, equipoId];
    try {
      await api.asignarEquipos(recurso.id, nuevos);
      setAviso(`${recurso.nombre}: asignación guardada`);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  const equiposActivos = equipos.filter((e) => e.activo);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-800">Camillas y equipos</h2>
      <p className="text-sm text-slate-500">
        Marcá qué equipos usa cada camilla. Cambiar esto no modifica los turnos ya cargados.
      </p>

      {error && <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}
      {aviso && <div className="rounded-lg bg-green-100 p-3 text-green-800">{aviso}</div>}

      <div className="grid gap-3 md:grid-cols-2">
        {recursos.map((r) => (
          <div key={r.id} className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
            <p className="font-semibold text-slate-800">
              {r.nombre}
              <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {r.tipo === "unas" ? "Uñas" : "Camilla"}
              </span>
            </p>

            {r.tipo === "unas" ? (
              <p className="text-sm text-slate-500">Este puesto no usa equipos.</p>
            ) : equiposActivos.length === 0 ? (
              <p className="text-sm text-slate-500">Primero cargá equipos en la sección de abajo.</p>
            ) : (
              equiposActivos.map((e) => {
                const asignado = r.equipos.some((x) => x.id === e.id);
                return (
                  <label key={e.id} className="flex items-center gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={asignado}
                      onChange={() => alternar(r, e.id)}
                    />
                    {e.nombre}
                    {e.estado === "mantenimiento" && (
                      <span className="text-xs text-amber-700">(en mantenimiento)</span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Pantalla de Configuración ----------

export default function Config() {
  const [seccion, setSeccion] = useState("camillas");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-azul">Configuración</h1>

      <div className="flex gap-2">
        {[
          { id: "camillas", label: "Camillas y equipos" },
          { id: "equipos", label: "Equipos" },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setSeccion(s.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              seccion === s.id ? "bg-azul text-white" : "bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {seccion === "camillas" && <Camillas />}
      {seccion === "equipos" && <Equipos />}
    </div>
  );
}