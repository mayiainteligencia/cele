import React, { useState, useEffect } from 'react';
import { brandingConfig } from '../../config/branding';

export const Playground: React.FC = () => {
  const { colores } = brandingConfig;
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const cards = [
    { id: 1, titulo: 'API Testing',            descripcion: 'Pruebas de integración y endpoints',          mediaSrc: '/assets/playG/apitest.png'       },
    { id: 2, titulo: 'Code Sandbox',           descripcion: 'Entorno de desarrollo experimental',          mediaSrc: '/assets/playG/codesandbox.png'   },
    { id: 3, titulo: 'IA Generativa',          descripcion: 'Modelos de lenguaje y prompts',               mediaSrc: '/assets/playG/ia-gen.png'        },
    { id: 4, titulo: 'Visualización de Datos', descripcion: 'Gráficos y dashboards interactivos',          mediaSrc: '/assets/playG/visualizacion.png' },
    { id: 5, titulo: 'Automatización',         descripcion: 'Scripts y flujos de trabajo',                 mediaSrc: '/assets/playG/automatizacion.png'},
  ];

  const imgH = isMobile ? '180px' : '260px';
  const minCard = isMobile ? '150px' : '200px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: isMobile ? '16px' : '0' }}>
      <div>
        <h2 style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 'bold', color: colores.textoClaro, marginBottom: '6px' }}>
          Playground
        </h2>
        <p style={{ color: colores.textoMedio, fontSize: isMobile ? '14px' : '16px', margin: 0 }}>
          Zona de pruebas y desarrollo experimental
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minCard}, 1fr))`,
        gap: isMobile ? '12px' : '20px',
      }}>
        {cards.map((card) => {
          const isHovered = hoveredCard === card.id;
          return (
            <div
              key={card.id}
              onMouseEnter={() => setHoveredCard(card.id)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                backgroundColor: colores.fondoSecundario,
                borderRadius: '16px',
                border: isHovered ? `2px solid ${colores.primario}` : `1px solid ${colores.borde}`,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                transform: isHovered ? 'translateY(-4px) scale(1.01)' : 'translateY(0) scale(1)',
                boxShadow: isHovered ? `0 12px 28px rgba(3,140,174,0.25)` : '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ width: '100%', height: imgH, position: 'relative', backgroundColor: colores.fondoTerciario, overflow: 'hidden' }}>
                <img
                  src={card.mediaSrc}
                  alt={card.titulo}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease', transform: isHovered ? 'scale(1.08)' : 'scale(1)', filter: isHovered ? 'brightness(1.1)' : 'brightness(1)' }}
                  onError={(e) => {
                    const t = e.target as HTMLImageElement;
                    t.style.display = 'none';
                    const c = t.parentElement;
                    if (c) c.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:${colores.textoMedio};background:${colores.fondoTerciario}"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></div>`;
                  }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(3,140,174,0.95) 0%, rgba(3,140,174,0.7) 40%, transparent 100%)', display: 'flex', alignItems: 'flex-end', padding: '16px', opacity: isHovered ? 1 : 0, transition: 'opacity 0.3s ease' }}>
                  <p style={{ color: '#fff', fontSize: '12px', margin: 0, lineHeight: '1.5', fontWeight: '600' }}>{card.descripcion}</p>
                </div>
              </div>
              <div style={{ padding: '12px 14px', backgroundColor: isHovered ? colores.fondoTerciario : 'transparent', transition: 'background-color 0.3s ease' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '600', color: isHovered ? colores.primario : colores.textoClaro, margin: 0, lineHeight: '1.3', transition: 'color 0.3s ease' }}>
                  {card.titulo}
                </h4>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};