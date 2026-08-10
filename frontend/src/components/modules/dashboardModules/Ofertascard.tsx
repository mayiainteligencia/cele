import React from 'react';
import { Tag, Calendar, TrendingUp, Sparkles } from 'lucide-react';
import { brandingConfig } from '../../../config/branding';

interface Oferta {
  id: string;
  descuento: string;
  titulo: string;
  descripcion: string;
  vigencia: string;
  color: string;
}

export const OfertasCard: React.FC = () => {
  const { colores } = brandingConfig;

  const ofertas: Oferta[] = [
    {
      id: '1',
      descuento: '20%',
      titulo: 'Cursos de Ciberseguridad',
      descripcion: 'Esta semana únicamente',
      vigencia: 'Vence: 31 Enero',
      color: colores.peligro,
    },
    {
      id: '2',
      descuento: '35%',
      titulo: 'Pack Liderazgo Empresarial',
      descripcion: 'Incluye 5 cursos premium',
      vigencia: 'Vence: 15 Febrero',
      color: colores.primario,
    },
    {
      id: '3',
      descuento: '15%',
      titulo: 'Certificación IA Generativa',
      descripcion: 'Cupos limitados',
      vigencia: 'Vence: 28 Enero',
      color: colores.advertencia,
    },
  ];

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${colores.fondoSecundario}dd 0%, ${colores.fondoTerciario}dd 100%)`,
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        padding: '24px',
        border: `1px solid ${colores.borde}40`,
        height: '100%',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: `${colores.acento}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Tag size={20} color={colores.acento} />
        </div>
        <div>
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: colores.textoClaro,
              margin: 0,
            }}
          >
            Ofertas Especiales
          </h3>
          <p
            style={{
              fontSize: '12px',
              color: colores.textoMedio,
              margin: '2px 0 0 0',
            }}
          >
            Aprovecha descuentos exclusivos
          </p>
        </div>
      </div>

      {/* Lista de ofertas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {ofertas.map((oferta, index) => (
          <div
            key={oferta.id}
            style={{
              background: `linear-gradient(135deg, ${oferta.color}15 0%, ${oferta.color}05 100%)`,
              borderLeft: `4px solid ${oferta.color}`,
              borderRadius: '12px',
              padding: '16px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(4px)';
              e.currentTarget.style.boxShadow = `0 8px 20px ${oferta.color}30`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Efecto brillante */}
            <div
              style={{
                position: 'absolute',
                top: '-50%',
                right: '-10%',
                width: '100px',
                height: '200%',
                background: `linear-gradient(45deg, transparent, ${oferta.color}30, transparent)`,
                transform: 'rotate(45deg)',
                animation: index === 0 ? 'shine 3s infinite' : 'none',
              }}
            />

            {/* Badge de descuento */}
            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: oferta.color,
                color: 'white',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '700',
                boxShadow: `0 4px 12px ${oferta.color}40`,
              }}
            >
              -{oferta.descuento}
            </div>

            {/* Contenido */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h4
                style={{
                  fontSize: '15px',
                  fontWeight: '700',
                  color: colores.textoClaro,
                  margin: '0 0 6px 0',
                  paddingRight: '60px',
                }}
              >
                {oferta.titulo}
              </h4>
              <p
                style={{
                  fontSize: '13px',
                  color: colores.textoMedio,
                  margin: '0 0 10px 0',
                }}
              >
                {oferta.descripcion}
              </p>

              {/* Vigencia */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: colores.textoOscuro,
                }}
              >
                <Calendar size={14} />
                {oferta.vigencia}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        style={{
          width: '100%',
          marginTop: '16px',
          padding: '12px',
          borderRadius: '12px',
          border: `1px solid ${colores.acento}`,
          background: `${colores.acento}10`,
          color: colores.acento,
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = colores.acento;
          e.currentTarget.style.color = 'white';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = `${colores.acento}10`;
          e.currentTarget.style.color = colores.acento;
        }}
      >
        <Sparkles size={16} />
        Ver todas las ofertas
      </button>

      <style>
        {`
          @keyframes shine {
            0% { transform: translateX(-100%) rotate(45deg); }
            100% { transform: translateX(300%) rotate(45deg); }
          }
        `}
      </style>
    </div>
  );
};