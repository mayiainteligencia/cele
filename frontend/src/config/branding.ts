export const brandingConfig = {
  empresa: {
    nombre: "Cerebro Electoral",
    eslogan: "",
    logo: "/assets/logosNativos/cerebroElectoralLogo.png",
  },

  colores: {
    primario: "#22d3ee",           // Cyan (Campeche accent)
    primarioOscuro: "#0891b2",     // Cyan oscuro
    primarioClaro: "#67e8f9",      // Cyan claro

    secundario: "#0f172a",         // Slate 900
    acento: "#3b82f6",             // Blue (Campeche accent 2)
    acentoOscuro: "#2563eb",

    peligro: "#ef4444",
    advertencia: "#f59e0b",
    exito: "#10b981",

    fondoPrincipal: "#040914",     // Azul muy oscuro (bg-start de Campeche)
    fondoSecundario: "#0a1329",    // Azul panel
    fondoTerciario: "#132143",     // Azul hover
    fondoClaro: "#1e293b",

    textoClaro: "#f8fafc",         // Blanco
    textoMedio: "#94b2e6",         // Azul pálido (text-body de Campeche)
    textoOscuro: "#64748b",        // Gris oscuro
    textoEnOscuro: "#ffffff",      // Blanco

    borde: "#1e293b",              // Borde sutil oscuro
    bordeHover: "#334155",         // Borde hover

    gradientePrimario: "linear-gradient(135deg, #040914 0%, #0a1329 100%)",
    gradienteSecundario: "linear-gradient(135deg, #0a1329 0%, #132143 100%)",
    gradienteAcento: "linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)",

    fondoGlass: "rgba(10, 19, 41, 0.8)",

    sombra: "0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.24)",
    sombraMedia: "0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)",
    sombraGrande: "0 10px 30px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.4)",
  },

  metricas: {
    empleados: 568,
    departamentos: 9,
    tareasCompletadas: 13,
    progreso: 70,
  },

  ia: {
    nombre: "MAYIA",
    modelo: "Gemini 2.5 Flash",
    habilitado: true,
  }
};

export type BrandingConfig = typeof brandingConfig;