import { useState } from "react";
import Layout from "./Layout.jsx";
import Agenda from "./Agenda.jsx";
import Caja from "./Caja.jsx";
import Clientas from "./Clientas.jsx";
import Config from "./Config.jsx";
import Inicio from "./Inicio.jsx";
import Jornadas from "./Jornadas.jsx";
import Reportes from "./Reportes.jsx";
import Tratamientos from "./Tratamientos.jsx";

const TITULOS = {
  inicio: "Inicio",
  agenda: "Agenda",
  clientas: "Clientas",
  tratamientos: "Tratamientos",
  jornadas: "Jornadas de depilación definitiva",
  caja: "Caja",
  reportes: "Reportes",
  config: "Configuración",
};

export default function App({ usuario, onSalir }) {
  const [vista, setVista] = useState("inicio");

  function navegar(id) {
    // Configuración es solo para admin, aunque alguien fuerce el cambio desde consola
    if (id === "config" && usuario?.rol !== "admin") return;
    setVista(id);
  }

  function contenido() {
    if (vista === "inicio") return <Inicio usuario={usuario} onNavegar={navegar} />;
    if (vista === "agenda") return <Agenda />;
    if (vista === "caja") return <Caja />;
    if (vista === "clientas") return <Clientas />;
    if (vista === "tratamientos") return <Tratamientos />;
    if (vista === "jornadas") return <Jornadas />;
    if (vista === "reportes") return <Reportes />;
    if (vista === "config") return <Config />;
    return (
      <>
        <h1 className="mb-2 text-2xl font-bold text-azul">{TITULOS[vista]}</h1>
        <p className="text-gray-600">Pantalla en construcción.</p>
      </>
    );
  }

  return (
    <Layout vista={vista} onNavegar={navegar} onSalir={onSalir} usuario={usuario}>
      {contenido()}
    </Layout>
  );
}