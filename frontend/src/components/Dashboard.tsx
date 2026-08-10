import React, { useState, useEffect } from 'react';
import { brandingConfig } from '../config/branding';
import { WelcomeHeader } from './modules/dashboardModules/WelcomeHeader';
import { HeroCard } from './modules/dashboardModules/Herocard';
import { ProductivityChart } from './modules/dashboardModules/Productivitychart';
import { ResumenElectoralCards } from './modules/dashboardModules/ResumenElectoralCards';
import { MapaMexicoDashboard } from './modules/dashboardModules/MapaMexicoDashboard';
import { RadiosEscuchadasCard } from './modules/dashboardModules/RadiosEscuchadasCard';
import { PalabrasBuscadasCard } from './modules/dashboardModules/PalabrasBuscadasCard';
import { CSVGeneradosCard } from './modules/dashboardModules/CSVGeneradosCard';

interface DashboardProps {
  onSectionChange?: (section: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSectionChange }) => {
  const { colores } = brandingConfig;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: colores.fondoPrincipal, padding: isMobile ? '16px' : '32px' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        <WelcomeHeader />

          {/* ── Fila 1: [Hero + resumen] | [Mapa + Radios/Palabras/CSV] ── */}
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
              <HeroCard onNavigate={onSectionChange} />
              <ResumenElectoralCards onSectionChange={onSectionChange} />
              <MapaMexicoDashboard />
              <RadiosEscuchadasCard />
              <PalabrasBuscadasCard />
              <CSVGeneradosCard />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '0.62fr 1.38fr', gap: 24, marginBottom: 24, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ height: 330 }}>
                  <HeroCard onNavigate={onSectionChange} />
                </div>
                <ResumenElectoralCards onSectionChange={onSectionChange} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ height: 620 }}>
                  <MapaMexicoDashboard />
                </div>
                <RadiosEscuchadasCard />
                <PalabrasBuscadasCard />
                <CSVGeneradosCard />
              </div>
            </div>
          )}

        {/* ── Fila 3: ProductivityChart full width ── */}
        <div style={{ marginBottom: 24 }}>
          <ProductivityChart />
        </div>

        <style>{`
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            -webkit-font-smoothing: antialiased;
          }
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: ${colores.fondoSecundario}40; border-radius: 4px; }
          ::-webkit-scrollbar-thumb { background: ${colores.primario}60; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: ${colores.primario}80; }
        `}</style>
      </div>
    </div>
  );
};