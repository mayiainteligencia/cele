import React from 'react';
import { GraduationCap, Clock, Award, ChevronRight } from 'lucide-react';
import { brandingConfig } from '../../../config/branding';

interface Curso {
  id: number;
  titulo: string;
  descripcion: string;
  duracion: string;
  nivel: string;
  mediaSrc: string;
}

export const TopCoursesCard: React.FC = () => {
  const { colores } = brandingConfig;

  const cursosDestacados: Curso[] = [
    {
      id: 1,
      titulo: 'Fundamentos del Prompting',
      descripcion: 'Aprende ingeniería de prompts efectivos',
      duracion: '4 HORAS',
      nivel: 'PRINCIPIANTE',
      mediaSrc: '/assets/academia/curso1.png',
    },
    {
      id: 5,
      titulo: 'IA para Gerentes',
      descripcion: 'Acelera adopción de IA: fundamentos, ROI',
      duracion: '30 HORAS',
      nivel: 'AVANZADO',
      mediaSrc: '/assets/academia/curso5.png',
    },
    {
      id: 10,
      titulo: 'Programación Asistida por IA',
      descripcion: 'Código y optimización con agentes IA',
      duracion: '20 HORAS',
      nivel: 'INTERMEDIO',
      mediaSrc: '/assets/academia/curso10.png',
    },
  ];

  const getNivelColor = (nivel: string) => {
    switch (nivel) {
      case 'PRINCIPIANTE':
        return colores.exito;
      case 'INTERMEDIO':
        return colores.advertencia;
      case 'AVANZADO':
        return colores.acento;
      default:
        return colores.primario;
    }
  };

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${colores.fondoSecundario}dd 0%, ${colores.fondoTerciario}dd 100%)`,
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        padding: '24px',
        border: `1px solid ${colores.borde}40`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: `linear-gradient(135deg, ${colores.primario}20 0%, ${colores.secundario}20 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <GraduationCap size={20} color={colores.primario} />
        </div>
        <div>
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: colores.textoClaro,
              margin: 0,
            }}
          >
            Academia MAYIA
          </h3>
          <p
            style={{
              fontSize: '12px',
              color: colores.textoMedio,
              margin: 0,
            }}
          >
            Cursos más populares
          </p>
        </div>
      </div>

      {/* Lista de cursos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {cursosDestacados.map((curso) => (
          <div
            key={curso.id}
            style={{
              background: colores.fondoTerciario,
              borderRadius: '12px',
              padding: '14px',
              border: `1px solid ${colores.borde}30`,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(4px)';
              e.currentTarget.style.borderColor = `${colores.primario}60`;
              e.currentTarget.style.background = `${colores.fondoTerciario}dd`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.borderColor = `${colores.borde}30`;
              e.currentTarget.style.background = colores.fondoTerciario;
            }}
          >
            {/* Miniatura */}
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '8px',
                background: `linear-gradient(135deg, ${colores.primario}10 0%, ${colores.secundario}10 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Award size={24} color={colores.primario} />
            </div>

            {/* Info del curso */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4
                style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: colores.textoClaro,
                  margin: '0 0 4px 0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {curso.titulo}
              </h4>
              <p
                style={{
                  fontSize: '11px',
                  color: colores.textoMedio,
                  margin: '0 0 6px 0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {curso.descripcion}
              </p>

              {/* Badges */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: `${getNivelColor(curso.nivel)}20`,
                    color: getNivelColor(curso.nivel),
                    fontWeight: '600',
                  }}
                >
                  {curso.nivel}
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Clock size={10} color={colores.textoMedio} />
                  <span
                    style={{
                      fontSize: '10px',
                      color: colores.textoMedio,
                    }}
                  >
                    {curso.duracion}
                  </span>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <ChevronRight size={16} color={colores.textoMedio} />
          </div>
        ))}
      </div>

      {/* Ver todos button */}
      <button
        style={{
          width: '100%',
          marginTop: '16px',
          padding: '12px',
          borderRadius: '12px',
          border: `1px solid ${colores.primario}40`,
          background: `${colores.primario}10`,
          color: colores.primario,
          fontSize: '13px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `${colores.primario}20`;
          e.currentTarget.style.borderColor = `${colores.primario}60`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = `${colores.primario}10`;
          e.currentTarget.style.borderColor = `${colores.primario}40`;
        }}
      >
        Ver todos los cursos
      </button>
    </div>
  );
};