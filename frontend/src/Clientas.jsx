import { useEffect, useState } from "react";
import { api } from "./api";
import FichasTecnicas from "./FichasTecnicas.jsx";

const DATOS_VACIOS = {
  nombre: "",
  apellido: "",
  telefono: "",
  fecha_nacimiento: "",
  activa: true,
};

const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2";
const aNull = (v) => (v === "" || v === undefined || v === null ? null : v);

function datosDesde(c) {
  return {
    nombre: c.nombre,
    apellido: c.apellido,
    telefono: c.telefono ?? "",
    fecha_nacimiento: c.fecha_nacimiento ?? "",
    activa: c.activa,
  };
}

function payloadDatos(f) {
  return {
    nombre: f.nombre.trim(),
    apellido: f.apellido.trim(),
    telefono: aNull(f.telefono.trim()),
    fecha_nacimiento: aNull(f.fecha_nacimiento),
    activa: f.activa,
  };
}

export default function Clientas() {
  const [modo, setModo] = useState("lista");
  const [lista, setLista] = useState([]);
  const [q, setQ] = useState("");
  const [inactivas, setInactivas] = useState(false);
  const [sel, setSel] = useState(null); // clienta guardada; null = nueva
  const [datos, setDatos] = useState(DATOS_VACIOS);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    try {
      setLista(await api.clientas(q, inactivas));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    const t = setTimeout(cargar, 300);
    return () => clearTimeout(t);
  }, [q, inactivas]);

  function abrir(c) {
    setSel(c);
    setDatos(datosDesde(c));
    setError("");
    setAviso("");
    setModo("ficha");
  }

  function abrirNueva() {
    setSel(null);
    setDatos(DATOS_VACIOS);
    setError("");
    setAviso("");
    setModo("ficha");
  }

  function volver() {
    setModo("lista");
    setSel(null);
    setError("");
    setAviso("");
    cargar();
  }

  async function guardarDatos(e) {
    e.preventDefault();
    setError("");
    setAviso("");
    setCargando(true);
    try {
      const p = payloadDatos(datos);
      const r = sel ? await api.editarClienta(sel.id, p) : await api.crearClienta(p);
      setSel(r);
      setDatos(datosDesde(r));
      setAviso("Datos guardados");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  if (modo === "ficha") {
    return (
      <div className="space-y-4">
        <div>
          <button onClick={volver} className="text-sm text-azul hover:underline">
            ← Volver a clientas
          </button>
          <h1 className="text-2xl font-bold text-azul">
            {sel ? `${sel.nombre} ${sel.apellido}` : "Nueva clienta"}
          </h1>
        </div>

        {error && <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}
        {aviso && <div className="rounded-lg bg-green-100 p-3 text-green-800">{aviso}</div>}

        <form onSubmit={guardarDatos} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Datos personales</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <input
              required
              placeholder="Nombre"
              value={datos.nombre}
              onChange={(e) => setDatos((d) => ({ ...d, nombre: e.target.value }))}
              className={inputCls}
            />
            <input
              required
              placeholder="Apellido"
              value={datos.apellido}
              onChange={(e) => setDatos((d) => ({ ...d, apellido: e.target.value }))}
              className={inputCls}
            />
            <input
              placeholder="Teléfono"
              value={datos.telefono}
              onChange={(e) => setDatos((d) => ({ ...d, telefono: e.target.value }))}
              className={inputCls}
            />
            <div>
              <label className="text-xs text-slate-500">Fecha de cumpleaños</label>
              <input
                type="date"
                value={datos.fecha_nacimiento}
                onChange={(e) => setDatos((d) => ({ ...d, fecha_nacimiento: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={datos.activa}
                onChange={(e) => setDatos((d) => ({ ...d, activa: e.target.checked }))}
              />
              Activa
            </label>
            <button
              disabled={cargando}
              className="rounded-lg bg-azul px-4 py-2 font-semibold text-white hover:bg-azul-oscuro disabled:opacity-50"
            >
              Guardar datos
            </button>
          </div>
        </form>

        {sel ? (
          <FichasTecnicas clienta={sel} />
        ) : (
          <p className="rounded-lg bg-slate-100 p-3 text-slate-600">
            Primero guardá los datos personales para cargar los tratamientos y fichas técnicas.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-azul">Clientas</h1>
        <button
          onClick={abrirNueva}
          className="rounded-lg bg-naranja px-4 py-2 font-semibold text-white hover:opacity-90"
        >
          + Nueva clienta
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o teléfono"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={inactivas}
            onChange={(e) => setInactivas(e.target.checked)}
          />
          Ver inactivas
        </label>
      </div>

      {error && <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      <div className="space-y-2">
        {lista.length === 0 && <p className="text-slate-500">No hay clientas para mostrar.</p>}
        {lista.map((c) => (
          <div
            key={c.id}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ${
              c.activa ? "" : "opacity-60"
            }`}
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">
                {c.apellido}, {c.nombre}
                {!c.activa && (
                  <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                    Inactiva
                  </span>
                )}
              </p>
              <p className="text-sm text-slate-500">{c.telefono || "Sin teléfono"}</p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  c.fichas_activas > 0 ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
                }`}
              >
                {c.fichas_activas > 0 ? `${c.fichas_activas} activo(s)` : "Sin tratamientos activos"}
              </span>
              <button
                onClick={() => abrir(c)}
                className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
              >
                Abrir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}