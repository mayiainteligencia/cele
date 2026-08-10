import React from 'react';
import { brandingConfig } from '../../../config/branding';

export const WelcomeHeader: React.FC = () => {
  const { empresa, colores } = brandingConfig;

  return (
    <div style={{ marginBottom: '32px' }}>
      <h1 style={{
        fontSize: '48px', fontWeight: '300',
        color: colores.textoClaro, marginBottom: '8px', letterSpacing: '-0.5px',
      }}>
        Bienvenido a <span style={{ fontWeight: '700' }}>{empresa.nombre}</span>
        <span style={{ fontWeight: '300', fontSize: '28px', color: colores.textoOscuro, marginLeft: '12px' }}>
          {empresa.eslogan}
        </span>
      </h1>
      <p style={{
        fontSize: '20px', fontWeight: '300',
        color: colores.textoMedio, margin: 0, letterSpacing: '-0.5px',
      }}>
        ¿Qué vamos a monitorear hoy?
      </p>
    </div>
  );
};