import React, { useState, useEffect } from 'react';
import { brandingConfig } from '../../config/branding';

export const Ciberseguridad: React.FC = () => {
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
    { id: 1, titulo: 'CIBER RIESGO',                descripcion: 'Consultor Digital para portafolio estratégico - $98,000',           mediaSrc: '/assets/ciberS/ciberS1.png' },
    { id: 2, titulo: 'Soluciones de Ciberseguridad', descripcion: 'Técnico IA especializado para MIPYME',                              mediaSrc: '/assets/ciberS/ciberS2.png' },
    { id: 3, titulo: 'Centro de Ciberresiliencia',   descripcion: 'Protección especializada para Inteligencia Artificial',             mediaSrc: '/assets/ciberS/ciberS3.png' },
    { id: 4, titulo: 'Monitoreo 24/7 en I.A. NOC',  descripcion: 'Vigilancia física y virtual continua',                              mediaSrc: '/assets/ciberS/ciberS4.png' },
    { id: 5, titulo: 'ISO 27001',                    descripcion: 'Certificación y cumplimiento normativo de seguridad',               mediaSrc: '/assets/ciberS/ciberS5.png' },
    { id: 6, titulo: 'Ciberseguridad Avanzada',      descripcion: 'Supervisión 24/7 con estándares de seguridad avanzada',            mediaSrc: '/assets/ciberS/ciberS6.png' },
  ];

  const imgH = isMobile ? '180px' : '260px';
  const minCard = isMobile ? '150px' : '180px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: isMobile ? '16px' : '0' }}>
      <div>
        <h2 style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 'bold', color: colores.textoClaro, marginBottom: '6px' }}>
          CiberSeguridad
        </h2>
        <p style={{ color: colores.textoMedio, fontSize: isMobile ? '14px' : '16px', margin: 0 }}>
          Protección integral y monitoreo continuo
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
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease', transform: isHovered ? 'scale(1.07)' : 'scale(1)', filter: isHovered ? 'brightness(1.1)' : 'brightness(1)' }}
                  onError={(e) => {
                    const t = e.target as HTMLImageElement;
                    t.style.display = 'none';
                    const c = t.parentElement;
                    if (c) c.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:${colores.textoMedio};background:${colores.fondoTerciario}"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>`;
                  }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(3,140,174,0.95) 0%, rgba(3,140,174,0.7) 40%, transparent 100%)', display: 'flex', alignItems: 'flex-end', padding: '14px', opacity: isHovered ? 1 : 0, transition: 'opacity 0.3s ease' }}>
                  <p style={{ color: '#fff', fontSize: '11px', margin: 0, lineHeight: '1.4', fontWeight: '600' }}>{card.descripcion}</p>
                </div>
              </div>
              <div style={{ padding: '12px', backgroundColor: isHovered ? colores.fondoTerciario : 'transparent', transition: 'background-color 0.3s ease', minHeight: '50px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: '600', color: isHovered ? colores.primario : colores.textoClaro, margin: 0, lineHeight: '1.3', transition: 'color 0.3s ease' }}>
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