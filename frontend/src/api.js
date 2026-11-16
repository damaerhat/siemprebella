const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const TOKEN_KEY = "token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }

  if (res.status === 401 && path !== "/auth/login") {
    setToken(null);
    window.dispatchEvent(new Event("auth:logout"));
    throw new Error("La sesión venció, ingresá de nuevo");
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const detalle = data?.detail;
    const msg = typeof detalle === "string" ? detalle : "Error inesperado";
    throw new Error(msg);
  }
  return data;
}

const json = (body) => JSON.stringify(body);

export const api = {
  login: (username, password) =>
    request("/auth/login", { method: "POST", body: json({ username, password }) }),
  me: () => request("/auth/me"),

  tratamientos: (incluirInactivos = false) =>
    request(`/tratamientos?incluir_inactivos=${incluirInactivos}`),
  serviciosDepilacion: (incluirInactivos = false) =>
    request(`/servicios-depilacion?incluir_inactivos=${incluirInactivos}`),
  crearServicioDepilacion: (datos) =>
    request("/servicios-depilacion", { method: "POST", body: json(datos) }),
  editarServicioDepilacion: (id, datos) =>
    request(`/servicios-depilacion/${id}`, { method: "PUT", body: json(datos) }),
  desactivarServicioDepilacion: (id) =>
    request(`/servicios-depilacion/${id}/desactivar`, { method: "POST" }),
  activarServicioDepilacion: (id) =>
    request(`/servicios-depilacion/${id}/activar`, { method: "POST" }),
  crearTratamiento: (datos) => request("/tratamientos", { method: "POST", body: json(datos) }),
  editarTratamiento: (id, datos) =>
    request(`/tratamientos/${id}`, { method: "PUT", body: json(datos) }),
  desactivarTratamiento: (id) => request(`/tratamientos/${id}/desactivar`, { method: "POST" }),
  activarTratamiento: (id) => request(`/tratamientos/${id}/activar`, { method: "POST" }),

  clientas: (q = "", incluirInactivas = false) =>
    request(`/clientas?q=${encodeURIComponent(q)}&incluir_inactivas=${incluirInactivas}`),
  crearClienta: (datos) => request("/clientas", { method: "POST", body: json(datos) }),
  editarClienta: (id, datos) => request(`/clientas/${id}`, { method: "PUT", body: json(datos) }),
  guardarFicha: (id, datos) =>
    request(`/clientas/${id}/ficha`, { method: "PUT", body: json(datos) }),

  recursos: () => request("/recursos"),
  asignarEquipos: (id, equipo_ids) =>
    request(`/recursos/${id}/equipos`, { method: "PUT", body: json({ equipo_ids }) }),

  equipos: () => request("/equipos"),
  crearEquipo: (datos) => request("/equipos", { method: "POST", body: json(datos) }),
  editarEquipo: (id, datos) => request(`/equipos/${id}`, { method: "PUT", body: json(datos) }),

  turnos: (fecha) => request(`/turnos?fecha=${fecha}`),
  crearTurno: (datos) => request("/turnos", { method: "POST", body: json(datos) }),
  editarTurno: (id, datos) => request(`/turnos/${id}`, { method: "PUT", body: json(datos) }),

  inicio: () => request("/inicio/resumen"),
  caja: (fecha) => request(`/caja/dia?fecha=${fecha}`),
  cobrosPendientes: (fecha) => request(`/caja/cobros-pendientes?fecha=${fecha}`),
  registrarPago: (datos) => request("/caja/pagos", { method: "POST", body: json(datos) }),
  eliminarPago: (id) => request(`/caja/pagos/${id}`, { method: "DELETE" }),
  crearGasto: (datos) => request("/caja/gastos", { method: "POST", body: json(datos) }),
  eliminarGasto: (id) => request(`/caja/gastos/${id}`, { method: "DELETE" }),
  ingresosMensuales: (anio) => request(`/reportes/ingresos-mensuales?anio=${anio}`),
  reporteTratamientos: (desde, hasta) =>
    request(`/reportes/tratamientos?desde=${desde}&hasta=${hasta}`),
  reporteJornadas: (desde, hasta) => request(`/reportes/jornadas?desde=${desde}&hasta=${hasta}`),
  reporteResumen: (desde, hasta) => request(`/reportes/resumen?desde=${desde}&hasta=${hasta}`),
  jornadas: () => request("/jornadas"),
  jornada: (id) => request(`/jornadas/${id}`),
  crearJornada: (datos) => request("/jornadas", { method: "POST", body: json(datos) }),
  iniciarJornada: (id) => request(`/jornadas/${id}/iniciar`, { method: "POST" }),
  cerrarJornada: (id, datos) =>
    request(`/jornadas/${id}/cerrar`, { method: "POST", body: json(datos) }),
  crearAtencion: (jornadaId, datos) =>
    request(`/jornadas/${jornadaId}/atenciones`, { method: "POST", body: json(datos) }),
  asignarTratamientos: (id, datos) =>
    request(`/jornadas/atenciones/${id}/tratamientos`, { method: "PUT", body: json(datos) }),
  eliminarAtencion: (id) => request(`/jornadas/atenciones/${id}`, { method: "DELETE" }),
  crearGastoJornada: (jornadaId, datos) =>
    request(`/jornadas/${jornadaId}/gastos`, { method: "POST", body: json(datos) }),
};