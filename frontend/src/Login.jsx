import { useState } from "react";
import { api, setToken } from "./api";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const r = await api.login(username, password);
      setToken(r.token);
      onLogin(r.usuario);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="app-oscura flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-white/5 bg-superficie p-7 shadow-lg"
      >
        <div className="space-y-1 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-azul font-bold text-white">
            SB
          </div>
          <h1 className="text-2xl font-bold text-white">Siempre Bella</h1>
          <p className="text-sm text-slate-400">Ingresá con tu usuario</p>
        </div>

        {error && <div className="rounded-lg bg-red-100 p-3 text-sm text-red-800">{error}</div>}

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Usuario"
          autoFocus
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
        />
        <button
          disabled={cargando}
          className="w-full rounded-lg bg-azul px-4 py-2.5 font-semibold text-white hover:bg-azul-oscuro disabled:opacity-50"
        >
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}