import { useEffect, useState } from "react";
import { api } from "./api";

const pesos = (n) =>
  Number(n).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const SECCIONES = [
  { id: "estetica", label: "Estética" },
  { id: "depilacion", label: "Depilación definitiva" },
];

export default function Tratamientos() {
  const [seccion, setSeccion] = useState("estetica");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-azul">Tratamientos</h1>

      <div className="flex gap-2">
        {SECCIONES.map((s) => (
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

      {seccion === "estetica" ? <Estetica /> : <Depilacion />}
    </div>
  );
}

// ---------- Estética: individuales y combos con sesiones ----------

const formVacio = () => ({
  nombre: "",
  categoria: "",
  tipo: "individual",
  duracion_min: "",
  precio: "",
  activo: true,
  items: [],
});

function armarPayload(f) {
  const base = {
    nombre: f.nombre.trim(),
    categoria: f.categoria.trim(),
    tipo: f.tipo,
    precio: Number(f.precio),
    activo: f.activo,
  };
  if (f.tipo === "individual") {
    return { ...base, duracion_min: Number(f.duracion_min), items: [] };
  }
  return {
    ...base,
    duracion_min: null,
    items: f.items.map((i) => ({
      tratamiento_id: Number(i.tratamiento_id),
      cantidad: Number(i.cantidad),
    })),
  };
}

function formDesde(t) {
  return {
    id: t.id,
    nombre: t.nombre,
    categoria: t.categoria,
    tipo: t.tipo,
    duracion_min: t.duracion_min ?? "",
    precio: t.precio,
    activo: t.activo,
    items: t.items.map((i) => ({ tratamiento_id: i.tratamiento_id, cantidad: i.cantidad })),
  };
}

function Estetica() {
  const [lista, setLista] = useState([]);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    try {
      setLista(await api.tratamientos(incluirInactivos));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
  }, [incluirInactivos]);

  const individuales = lista.filter((t) => t.tipo === "individual" && t.activo);

  function cambiarItem(index, campo, valor) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === index ? { ...it, [campo]: valor } : it)),
    }));
  }

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const datos = armarPayload(form);
      if (form.id) await api.editarTratamiento(form.id, datos);
      else await api.crearTratamiento(datos);
      setForm(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function alternarActivo(t) {
    setError("");
    try {
      if (t.activo) await api.desactivarTratamiento(t.id);
      else await api.activarTratamiento(t.id);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Equipos, masajes, lifting, etc. Se usan en la agenda de camillas y uñas.
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={incluirInactivos}
              onChange={(e) => setIncluirInactivos(e.target.checked)}
            />
            Ver inactivos
          </label>
          <button
            onClick={() => {
              setError("");
              setForm(formVacio());
            }}
            className="rounded-lg bg-naranja px-4 py-2 font-semibold text-white hover:opacity-90"
          >
            + Nuevo
          </button>
        </div>
      </div>

      {error && !form && <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      {form && (
        <form onSubmit={guardar} className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">
            {form.id ? "Editar tratamiento" : "Nuevo tratamiento"}
          </h2>
          {error && <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <input
              required
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              required
              placeholder="Categoría (ej: Facial, Masajes)"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value, items: [] })}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="individual">Individual</option>
              <option value="combo">Combo / paquete</option>
            </select>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              placeholder="Precio"
              value={form.precio}
              onChange={(e) => setForm({ ...form, precio: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            {form.tipo === "individual" && (
              <input
                required
                type="number"
                min="1"
                placeholder="Duración (minutos)"
                value={form.duracion_min}
                onChange={(e) => setForm({ ...form, duracion_min: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
            )}
            <label className="flex items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
              />
              Activo
            </label>
          </div>

          {form.tipo === "combo" && (
            <div className="space-y-2">
              <p className="font-medium text-slate-700">Componentes del combo</p>
              {form.items.map((it, index) => (
                <div key={index} className="flex flex-wrap gap-2">
                  <select
                    required
                    value={it.tratamiento_id}
                    onChange={(e) => cambiarItem(index, "tratamiento_id", e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="">Elegí un tratamiento</option>
                    {individuales.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    type="number"
                    min="1"
                    value={it.cantidad}
                    onChange={(e) => cambiarItem(index, "cantidad", e.target.value)}
                    className="w-24 rounded-lg border border-slate-300 px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }))
                    }
                    className="rounded-lg px-3 text-red-700 hover:bg-red-50"
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, items: [...f.items, { tratamiento_id: "", cantidad: 1 }] }))
                }
                className="rounded-lg border border-dashed border-azul px-3 py-2 text-azul hover:bg-azul/5"
              >
                + Agregar componente
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button
              disabled={cargando}
              className="rounded-lg bg-azul px-4 py-2 font-semibold text-white hover:bg-azul-oscuro disabled:opacity-50"
            >
              {cargando ? "Guardando..." : "Guardar"}
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
        {lista.length === 0 && <p className="text-slate-500">No hay tratamientos de estética.</p>}
        {lista.map((t) => (
          <div
            key={t.id}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ${
              t.activo ? "" : "opacity-60"
            }`}
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">
                {t.nombre}
                <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {t.tipo === "combo" ? "Combo" : "Individual"}
                </span>
                {!t.activo && (
                  <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                    Inactivo
                  </span>
                )}
              </p>
              <p className="text-sm text-slate-500">
                {t.categoria}
                {t.tipo === "individual" && t.duracion_min ? ` · ${t.duracion_min} min` : ""}
              </p>
              {t.tipo === "combo" && t.items.length > 0 && (
                <p className="text-sm text-slate-600">
                  {t.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(", ")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-azul">{pesos(t.precio)}</span>
              <button
                onClick={() => {
                  setError("");
                  setForm(formDesde(t));
                }}
                className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
              >
                Editar
              </button>
              <button
                onClick={() => alternarActivo(t)}
                className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
              >
                {t.activo ? "Desactivar" : "Activar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Depilación definitiva: servicios sueltos ----------

const DEP_VACIO = { id: null, nombre: "", precio: "", orden: 0, activo: true };

function Depilacion() {
  const [lista, setLista] = useState([]);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    try {
      setLista(await api.serviciosDepilacion(incluirInactivos));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
  }, [incluirInactivos]);

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setCargando(true);
    const datos = {
      nombre: form.nombre.trim(),
      precio: Number(form.precio),
      orden: Number(form.orden) || 0,
      activo: form.activo,
    };
    try {
      if (form.id) await api.editarServicioDepilacion(form.id, datos);
      else await api.crearServicioDepilacion(datos);
      setForm(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function alternarActivo(s) {
    setError("");
    try {
      if (s.activo) await api.desactivarServicioDepilacion(s.id);
      else await api.activarServicioDepilacion(s.id);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Servicios sueltos de la jornada de depilación definitiva (cavado, tiro de cola, axilas, etc.).
          No se usan en la agenda.
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={incluirInactivos}
              onChange={(e) => setIncluirInactivos(e.target.checked)}
            />
            Ver inactivos
          </label>
          <button
            onClick={() => {
              setError("");
              setForm({ ...DEP_VACIO });
            }}
            className="rounded-lg bg-naranja px-4 py-2 font-semibold text-white hover:opacity-90"
          >
            + Nuevo servicio
          </button>
        </div>
      </div>

      {error && !form && <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      {form && (
        <form onSubmit={guardar} className="grid gap-3 rounded-xl bg-white p-5 shadow-sm sm:grid-cols-4">
          <input
            required
            placeholder="Nombre (ej: Cavado)"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 sm:col-span-2"
          />
          <input
            required
            type="number"
            min="0"
            step="0.01"
            placeholder="Precio"
            value={form.precio}
            onChange={(e) => setForm({ ...form, precio: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
          <input
            type="number"
            min="0"
            placeholder="Orden"
            value={form.orden}
            onChange={(e) => setForm({ ...form, orden: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
          <label className="flex items-center gap-2 text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            />
            Activo
          </label>
          <div className="flex gap-2 sm:col-span-4">
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
        {lista.length === 0 && <p className="text-slate-500">No hay servicios de depilación cargados.</p>}
        {lista.map((s) => (
          <div
            key={s.id}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ${
              s.activo ? "" : "opacity-60"
            }`}
          >
            <div>
              <p className="font-semibold text-slate-800">
                {s.nombre}
                {!s.activo && (
                  <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                    Inactivo
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-azul">{pesos(s.precio)}</span>
              <button
                onClick={() => {
                  setError("");
                  setForm({ ...s, orden: s.orden ?? 0 });
                }}
                className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
              >
                Editar
              </button>
              <button
                onClick={() => alternarActivo(s)}
                className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
              >
                {s.activo ? "Desactivar" : "Activar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}