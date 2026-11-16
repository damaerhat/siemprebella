import { useEffect, useState } from "react";
import { api } from "./api";

const DATOS_VACIOS = {
  nombre: "",
  apellido: "",
  telefono: "",
  fecha_nacimiento: "",
  activa: true,
};

const SESIONES = 8;

// Zonas de la hoja: cada una tiene alto y circunferencia
const ZONAS = [
  { clave: "abdomen", titulo: "Abdomen (arriba/abajo)" },
  { clave: "gluteos", titulo: "Glúteos" },
  { clave: "pierna_der", titulo: "Pierna derecha (arriba/abajo)" },
  { clave: "pierna_izq", titulo: "Pierna izquierda (arriba/abajo)" },
];

const CAMPOS_ZONA = ZONAS.flatMap((z) => [`${z.clave}_alto`, `${z.clave}_circ`]);

const FICHA_VACIA = {
  observacion: "",
  fecha: "",
  monto: "",
  forma_pago: "efectivo",
  sesion: "",
  medidas: "",
  foto: false,
  sesiones: Array(SESIONES).fill(""),
  ...Object.fromEntries(CAMPOS_ZONA.map((c) => [c, ""])),
};

const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2";

const aNull = (v) => (v === "" || v === undefined || v === null ? null : v);
const num = (v) => (v === "" || v === undefined || v === null ? null : Number(v));

function datosDesde(c) {
  return {
    nombre: c.nombre,
    apellido: c.apellido,
    telefono: c.telefono ?? "",
    fecha_nacimiento: c.fecha_nacimiento ?? "",
    activa: c.activa,
  };
}

