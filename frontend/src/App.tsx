import { useState } from 'react';
import { ResponsiveLayout } from './components/ResponsiveLayout';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
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
import { brandingConfig } from './config/branding';
import { tituloDe } from './config/menu';


import './responsive.css';

function App() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const { colores } = brandingConfig;

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':      return <Dashboard onSectionChange={setActiveSection} />;
      case 'ciberseguridad': return <Ciberseguridad />;
      case 'playground':     return <Playground />;
      case 'academia':       return <Academia />;

      case 'monitor': return <MonitorMedios />;
      case 'monitoria': return <MonitorIA />;
      case 'comando': return <ComandoCentral />;
      case 'mapa': return <MapaCampeche />;
      case 'resultados': return <ResultadosElectorales />;
      case 'alertas': return <AlertasElectoral />;
      case 'digital': return <MonitorDigital />;
      case 'electoral': return <InteligenciaElectoral />;
      default:               return <Dashboard onSectionChange={setActiveSection} />;
    }
  };

  return (
    <ToastProvider>
     <ConfirmProvider>
      <ResponsiveLayout
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        header={<Header title={tituloDe(activeSection)} onSectionChange={setActiveSection} />}
        sidebar={
          <Sidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
        }
      >
        <div style={{ flex: 1, overflow: 'auto', backgroundColor: colores.fondoPrincipal }}>
          {renderContent()}
        </div>
      </ResponsiveLayout>
     </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;