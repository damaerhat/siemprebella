import { useEffect, useState } from "react";
import { api } from "./api";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const VISTAS = [
  { id: "anual", label: "Ingresos por mes" },
  { id: "tratamientos", label: "Tratamientos" },
  { id: "jornadas", label: "Jornadas" },
];

const pesos = (n) =>
  Number(n).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const hoy = () => new Date().toLocaleDateString("en-CA");
const inicioMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
const inputCls = "rounded-lg border border-slate-300 bg-white px-3 py-2";

const colorGanancia = (n) => (Number(n) >= 0 ? "text-emerald-700" : "text-red-700");

function Indicador({ label, valor, clase = "text-slate-800" }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${clase}`}>{valor}</p>
    </div>
  );
}

export default function Reportes() {
  const [vista, setVista] = useState("anual");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(hoy);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");

  // Cada vez que cambian la vista o el período, se vuelve a pedir el reporte
  useEffect(() => {
    let vigente = true;
    setError("");
    setDatos(null);

    const pedido =
      vista === "anual"
        ? api.ingresosMensuales(anio)
        : vista === "tratamientos"
          ? api.reporteTratamientos(desde, hasta)
          : api.reporteJornadas(desde, hasta);

    pedido
      .then((d) => vigente && setDatos(d))
      .catch((e) => vigente && setError(e.message));

    return () => {
      vigente = false;
    };
  }, [vista, anio, desde, hasta]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-azul">Reportes</h1>
        <div className="flex flex-wrap gap-2">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                vista === v.id ? "bg-azul text-white" : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros según la vista */}
      {vista === "anual" ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnio(anio - 1)}
            className="rounded-lg bg-white px-3 py-2 shadow-sm hover:bg-slate-100"
            aria-label="Año anterior"
          >
            ‹
          </button>
          <span className="min-w-16 text-center font-semibold text-slate-800">{anio}</span>
          <button
            onClick={() => setAnio(anio + 1)}
            className="rounded-lg bg-white px-3 py-2 shadow-sm hover:bg-slate-100"
            aria-label="Año siguiente"
          >
            ›
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-600">Desde</label>
          <input type="date" value={desde} onChange={(e) => e.target.value && setDesde(e.target.value)} className={inputCls} />
          <label className="text-sm text-slate-600">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => e.target.value && setHasta(e.target.value)} className={inputCls} />
        </div>
      )}

      {error && <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}
      {!datos && !error && <p className="text-slate-500">Cargando...</p>}

      {/* Ingresos por mes */}
      {datos && vista === "anual" && (
        <AnualView datos={datos} />
      )}

      {/* Tratamientos */}
      {datos && vista === "tratamientos" && (
        <TratamientosView datos={datos} />
      )}

      {/* Jornadas */}
      {datos && vista === "jornadas" && (
        <JornadasView datos={datos} />
      )}
    </div>
  );
}

function AnualView({ datos }) {
  const maximo = Math.max(...datos.meses.map((m) => Number(m.ingresos)), 1);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Indicador label={`Ingresos ${datos.anio}`} valor={pesos(datos.total_ingresos)} />
        <Indicador label="Gastos" valor={pesos(datos.total_gastos)} clase="text-red-700" />
        <Indicador label="Ganancia neta" valor={pesos(datos.total_ganancia)} clase={colorGanancia(datos.total_ganancia)} />
      </div>

      <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Por mes</h2>
        {datos.meses.map((m) => {
          const ancho = (Number(m.ingresos) / maximo) * 100;
          return (
            <div key={m.mes} className="grid grid-cols-[3rem_1fr] items-center gap-3 sm:grid-cols-[3rem_1fr_8rem_8rem]">
              <span className="text-sm font-medium text-slate-600">{MESES[m.mes - 1]}</span>
              <div className="h-6 overflow-hidden rounded bg-slate-100">
                <div className="h-full rounded bg-azul" style={{ width: `${ancho}%` }} />
              </div>
              <span className="hidden text-right text-sm text-slate-800 sm:block">{pesos(m.ingresos)}</span>
              <span className={`hidden text-right text-sm font-semibold sm:block ${colorGanancia(m.ganancia)}`}>
                {pesos(m.ganancia)}
              </span>
              <div className="col-span-2 flex justify-between text-xs text-slate-500 sm:hidden">
                <span>{pesos(m.ingresos)}</span>
                <span className={colorGanancia(m.ganancia)}>Ganancia {pesos(m.ganancia)}</span>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function TratamientosView({ datos }) {
  return (
    <div className="space-y-4">
      <Indicador label="Total cobrado en el período" valor={pesos(datos.total)} />
      <section className="space-y-2 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Más vendidos</h2>
        {datos.tratamientos.length === 0 && (
          <p className="text-sm text-slate-500">No hay cobros en este período.</p>
        )}
        {datos.tratamientos.map((t) => {
          const participacion = Number(datos.total) > 0 ? (Number(t.total) / Number(datos.total)) * 100 : 0;
          return (
            <div key={t.nombre} className="space-y-1 border-b border-slate-100 py-2 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-800">{t.nombre}</p>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-500">
                    {t.cobros} {t.cobros === 1 ? "cobro" : "cobros"}
                  </span>
                  <span className="font-semibold text-slate-800">{pesos(t.total)}</span>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-slate-100">
                <div className="h-full rounded bg-naranja" style={{ width: `${participacion}%` }} />
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function JornadasView({ datos }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Indicador label="Recaudado" valor={pesos(datos.total_recaudado)} />
        <Indicador label="Gastos" valor={pesos(datos.total_gastos)} clase="text-red-700" />
        <Indicador label="Ganancia neta" valor={pesos(datos.total_ganancia)} clase={colorGanancia(datos.total_ganancia)} />
      </div>

      <section className="space-y-2 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Jornadas cerradas</h2>
        {datos.jornadas.length === 0 && (
          <p className="text-sm text-slate-500">No hay jornadas cerradas en este período.</p>
        )}
        {datos.jornadas.map((j) => (
          <div
            key={j.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0"
          >
            <div>
              <p className="font-medium capitalize text-slate-800">
                {new Date(`${j.fecha}T12:00:00`).toLocaleDateString("es-AR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <p className="text-sm text-slate-500">
                {j.equipo_nombre ?? "Sin equipo"} · {j.total_atenciones}{" "}
                {j.total_atenciones === 1 ? "atención" : "atenciones"}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-700">{pesos(j.total_recaudado)}</span>
              <span className="text-red-700">−{pesos(j.total_gastos)}</span>
              <span className={`font-bold ${colorGanancia(j.ganancia_neta)}`}>{pesos(j.ganancia_neta)}</span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}