import React, { useState } from 'react';
import { ArrowUpRight, Sparkles, ArrowRight, LogIn } from 'lucide-react';
import { menuItems } from '../config/menu';

interface WebHeaderProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export const WebHeader: React.FC<WebHeaderProps> = ({ activeSection, onSectionChange }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSectionChange('dashboard');
  };

  const activeItem = menuItems.find(m => m.id === activeSection);

  return (
    <header className="filter-bar filter-bar--notch" id="filter-bar">
      {/* Pieza izquierda — sección activa */}
      <button
        className="topbar-side"
        onClick={() => onSectionChange('dashboard')}
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderRadius: '999px',
          backgroundColor: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(28px) saturate(160%)',
          border: '1px solid rgba(255,255,255,0.25)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          color: 'var(--text-primary, #0f172a)',
          fontWeight: 600,
          fontSize: '14px',
          transition: 'all 0.2s',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <ArrowUpRight size={16} style={{ marginRight: '6px' }} />
        </span>
        <span>{activeItem?.nombre ?? 'Dashboard'}</span>
      </button>

      {/* Notch central: buscador */}
      <div className="topbar-notch">
        <form
          className="brief-input"
          id="brief-form"
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(28px) saturate(160%)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '999px',
            padding: '8px 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }}
        >
          <Sparkles size={16} style={{ color: 'var(--accent-primary, #3b82f6)', flexShrink: 0 }} />
          <input
            type="text"
            id="brief-text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pregúntale a MAYIA: participación, municipios, escuelas…"
            aria-label="Qué quieres consultar"
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '13px',
              color: 'var(--text-primary, #0f172a)',
              width: '320px',
              fontFamily: 'inherit',
            }}
          />
        </form>

        <button
          className="filter-pill filter-pill--cta"
          id="btn-brief-go"
          type="submit"
          form="brief-form"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '999px',
            background: 'var(--accent-primary, #3b82f6)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '13px',
            boxShadow: '0 4px 16px rgba(59,130,246,0.4)',
            transition: 'all 0.2s',
          }}
        >
          <span>Buscar</span>
          <ArrowRight size={15} />
        </button>
      </div>

      {/* Derecha — Auth pill */}
      <div id="auth-slot">
        <button
          className="filter-pill filter-pill--cta"
          id="pill-login"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '999px',
            backgroundColor: 'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(28px) saturate(160%)',
            border: '1px solid rgba(255,255,255,0.25)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            color: 'var(--text-primary, #0f172a)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <span>Entrar / Registrarme</span>
          <LogIn size={15} />
        </button>
      </div>
    </header>
  );
};
