import { useState, useEffect } from 'react';
import { WebSidebar } from './components/WebSidebar';
import { WebHeader } from './components/WebHeader';
import { Inicio } from './components/Inicio';
import { Dashboard } from './components/Dashboard';
import { Ciberseguridad } from './components/departamentos/Ciberseguridad';
import { Playground } from './components/departamentos/Playground';
import { Academia } from './components/departamentos/Academia';

import { MonitorMedios } from './components/MonitorMedios';
import { MonitorIA } from './components/MonitorIA';
import { MonitorDigital } from './components/MonitorDigital';
import { InteligenciaElectoral } from './components/InteligenciaElectoral';
import { ComandoCentral } from './components/ComandoCentral';
import { MapaCampeche } from './components/MapaCampeche';
import { ResultadosElectorales } from './components/ResultadosElectorales';
import { AlertasElectoral } from './components/AlertasElectoral';
import { ToastProvider } from './components/electoral/toast';
import { ConfirmProvider } from './components/electoral/confirm';

import './responsive.css';

function App() {
  const [activeSection, setActiveSection] = useState('inicio');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sectionFromUrl = params.get('section');
    if (sectionFromUrl) {
      setActiveSection(sectionFromUrl);
    }
  }, []);

  const renderContent = () => {
    switch (activeSection) {
      case 'inicio':         return <Inicio onSectionChange={setActiveSection} />;
      case 'dashboard':      return <Dashboard onSectionChange={setActiveSection} />;
      case 'ciberseguridad': return <Ciberseguridad />;
      case 'playground':     return <Playground />;
      case 'academia':       return <Academia />;
      case 'monitor':        return <MonitorMedios />;
      case 'monitoria':      return <MonitorIA />;
      case 'comando':        return <ComandoCentral />;
      case 'mapa':           return <MapaCampeche />;
      case 'resultados':     return <ResultadosElectorales />;
      case 'alertas':        return <AlertasElectoral />;
      case 'digital':        return <MonitorDigital />;
      case 'electoral':      return <InteligenciaElectoral />;
      default:               return <Dashboard onSectionChange={setActiveSection} />;
    }
  };

  // La portada va sobre el video, a sangre; las secciones sobre los blobs,
  // igual que en el diseño original (index.html vs dashboard.html).
  const esPortada = activeSection === 'inicio';

  return (
    <ToastProvider>
      <ConfirmProvider>
        {esPortada ? (
          <div className="bg-stage" aria-hidden="true">
            <video
              className="bg-stage__video"
              src="/assets/images/earth1.mp4"
              poster="/assets/images/earth.png"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            />
          </div>
        ) : (
          <div className="bg-blobs" aria-hidden="true">
            <div className="blob blob-1" />
            <div className="blob blob-2" />
            <div className="blob blob-3" />
          </div>
        )}

        {/* Barra superior (notch) */}
        <WebHeader activeSection={activeSection} onSectionChange={setActiveSection} />

        {/* Sidebar lateral */}
        <WebSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

        {/* Contenido principal */}
        <main className={`main ${esPortada ? 'main--home' : 'main--app'}`} id="main-content">
          {renderContent()}
        </main>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;