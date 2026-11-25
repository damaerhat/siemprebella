import { useEffect, useState } from "react";
import { api } from "./api";

const ZONAS = [
  { clave: "abdomen", titulo: "Abdomen (arriba/abajo)" },
  { clave: "gluteos", titulo: "Glúteos" },
  { clave: "pierna_der", titulo: "Pierna derecha (arriba/abajo)" },
  { clave: "pierna_izq", titulo: "Pierna izquierda (arriba/abajo)" },
];

const CAMPOS_ZONA = ZONAS.flatMap((z) => [`${z.clave}_alto`, `${z.clave}_circ`]);
const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2";
const hoy = () => new Date().toLocaleDateString("en-CA");
const fechaCorta = (f) =>
  f
    ? new Date(`${f}T12:00:00`).toLocaleDateString("es-AR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

// Pasa la ficha del servidor al formulario editable
function editorDesde(f) {
  return {
    observacion: f.observacion ?? "",
    foto: !!f.foto,
    ...Object.fromEntries(CAMPOS_ZONA.map((c) => [c, f[c] ?? ""])),
    sesiones: Array.from({ length: f.total_sesiones }, (_, i) => {
      const s = f.sesiones.find((x) => x.numero === i + 1);
      return { fecha: s?.fecha ?? "", detalle: s?.detalle ?? "" };
    }),
  };
}

// Pasa el formulario al formato del servidor
function payloadDesde(e) {
  return {
    observacion: e.observacion.trim() || null,
    foto: e.foto,
    ...Object.fromEntries(CAMPOS_ZONA.map((c) => [c, e[c] === "" ? null : Number(e[c])])),
    sesiones: e.sesiones.map((s, i) => ({
      numero: i + 1,
      fecha: s.fecha || null,
      detalle: s.detalle.trim() || null,
    })),
  };
}

export default function FichasTecnicas({ clienta }) {
  const [fichas, setFichas] = useState([]);
  const [tab, setTab] = useState("activo");
  const [nueva, setNueva] = useState(false);
  const [catalogo, setCatalogo] = useState([]);
  const [form, setForm] = useState({ tratamiento_id: "", total_sesiones: "" });
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    try {
      setFichas(await api.fichas(clienta.id));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
    api.tratamientos(false).then(setCatalogo).catch(() => {});
  }, [clienta.id]);

  // Ejecuta una acción, muestra el aviso y recarga las fichas
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

  function crear(e) {
    e.preventDefault();
    accion(
      () =>
        api.crearFicha({
          clienta_id: clienta.id,
          tratamiento_id: Number(form.tratamiento_id),
          total_sesiones: Number(form.total_sesiones),
        }),
      "Tratamiento iniciado",
      () => {
        setNueva(false);
        setForm({ tratamiento_id: "", total_sesiones: "" });
        setTab("activo");
      }
    );
  }

  const activas = fichas.filter((f) => f.estado === "activo").length;
  const terminadas = fichas.filter((f) => f.estado === "terminado").length;
  const visibles = fichas.filter((f) => f.estado === tab);

  return (
    <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Fichas técnicas</h2>
          <p className="text-xs text-slate-500">
            Cada tratamiento tiene su propia ficha. Puede haber varios activos a la vez.
          </p>
        </div>
        <button
          onClick={() => {
            setError("");
            setNueva(!nueva);
          }}
          className="rounded-lg bg-naranja px-4 py-2 font-semibold text-white hover:opacity-90"
        >
          {nueva ? "Cancelar" : "+ Nuevo tratamiento"}
        </button>
      </div>

      <div className="flex gap-2 text-sm">
        {[
          { id: "activo", label: `Activos (${activas})` },
          { id: "terminado", label: `Terminados (${terminadas})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 ${
              tab === t.id ? "bg-azul text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}
      {aviso && <div className="rounded-lg bg-green-100 p-3 text-green-800">{aviso}</div>}

      {nueva && (
        <form onSubmit={crear} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-3">
          <select
            required
            value={form.tratamiento_id}
            onChange={(e) => setForm({ ...form, tratamiento_id: e.target.value })}
            className={inputCls}
          >
            <option value="">Elegí el tratamiento</option>
            {catalogo.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
          <input
            required
            type="number"
            min="1"
            max="50"
            placeholder="Cantidad de sesiones"
            value={form.total_sesiones}
            onChange={(e) => setForm({ ...form, total_sesiones: e.target.value })}
            className={inputCls}
          />
          <button
            disabled={cargando}
            className="rounded-lg bg-azul px-4 py-2 font-semibold text-white hover:bg-azul-oscuro disabled:opacity-50"
          >
            Iniciar
          </button>
        </form>
      )}

      {visibles.length === 0 && (
        <p className="text-sm text-slate-500">
          No hay tratamientos {tab === "activo" ? "activos" : "terminados"}.
        </p>
      )}

      {visibles.map((f) => (
        <FichaCard key={f.id} ficha={f} accion={accion} />
      ))}
    </section>
  );
}

function FichaCard({ ficha, accion }) {
  const [ed, setEd] = useState(() => editorDesde(ficha));
  const [abierta, setAbierta] = useState(ficha.estado === "activo");
  const activa = ficha.estado === "activo";
  const pct = ficha.total_sesiones
    ? Math.round((ficha.realizadas / ficha.total_sesiones) * 100)
    : 0;

  useEffect(() => {
    setEd(editorDesde(ficha));
  }, [ficha]);

  function setSesion(indice, campo, valor) {
    setEd((e) => ({
      ...e,
      sesiones: e.sesiones.map((s, i) => (i === indice ? { ...s, [campo]: valor } : s)),
    }));
  }

  function guardar(e) {
    e.preventDefault();
    accion(() => api.editarFicha(ficha.id, payloadDesde(ed)), "Ficha guardada");
  }

  function terminar() {
    if (!window.confirm("¿Terminar este tratamiento? Pasa a la pestaña Terminados.")) return;
    accion(() => api.terminarFicha(ficha.id), "Tratamiento terminado");
  }

  function reabrir() {
    accion(() => api.reabrirFicha(ficha.id), "Tratamiento reabierto");
  }

  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="font-semibold text-slate-800">{ficha.nombre_tratamiento}</p>
          <p className="text-xs text-slate-500">
            Inicio {fechaCorta(ficha.fecha_inicio)}
            {ficha.fecha_fin ? ` · Fin ${fechaCorta(ficha.fecha_fin)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-700">
            {ficha.realizadas}/{ficha.total_sesiones} sesiones
          </span>
          <div className="h-2 w-24 overflow-hidden rounded bg-slate-100">
            <div className="h-full bg-azul" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </button>

      {abierta && (
        <form onSubmit={guardar} className="mt-4 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Sesiones</p>
            {ed.sesiones.map((s, i) => (
              <div key={i} className="grid grid-cols-[5rem_1fr_1fr_auto] items-center gap-2">
                <span className="text-xs text-slate-500">Sesión {i + 1}</span>
                <input
                  type="date"
                  value={s.fecha}
                  onChange={(e) => setSesion(i, "fecha", e.target.value)}
                  className={inputCls}
                />
                <input
                  placeholder="Detalle (zona, observación)"
                  value={s.detalle}
                  onChange={(e) => setSesion(i, "detalle", e.target.value)}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setSesion(i, "fecha", hoy())}
                  className="rounded-lg px-2 py-2 text-xs text-azul hover:bg-azul/10"
                >
                  Hoy
                </button>
              </div>
            ))}
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
                    value={ed[`${z.clave}_alto`]}
                    onChange={(e) =>
                      setEd({ ...ed, [`${z.clave}_alto`]: e.target.value })
                    }
                    className={inputCls}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Circunferencia (cm)"
                    value={ed[`${z.clave}_circ`]}
                    onChange={(e) =>
                      setEd({ ...ed, [`${z.clave}_circ`]: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
              </div>
            ))}
          </div>

          <textarea
            placeholder="Observación"
            rows={2}
            value={ed.observacion}
            onChange={(e) => setEd({ ...ed, observacion: e.target.value })}
            className={inputCls}
          />

          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">Foto:</span>
            {[
              { valor: true, label: "Sí" },
              { valor: false, label: "No" },
            ].map((op) => (
              <button
                key={op.label}
                type="button"
                onClick={() => setEd({ ...ed, foto: op.valor })}
                className={`rounded-lg px-3 py-1.5 ${
                  ed.foto === op.valor ? "bg-azul text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap gap-2">
              <button className="rounded-lg bg-azul px-4 py-2 font-semibold text-white hover:bg-azul-oscuro">
                Guardar ficha
              </button>
              <button
                type="button"
                onClick={() => setAbierta(false)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-slate-700 hover:bg-slate-200"
              >
                Cerrar ficha
              </button>
            </div>
            {activa ? (
              <button
                type="button"
                onClick={terminar}
                className="rounded-lg bg-naranja px-4 py-2 font-semibold text-white hover:opacity-90"
              >
                Terminar tratamiento
              </button>
            ) : (
              <button
                type="button"
                onClick={reabrir}
                className="rounded-lg bg-slate-100 px-4 py-2 text-slate-700 hover:bg-slate-200"
              >
                Reabrir
              </button>
            )}
          </div>
        </form>
      )}
    </article>
  );
}