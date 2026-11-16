import { useEffect, useState } from "react";

const MENU = [
  { id: "inicio", label: "Inicio", icono: "🏠" },
  { id: "agenda", label: "Agenda", icono: "📅" },
  { id: "clientas", label: "Clientas", icono: "👩" },
  { id: "tratamientos", label: "Tratamientos", icono: "💆" },
  { id: "jornadas", label: "Jornadas", icono: "🗓️" },
  { id: "caja", label: "Caja", icono: "💰" },
  { id: "reportes", label: "Reportes", icono: "📊" },
  { id: "config", label: "Configuración", icono: "⚙️", soloAdmin: true },
];

// Accesos de la barra inferior del celu (el resto va en "Más")
const RAPIDO = ["inicio", "agenda", "clientas", "caja"];

export default function Layout({ vista, onNavegar, onSalir, usuario, children }) {
  const [colapsado, setColapsado] = useState(
    () => localStorage.getItem("menuColapsado") === "1"
  );
  const [menuMovil, setMenuMovil] = useState(false);
  const [ahora, setAhora] = useState(new Date());

  useEffect(() => {
    localStorage.setItem("menuColapsado", colapsado ? "1" : "0");
  }, [colapsado]);

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const menuVisible = MENU.filter((item) => !item.soloAdmin || usuario?.rol === "admin");
  const rapidoVisible = menuVisible.filter((item) => RAPIDO.includes(item.id));

  const fecha = ahora.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const fechaCap = fecha.charAt(0).toUpperCase() + fecha.slice(1);
  const hora = ahora.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const inicial = usuario?.nombre?.charAt(0).toUpperCase() ?? "?";

  const anchoSidebar = colapsado ? "lg:w-16" : "lg:w-52";
  const margenMain = colapsado ? "lg:ml-16" : "lg:ml-52";
  const inicioHeader = colapsado ? "lg:left-16" : "lg:left-52";

  function ir(id) {
    onNavegar(id);
    setMenuMovil(false);
  }

  return (
    <div className="app-oscura flex h-screen w-full overflow-hidden text-sm">
      {menuMovil && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMenuMovil(false)}
        />
      )}

      {/* Menú lateral (PC y cajón en tablet/celu) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-52 flex-col border-r border-white/5 bg-superficie text-slate-100 transition-all duration-200 ${
          menuMovil ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 ${anchoSidebar}`}
      >
        <div className="flex h-14 items-center gap-2 px-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-azul text-xs font-bold text-white">
            SB
          </div>
          <span className={`truncate font-bold ${colapsado ? "lg:hidden" : ""}`}>
            Siempre Bella
          </span>
          <button
            onClick={() => setMenuMovil(false)}
            className="ml-auto rounded-lg p-1 hover:bg-white/10 lg:hidden"
            aria-label="Cerrar menú"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-2 pt-2">
          {menuVisible.map((item) => {
            const activo = vista === item.id;
            return (
              <button
                key={item.id}
                onClick={() => ir(item.id)}
                title={item.label}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  activo ? "bg-naranja text-white shadow" : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <span className="text-base">{item.icono}</span>
                <span className={`font-medium ${colapsado ? "lg:hidden" : ""}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <p
          className={`px-4 pb-4 font-script text-lg leading-tight text-azul ${
            colapsado ? "lg:hidden" : ""
          }`}
        >
          Cuidarte te hace única
        </p>
      </aside>

      {/* Barra superior fija */}
      <header
        className={`fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-white/5 bg-superficie px-3 text-white transition-all duration-200 ${inicioHeader}`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMenuMovil(true)}
            className="rounded-lg p-1.5 text-lg hover:bg-white/10 lg:hidden"
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <button
            onClick={() => setColapsado(!colapsado)}
            className="hidden rounded-lg p-1.5 text-lg hover:bg-white/10 lg:block"
            aria-label="Contraer o expandir menú"
          >
            ☰
          </button>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-wide text-azul md:text-base">SIEMPRE BELLA</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <span className="hidden text-xs text-slate-300 xl:block">📅 {fechaCap}</span>
          <span className="text-xs text-slate-300">🕒 {hora}</span>
          <div className="hidden h-6 border-l border-white/10 sm:block" />
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-azul text-xs font-bold text-white">
              {inicial}
            </div>
            <div className="hidden leading-tight md:block">
              <p className="text-xs font-semibold">{usuario?.nombre ?? "Usuario"}</p>
              <p className="text-[10px] text-slate-400">
                {usuario?.rol === "admin" ? "Administradora" : "Operador"}
              </p>
            </div>
          </div>
          <button
            onClick={onSalir}
            className="rounded-lg bg-white/10 px-2.5 py-1 text-xs hover:bg-white/20"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main
        className={`flex h-screen min-w-0 flex-1 flex-col pt-14 transition-all duration-200 ${margenMain}`}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 pb-20 md:p-4 md:pb-20 lg:pb-4">
          {children}
        </div>
      </main>

      {/* Barra inferior: solo celu y tablet */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-white/5 bg-superficie lg:hidden">
        {rapidoVisible.map((item) => {
          const activo = vista === item.id;
          return (
            <button
              key={item.id}
              onClick={() => ir(item.id)}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                activo ? "font-semibold text-azul" : "text-slate-400"
              }`}
            >
              <span className="text-lg leading-none">{item.icono}</span>
              {item.label}
            </button>
          );
        })}
        <button
          onClick={() => setMenuMovil(true)}
          className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-slate-400"
        >
          <span className="text-lg leading-none">☰</span>
          Más
        </button>
      </nav>
    </div>
  );
}