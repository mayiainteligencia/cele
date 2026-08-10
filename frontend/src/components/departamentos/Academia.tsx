import React, { useState, useEffect } from 'react';
import { brandingConfig } from '../../config/branding';

export const Academia: React.FC = () => {
  const { colores } = brandingConfig;
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const cursosNegocios = [
    { id: 1,  titulo: 'Fundamentos del Prompting',         descripcion: 'Aprende ingeniería de prompts efectivos y casos de uso técnico',   duracion: '4 HORAS',  nivel: 'PRINCIPIANTE', mediaSrc: '/assets/academia/curso1.png'  },
    { id: 2,  titulo: 'IA para Trabajo Inteligente',       descripcion: 'Integra IA en procesos de trabajo, automatización y gestión',       duracion: '25 HORAS', nivel: 'INTERMEDIO',   mediaSrc: '/assets/academia/curso2.png'  },
    { id: 3,  titulo: 'Comunicación Efectiva en Equipo',   descripcion: 'Fortalece comunicación en reuniones y transmisión de información',  duracion: '10 HORAS', nivel: 'INTERMEDIO',   mediaSrc: '/assets/academia/curso3.png'  },
    { id: 4,  titulo: 'Priorización y Delegación',         descripcion: 'Estrategias para priorizar y delegar efectivamente',               duracion: '10 HORAS', nivel: 'INTERMEDIO',   mediaSrc: '/assets/academia/curso4.png'  },
    { id: 5,  titulo: 'IA para Gerentes',                  descripcion: 'Acelera adopción de IA: fundamentos, ROI y gobernanza',            duracion: '30 HORAS', nivel: 'AVANZADO',     mediaSrc: '/assets/academia/curso5.png'  },
    { id: 6,  titulo: 'Gestión del Cambio',                descripcion: 'Reduce resistencia y fomenta innovación en procesos',              duracion: '15 HORAS', nivel: 'AVANZADO',     mediaSrc: '/assets/academia/curso6.png'  },
    { id: 7,  titulo: 'Toma de Decisiones Estratégicas',   descripcion: 'Decisiones basadas en datos alineadas al negocio',                duracion: '6 HORAS',  nivel: 'AVANZADO',     mediaSrc: '/assets/academia/curso7.png'  },
    { id: 8,  titulo: 'Optimización de Procesos',          descripcion: 'Mejora desempeño y eficiencia de equipos',                        duracion: '12 HORAS', nivel: 'AVANZADO',     mediaSrc: '/assets/academia/curso8.png'  },
    { id: 9,  titulo: 'Desarrollo de Talento Humano',      descripcion: 'Gestión de talento, cultura y contratación',                      duracion: '15 HORAS', nivel: 'AVANZADO',     mediaSrc: '/assets/academia/curso9.png'  },
  ];

  const cursosTech = [
    { id: 10, titulo: 'Programación Asistida por IA',      descripcion: 'Código, pruebas y optimización con agentes de IA',               duracion: '20 HORAS', nivel: 'INTERMEDIO',   mediaSrc: '/assets/academia/curso10.png' },
    { id: 11, titulo: 'Django REST Framework',             descripcion: 'Diseña APIs robustas con autenticación',                          duracion: '40 HORAS', nivel: 'AVANZADO',     mediaSrc: '/assets/academia/curso11.png' },
    { id: 12, titulo: 'Python Fundamentos',                descripcion: 'Sintaxis, bucles, funciones y proyectos reales',                  duracion: '30 HORAS', nivel: 'PRINCIPIANTE', mediaSrc: '/assets/academia/curso12.png' },
    { id: 13, titulo: 'Django Web Development',            descripcion: 'Aplicaciones dinámicas y lógica de negocios',                     duracion: '20 HORAS', nivel: 'INTERMEDIO',   mediaSrc: '/assets/academia/curso13.png' },
    { id: 14, titulo: 'Docker para Python',                descripcion: 'Contenerización y orquestación con Docker',                       duracion: '10 HORAS', nivel: 'INTERMEDIO',   mediaSrc: '/assets/academia/curso14.png' },
    { id: 15, titulo: 'Fundamentos de LLMs',               descripcion: 'Prompting, RAG y LLMs de código abierto',                        duracion: '30 HORAS', nivel: 'AVANZADO',     mediaSrc: '/assets/academia/curso15.png' },
    { id: 16, titulo: 'Flask Web Apps',                    descripcion: 'Framework Flask y construcción de API REST',                      duracion: '16 HORAS', nivel: 'INTERMEDIO',   mediaSrc: '/assets/academia/curso16.png' },
    { id: 17, titulo: 'SQL Básico',                        descripcion: 'Gestión de bases de datos y consultas',                           duracion: '30 HORAS', nivel: 'PRINCIPIANTE', mediaSrc: '/assets/academia/curso17.png' },
    { id: 18, titulo: 'SQL Avanzado',                      descripcion: 'Análisis complejo y métricas de negocio',                         duracion: '30 HORAS', nivel: 'AVANZADO',     mediaSrc: '/assets/academia/curso18.png' },
    { id: 19, titulo: 'Machine Learning Fundamentos',      descripcion: 'Modelos predictivos con Scikit-learn',                            duracion: '40 HORAS', nivel: 'INTERMEDIO',   mediaSrc: '/assets/academia/curso19.png' },
    { id: 20, titulo: 'Computer Vision',                   descripcion: 'Clasificación de imágenes con redes neuronales',                  duracion: '40 HORAS', nivel: 'AVANZADO',     mediaSrc: '/assets/academia/curso20.png' },
    { id: 21, titulo: 'Tableau Visualización',             descripcion: 'Dashboards e informes interactivos',                              duracion: '25 HORAS', nivel: 'INTERMEDIO',   mediaSrc: '/assets/academia/curso21.png' },
    { id: 22, titulo: 'Data Wrangling',                    descripcion: 'Limpieza y transformación de datos',                              duracion: '25 HORAS', nivel: 'INTERMEDIO',   mediaSrc: '/assets/academia/curso22.png' },
    { id: 23, titulo: 'Álgebra Lineal',                    descripcion: 'Fundamentos para ciencia de datos',                               duracion: '40 HORAS', nivel: 'AVANZADO',     mediaSrc: '/assets/academia/curso23.png' },
    { id: 24, titulo: 'ML para Textos',                    descripcion: 'Análisis de sentimientos y BERT',                                 duracion: '40 HORAS', nivel: 'AVANZADO',     mediaSrc: '/assets/academia/curso24.png' },
    { id: 25, titulo: 'ML para Negocios',                  descripcion: 'Casos de uso empresariales con ML',                               duracion: '20 HORAS', nivel: 'INTERMEDIO',   mediaSrc: '/assets/academia/curso25.png' },
    { id: 26, titulo: 'Deep Learning',                     descripcion: 'Redes neuronales y arquitecturas avanzadas',                      duracion: '40 HORAS', nivel: 'AVANZADO',     mediaSrc: '/assets/academia/curso26.png' },
    { id: 27, titulo: 'Habilidades Blandas',               descripcion: 'Pensamiento crítico y comunicación',                              duracion: '2.5 HORAS',nivel: 'PRINCIPIANTE', mediaSrc: '/assets/academia/curso27.png' },
    { id: 28, titulo: 'Análisis Estadístico',              descripcion: 'Métodos estadísticos y prueba de hipótesis',                      duracion: '40 HORAS', nivel: 'INTERMEDIO',   mediaSrc: '/assets/academia/curso28.png' },
    { id: 29, titulo: 'Aprendizaje Supervisado',           descripcion: 'Optimización de hiperparámetros y métricas',                      duracion: '40 HORAS', nivel: 'AVANZADO',     mediaSrc: '/assets/academia/curso29.png' },
    { id: 30, titulo: 'Python para Análisis',              descripcion: 'Variables, bucles, Pandas y preprocesamiento',                    duracion: '32 HORAS', nivel: 'PRINCIPIANTE', mediaSrc: '/assets/academia/curso30.png' },
    { id: 31, titulo: 'Series Temporales',                 descripcion: 'Tendencias, estacionalidad y pronósticos',                        duracion: '30 HORAS', nivel: 'AVANZADO',     mediaSrc: '/assets/academia/curso31.png' },
    { id: 32, titulo: 'Aprendizaje No Supervisado',        descripcion: 'K-means y detección de anomalías',                                duracion: '30 HORAS', nivel: 'AVANZADO',     mediaSrc: '/assets/academia/curso32.png' },
  ];

  const todosCursos = [...cursosNegocios, ...cursosTech];

  const getNivelColor = (nivel: string) => {
    switch(nivel) {
      case 'PRINCIPIANTE': return '#10B981';
      case 'INTERMEDIO':   return '#F59E0B';
      case 'AVANZADO':     return '#EF4444';
      default:             return colores.primario;
    }
  };

  const imgH = isMobile ? '160px' : '220px';
  const minCard = isMobile ? '140px' : '170px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: isMobile ? '16px' : '0' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 'bold', color: colores.textoClaro, marginBottom: '6px' }}>
          Academia Mayia
        </h2>
        <p style={{ color: colores.textoMedio, fontSize: isMobile ? '14px' : '16px', margin: 0 }}>
          {todosCursos.length} cursos de IA para empresas y equipos técnicos
        </p>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minCard}, 1fr))`,
        gap: isMobile ? '12px' : '20px',
      }}>
        {todosCursos.map((card) => {
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
              {/* Imagen */}
              <div style={{ width: '100%', height: imgH, position: 'relative', backgroundColor: colores.fondoTerciario, overflow: 'hidden' }}>
                <img
                  src={card.mediaSrc}
                  alt={card.titulo}
                  style={{
                    width: '100%', height: '100%', objectFit: 'cover',
                    transition: 'transform 0.3s ease, filter 0.3s ease',
                    transform: isHovered ? 'scale(1.07)' : 'scale(1)',
                    filter: isHovered ? 'brightness(1.1)' : 'brightness(1)',
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const container = target.parentElement;
                    if (container) {
                      container.innerHTML = `
                        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:${colores.textoMedio};background:${colores.fondoTerciario};gap:8px">
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                          <p style="margin:0;font-size:10px;font-weight:600">${card.nivel}</p>
                        </div>`;
                    }
                  }}
                />
                {/* Badges */}
                <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ padding: '3px 7px', borderRadius: '6px', backgroundColor: getNivelColor(card.nivel), color: '#fff', fontSize: '8px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                    {card.nivel}
                  </span>
                  <span style={{ padding: '3px 7px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '8px', fontWeight: 'bold' }}>
                    {card.duracion}
                  </span>
                </div>
                {/* Overlay hover */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(3,140,174,0.95) 0%, rgba(3,140,174,0.7) 40%, transparent 100%)', display: 'flex', alignItems: 'flex-end', padding: '12px', opacity: isHovered ? 1 : 0, transition: 'opacity 0.3s ease' }}>
                  <p style={{ color: '#fff', fontSize: '10px', margin: 0, lineHeight: '1.4', fontWeight: '600' }}>{card.descripcion}</p>
                </div>
              </div>

              {/* Título */}
              <div style={{ padding: '10px 12px', backgroundColor: isHovered ? colores.fondoTerciario : 'transparent', transition: 'background-color 0.3s ease', minHeight: '46px' }}>
                <h4 style={{ fontSize: '11px', fontWeight: '600', color: isHovered ? colores.primario : colores.textoClaro, margin: 0, lineHeight: '1.3', transition: 'color 0.3s ease' }}>
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