import { useEffect, useState } from "react";
import { api } from "./api";

const FORMAS = [
  { id: "efectivo", label: "Efectivo" },
  { id: "transferencia", label: "Transferencia" },
  { id: "tarjeta", label: "Tarjeta" },
];

const CATEGORIAS = [
  { id: "alquiler_equipo", label: "Alquiler de equipo" },
  { id: "insumos", label: "Insumos" },
  { id: "servicios", label: "Servicios" },
  { id: "otros", label: "Otros" },
];

const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2";
const pesos = (n) =>
  Number(n).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const hoy = () => new Date().toLocaleDateString("en-CA");
const hora = (iso) => iso.slice(11, 16);
const formaLabel = (id) => FORMAS.find((f) => f.id === id)?.label ?? id;

const MANUAL_VACIO = { concepto: "", monto: "", forma_pago: "efectivo" };
const GASTO_VACIO = { descripcion: "", monto: "", categoria: "insumos" };

export default function Caja() {
  const [fecha, setFecha] = useState(hoy);
  const [resumen, setResumen] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [cobrando, setCobrando] = useState(null); // turno_id que se está cobrando
  const [formaCobro, setFormaCobro] = useState("efectivo");
  const [manual, setManual] = useState(MANUAL_VACIO);
  const [gasto, setGasto] = useState(GASTO_VACIO);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    try {
      const [r, p] = await Promise.all([api.caja(fecha), api.cobrosPendientes(fecha)]);
      setResumen(r);
      setPendientes(p);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
  }, [fecha]);

  // Ejecuta una acción, muestra el aviso y recarga la caja
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

  function cobrarTurno(p) {
    accion(
      () =>
        api.registrarPago({
          turno_id: p.turno_id,
          monto: Number(p.saldo),
          forma_pago: formaCobro,
        }),
      `Cobro de ${p.clienta_nombre} registrado`,
      () => setCobrando(null)
    );
  }

  function registrarManual(e) {
    e.preventDefault();
    accion(
      () =>
        api.registrarPago({
          concepto: manual.concepto.trim(),
          monto: Number(manual.monto),
          forma_pago: manual.forma_pago,
        }),
      "Cobro registrado",
      () => setManual(MANUAL_VACIO)
    );
  }

  function cargarGasto(e) {
    e.preventDefault();
    accion(
      () =>
        api.crearGasto({
          fecha,
          monto: Number(gasto.monto),
          categoria: gasto.categoria,
          descripcion: gasto.descripcion.trim(),
        }),
      "Gasto cargado",
      () => setGasto(GASTO_VACIO)
    );
  }

  function quitarPago(p) {
    if (!window.confirm(`¿Eliminar el cobro de ${pesos(p.monto)}?`)) return;
    accion(() => api.eliminarPago(p.id), "Cobro eliminado");
  }

  function quitarGasto(g) {
    if (!window.confirm(`¿Eliminar el gasto "${g.descripcion}"?`)) return;
    accion(() => api.eliminarGasto(g.id), "Gasto eliminado");
  }

  return (
    <div className="space-y-5">
      {/* Cabecera y fecha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-azul">Caja</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFecha(sumarDia(fecha, -1))}
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
            onClick={() => setFecha(sumarDia(fecha, 1))}
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

      {error && <div className="rounded-lg bg-red-100 p-3 text-red-800">{error}</div>}
      {aviso && <div className="rounded-lg bg-green-100 p-3 text-green-800">{aviso}</div>}

      {/* Resumen del día */}
      {resumen && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total cobrado</p>
            <p className="text-2xl font-bold text-slate-800">{pesos(resumen.total_pagos)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {FORMAS.map((f) => `${f.label} ${pesos(resumen.por_forma_pago[f.id] ?? 0)}`).join(" · ")}
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Gastos</p>
            <p className="text-2xl font-bold text-red-700">{pesos(resumen.total_gastos)}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Ganancia neta</p>
            <p
              className={`text-2xl font-bold ${
                Number(resumen.ganancia_neta) >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {pesos(resumen.ganancia_neta)}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Columna izquierda: cobros */}
        <div className="space-y-4">
          <section className="space-y-2 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">Cobros pendientes</h2>
            {pendientes.length === 0 && (
              <p className="text-sm text-slate-500">No hay turnos pendientes de cobro.</p>
            )}
            {pendientes.map((p) => (
              <div key={p.turno_id} className="space-y-2 rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{p.clienta_nombre}</p>
                    <p className="text-sm text-slate-500">
                      {hora(p.inicio)} · {p.tratamiento_nombre}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-azul">{pesos(p.saldo)}</span>
                    {cobrando !== p.turno_id && (
                      <button
                        onClick={() => {
                          setCobrando(p.turno_id);
                          setFormaCobro("efectivo");
                        }}
                        className="rounded-lg bg-naranja px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
                      >
                        Cobrar
                      </button>
                    )}
                  </div>
                </div>
                {cobrando === p.turno_id && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={formaCobro}
                      onChange={(e) => setFormaCobro(e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2"
                    >
                      {FORMAS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => cobrarTurno(p)}
                      disabled={cargando}
                      className="rounded-lg bg-azul px-3 py-2 text-sm font-semibold text-white hover:bg-azul-oscuro disabled:opacity-50"
                    >
                      Confirmar {pesos(p.saldo)}
                    </button>
                    <button
                      onClick={() => setCobrando(null)}
                      className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>

          <form onSubmit={registrarManual} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">Cobro manual</h2>
            <p className="text-sm text-slate-500">Para conceptos sueltos que no están en la agenda, como maderoterapia.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                required
                placeholder="Concepto"
                value={manual.concepto}
                onChange={(e) => setManual({ ...manual, concepto: e.target.value })}
                className={`${inputCls} sm:col-span-3`}
              />
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Monto"
                value={manual.monto}
                onChange={(e) => setManual({ ...manual, monto: e.target.value })}
                className={inputCls}
              />
              <select
                value={manual.forma_pago}
                onChange={(e) => setManual({ ...manual, forma_pago: e.target.value })}
                className={inputCls}
              >
                {FORMAS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <button
                disabled={cargando}
                className="rounded-lg bg-azul px-4 py-2 font-semibold text-white hover:bg-azul-oscuro disabled:opacity-50"
              >
                Registrar
              </button>
            </div>
          </form>
        </div>

        {/* Columna derecha: gastos y movimientos */}
        <div className="space-y-4">
          <form onSubmit={cargarGasto} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">Gasto del día</h2>
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
            <button
              disabled={cargando}
              className="rounded-lg bg-naranja px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Cargar gasto
            </button>
          </form>

          <section className="space-y-2 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">Cobros del día</h2>
            {resumen?.pagos.length === 0 && (
              <p className="text-sm text-slate-500">Todavía no hay cobros.</p>
            )}
            {resumen?.pagos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{p.descripcion}</p>
                  <p className="text-xs text-slate-500">
                    {hora(p.fecha)} · {formaLabel(p.forma_pago)}
                    {p.origen === "manual" && " · manual"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{pesos(p.monto)}</span>
                  <button
                    onClick={() => quitarPago(p)}
                    className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-2 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">Gastos del día</h2>
            {resumen?.gastos.length === 0 && (
              <p className="text-sm text-slate-500">Todavía no hay gastos.</p>
            )}
            {resumen?.gastos.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{g.descripcion}</p>
                  <p className="text-xs text-slate-500">
                    {CATEGORIAS.find((c) => c.id === g.categoria)?.label ?? g.categoria}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-700">{pesos(g.monto)}</span>
                  <button
                    onClick={() => quitarGasto(g)}
                    className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

function sumarDia(fecha, n) {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
}