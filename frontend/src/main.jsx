import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import Login from "./Login.jsx";
import { getToken, setToken } from "./api";

function Gate() {
  const [logueado, setLogueado] = useState(!!getToken());
  const [usuario, setUsuario] = useState(() =>
    JSON.parse(localStorage.getItem("usuario") || "null")
  );

  useEffect(() => {
    const salir = () => setLogueado(false);
    window.addEventListener("auth:logout", salir);
    return () => window.removeEventListener("auth:logout", salir);
  }, []);

  if (!logueado) {
    return (
      <Login
        onLogin={(u) => {
          localStorage.setItem("usuario", JSON.stringify(u));
          setUsuario(u);
          setLogueado(true);
        }}
      />
    );
  }

  return (
    <App
      usuario={usuario}
      onSalir={() => {
        setToken(null);
        localStorage.removeItem("usuario");
        setLogueado(false);
      }}
    />
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Gate />
  </StrictMode>
);