function fichaDesde(f) {
  if (!f) return { ...FICHA_VACIA };
  return {
    observacion: f.observacion ?? "",
    fecha: f.fecha ?? "",
    monto: f.monto ?? "",
    forma_pago: f.forma_pago ?? "efectivo",
    sesion: f.sesion ?? "",
    medidas: f.medidas ?? "",
    foto: !!f.foto,
    sesiones: Array.from(
      { length: SESIONES },
      (_, i) => f.sesiones?.find((s) => s.numero === i + 1)?.detalle ?? ""
    ),
    ...Object.fromEntries(CAMPOS_ZONA.map((c) => [c, f[c] ?? ""])),
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

function payloadFicha(f) {
  return {
    observacion: aNull(f.observacion.trim()),
    fecha: aNull(f.fecha),
    monto: num(f.monto),
    forma_pago: aNull(f.forma_pago),
    sesion: aNull(f.sesion.trim()),
    medidas: aNull(f.medidas.trim()),
    foto: f.foto,
    ...Object.fromEntries(CAMPOS_ZONA.map((c) => [c, num(f[c])])),
    sesiones: f.sesiones.map((d, i) => ({ numero: i + 1, detalle: aNull(d.trim()) })),
  };
}

export default function Clientas() {
  const [modo, setModo] = useState("lista"); // "lista" | "ficha"
  const [lista, setLista] = useState([]);
  const [q, setQ] = useState("");
  const [inactivas, setInactivas] = useState(false);
  const [sel, setSel] = useState(null); // clienta guardada; null = nueva
  const [datos, setDatos] = useState(DATOS_VACIOS);
  const [ficha, setFicha] = useState(FICHA_VACIA);
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

  // Búsqueda con pequeña espera para no pedir en cada tecla
  useEffect(() => {
    const t = setTimeout(cargar, 300);
    return () => clearTimeout(t);
  }, [q, inactivas]);

  function abrir(c) {
    setSel(c);
    setDatos(datosDesde(c));
    setFicha(fichaDesde(c.ficha));
    setError("");
    setAviso("");
    setModo("ficha");
  }

  function abrirNueva() {
    setSel(null);
    setDatos(DATOS_VACIOS);
    setFicha(FICHA_VACIA);
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

  function setCampoFicha(campo, valor) {
    setFicha((f) => ({ ...f, [campo]: valor }));
  }

  function setSesion(indice, valor) {
    setFicha((f) => ({
      ...f,
      sesiones: f.sesiones.map((s, i) => (i === indice ? valor : s)),
    }));
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
      setFicha(fichaDesde(r.ficha));
      setAviso("Datos guardados");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function guardarFicha(e) {
    e.preventDefault();
    if (!sel) return;
    setError("");
    setAviso("");
    setCargando(true);
    try {
      const r = await api.guardarFicha(sel.id, payloadFicha(ficha));
      setSel(r);
      setFicha(fichaDesde(r.ficha));
      setAviso("Ficha técnica guardada");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  // ---------- Vista de ficha ----------
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

        <div className="grid gap-4 xl:grid-cols-2">
          {/* Datos personales */}
          <form onSubmit={guardarDatos} className="h-fit space-y-3 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">Datos personales</h2>
            <div className="grid gap-3 sm:grid-cols-2">
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
          </form>

          {/* Ficha técnica */}
          <form onSubmit={guardarFicha} className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Ficha técnica</h2>
              <p className="text-xs text-slate-500">Registro de sesiones de depilación definitiva y medidas.</p>
            </div>

            {!sel ? (
              <p className="rounded-lg bg-slate-100 p-3 text-slate-600">
                Primero guardá los datos personales para cargar la ficha técnica.
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-500">Fecha</label>
                    <input
                      type="date"
                      value={ficha.fecha}
                      onChange={(e) => setCampoFicha("fecha", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Monto</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={ficha.monto}
                      onChange={(e) => setCampoFicha("monto", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Forma de pago</label>
                    <select
                      value={ficha.forma_pago}
                      onChange={(e) => setCampoFicha("forma_pago", e.target.value)}
                      className={inputCls}
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Sesión</label>
                    <input
                      value={ficha.sesion}
                      onChange={(e) => setCampoFicha("sesion", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                <textarea
                  placeholder="Observación"
                  rows={2}
                  value={ficha.observacion}
                  onChange={(e) => setCampoFicha("observacion", e.target.value)}
                  className={inputCls}
                />

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Sesiones</p>
                  {ficha.sesiones.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 text-xs text-slate-500">{i + 1} sesión</span>
                      <input
                        value={s}
                        onChange={(e) => setSesion(i, e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-500">Medidas</label>
                    <input
                      value={ficha.medidas}
                      onChange={(e) => setCampoFicha("medidas", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Foto</label>
                    <div className="flex gap-2">
                      {[
                        { valor: true, label: "Sí" },
                        { valor: false, label: "No" },
                      ].map((op) => (
                        <button
                          key={op.label}
                          type="button"
                          onClick={() => setCampoFicha("foto", op.valor)}
                          className={`flex-1 rounded-lg px-3 py-2 text-sm ${
                            ficha.foto === op.valor
                              ? "bg-azul text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {op.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {ZONAS.map((z) => (
                    <div key={z.clave} className="space-y-2 rounded-lg border border-slate-300 p-3">
                      <p className="text-sm font-medium text-slate-700">{z.titulo}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="Alto (cm)"
                          value={ficha[`${z.clave}_alto`]}
                          onChange={(e) => setCampoFicha(`${z.clave}_alto`, e.target.value)}
                          className={inputCls}
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="Circunferencia (cm)"
                          value={ficha[`${z.clave}_circ`]}
                          onChange={(e) => setCampoFicha(`${z.clave}_circ`, e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  disabled={cargando}
                  className="rounded-lg bg-azul px-4 py-2 font-semibold text-white hover:bg-azul-oscuro disabled:opacity-50"
                >
                  Guardar ficha técnica
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    );
  }

  // ---------- Listado ----------
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
                  c.ficha ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
                }`}
              >
                {c.ficha ? "Con ficha" : "Sin ficha"}
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