import { useEffect, useState } from "react";
import { api } from "./api";

const NO_ACTIVOS = ["cancelado", "no_vino"];

const ESTADO_BORDE = {
  reservado: "border-slate-400",
  confirmado: "border-emerald-500",
  en_curso: "border-amber-400",
  atendido: "border-sky-500",
  cancelado: "border-red-400",
  no_vino: "border-rose-700",
};

const pesos = (n) =>
  Number(n).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const hoy = () => new Date().toLocaleDateString("en-CA");
const hora = (iso) => iso.slice(11, 16);

// Un puesto está ocupado si hay un turno activo cuya franja incluye la hora actual
function recursosConEstado(recursos, turnos) {
  const ahora = new Date();
  return recursos.map((r) => {
    const actual = turnos.find(
      (t) =>
        t.recurso_id === r.id &&
        !NO_ACTIVOS.includes(t.estado) &&
        new Date(t.inicio) <= ahora &&
        ahora < new Date(t.fin)
    );
    return { ...r, ocupado: !!actual, clienta: actual?.clienta_nombre ?? null };
  });
}

function Kpi({ icono, label, valor }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
      <span className="text-xl">{icono}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate text-lg font-bold text-slate-800">{valor}</p>
      </div>
    </div>
  );
}

export default function Inicio({ onNavegar }) {
  const [fecha] = useState(hoy);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");

  async function cargar() {
    try {
      const [resumen, recursos, turnos, caja, pendientes] = await Promise.all([
        api.inicio(),
        api.recursos(),
        api.turnos(fecha),
        api.caja(fecha),
        api.cobrosPendientes(fecha),
      ]);
      setDatos({ resumen, recursos, turnos, caja, pendientes });
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  // Se actualiza cada 30 segundos
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, []);

  if (!datos) {
    return error ? (
      <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>
    ) : (
      <p className="text-slate-500">Cargando...</p>
    );
  }

  const { resumen, caja, pendientes, turnos, recursos } = datos;
  const estados = recursosConEstado(recursos, turnos);
  const saldoPendiente = pendientes.reduce((acc, p) => acc + Number(p.saldo), 0);

  return (
    // En PC ocupa toda la altura disponible, sin scroll de página
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0">
      {error && <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}

      {/* Indicadores */}
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icono="📅" label="Turnos hoy" valor={resumen.turnos_hoy} />
        <Kpi icono="👩" label="Clientas nuevas" valor={resumen.clientas_nuevas} />
        <Kpi icono="💰" label="Ingresos del día" valor={pesos(caja.total_pagos)} />
        <Kpi icono="⏳" label="Cobros pendientes" valor={pesos(saldoPendiente)} />
      </div>

      <div className="grid gap-3 lg:min-h-0 lg:flex-1 xl:grid-cols-3">
        {/* Agenda resumida por puesto */}
        <section className="flex min-h-0 flex-col gap-2 rounded-xl bg-white p-3 shadow-sm xl:col-span-2">
          <div className="flex shrink-0 items-center justify-between">
            <h2 className="font-semibold text-slate-800">Agenda del día</h2>
            <button onClick={() => onNavegar("agenda")} className="text-sm text-azul hover:underline">
              Ver agenda
            </button>
          </div>

          <div className="grid min-h-0 flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {recursos.map((r) => {
              const delPuesto = turnos.filter((t) => t.recurso_id === r.id);
              return (
                <div
                  key={r.id}
                  className="flex min-h-0 flex-col gap-1.5 overflow-y-auto rounded-lg bg-slate-50 p-2"
                >
                  <p className="shrink-0 text-sm font-semibold text-slate-800">{r.nombre}</p>
                  {delPuesto.length === 0 && <p className="text-xs text-slate-400">Sin turnos</p>}
                  {delPuesto.map((t) => (
                    <div
                      key={t.id}
                      className={`shrink-0 rounded-md border-l-4 bg-white p-2 shadow-sm ${
                        NO_ACTIVOS.includes(t.estado) ? "opacity-50" : ""
                      } ${ESTADO_BORDE[t.estado] ?? "border-slate-400"}`}
                    >
                      <p className="text-xs font-semibold text-azul">
                        {hora(t.inicio)} – {hora(t.fin)}
                      </p>
                      <p className="truncate text-sm font-medium text-slate-800">{t.clienta_nombre}</p>
                      <p className="truncate text-xs text-slate-600">{t.tratamiento_nombre}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        {/* Columna derecha */}
        <div className="flex min-h-0 flex-col gap-3">
          <section className="shrink-0 space-y-1.5 rounded-xl bg-white p-3 shadow-sm">
            <h2 className="font-semibold text-slate-800">Estado de recursos</h2>
            {estados.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{r.nombre}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${
                      r.ocupado ? "bg-naranja" : "bg-emerald-500"
                    }`}
                  />
                  <span className="text-slate-600">{r.ocupado ? r.clienta : "Libre"}</span>
                </span>
              </div>
            ))}
          </section>

          <section className="shrink-0 space-y-1.5 rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Caja del día</h2>
              <button onClick={() => onNavegar("caja")} className="text-sm text-azul hover:underline">
                Ver caja
              </button>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Total cobrado</span>
              <span className="font-semibold text-slate-800">{pesos(caja.total_pagos)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Gastos</span>
              <span className="font-semibold text-red-700">{pesos(caja.total_gastos)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5">
              <span className="font-semibold text-slate-800">Ganancia neta</span>
              <span
                className={`font-bold ${
                  Number(caja.ganancia_neta) >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {pesos(caja.ganancia_neta)}
              </span>
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col gap-1.5 rounded-xl bg-white p-3 shadow-sm">
            <h2 className="shrink-0 font-semibold text-slate-800">Cobros pendientes</h2>
            {pendientes.length === 0 && (
              <p className="text-sm text-slate-500">No hay cobros pendientes.</p>
            )}
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {pendientes.map((p) => (
                <div key={p.turno_id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{p.clienta_nombre}</p>
                    <p className="truncate text-xs text-slate-500">{p.tratamiento_nombre}</p>
                  </div>
                  <span className="shrink-0 font-semibold text-slate-800">{pesos(p.saldo)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}