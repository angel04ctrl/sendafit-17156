/**
 * main.tsx - Punto de entrada de la aplicación
 * 
 * Este documento es el archivo principal que inicia la aplicación React.
 * Se encarga de:
 * - Montar el componente App en el DOM
 * - Importar los estilos globales (index.css)
 * - Inicializar la aplicación en el elemento con id "root"
 */

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/**
 * Inicialización de la aplicación React
 * Este bloque crea el root de React y renderiza el componente App principal
 */
createRoot(document.getElementById("root")!).render(<App />);
