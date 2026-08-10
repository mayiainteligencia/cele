import React from 'react';
import { MapPin, ArrowRight, ClipboardList, Bell, Radio, Users, School, MapPinned, Building2 } from 'lucide-react';
import {
  ESTADO, municipios, escuelasResumen, localidadesResumen, fmt,
} from '../data/campeche';

interface InicioProps {
  onSectionChange: (section: string) => void;
}

/** Portada. Usa las mismas clases del diseño web (hero, stats-card,
 *  service-card) sobre el video de fondo que pinta App. */
export const Inicio: React.FC<InicioProps> = ({ onSectionChange }) => {
  const acceso = (id: string, Icon: typeof ClipboardList, label: string) => (
    <button className="action-btn" onClick={() => onSectionChange(id)} type="button">
      <span className="action-btn__circle"><Icon size={16} /></span>
      <span>{label}</span>
    </button>
  );

  return (
    <>
      {/* ── Hero ── */}
      <section className="hero" id="hero-section">
        <div className="hero__content">
          <h1 className="text-hero animate-fade-in-up">Bienvenido a Cerebro Electoral</h1>
          <p className="hero__description text-body animate-fade-in-up delay-1">
            Inteligencia electoral de {ESTADO.nombre} sobre datos públicos, verificables y
            georreferenciados. Territorio, resultados, medios y riesgos en un solo tablero.
          </p>
        </div>
      </section>

      {/* ── Card de cobertura ── */}
      <section className="stats-card glass-strong animate-fade-in-up delay-2" aria-label="Cobertura del estado">
        <h2 className="text-h2">Del Dato al Territorio</h2>
        <p className="text-small stats-card__desc">
          Padrón de planteles, localidades y municipios cartografiado sobre el mapa del estado.
          Cada cifra trae su fuente y su fecha de corte.
        </p>
        <div className="stats-card__bottom">
          <div className="stats-card__metric">
            <span className="text-stat">{ESTADO.municipios}</span>
            <span className="text-label">Municipios</span>
          </div>
          <div className="stats-card__avatars" aria-hidden="true">
            {municipios.items.slice(0, 4).map((m) => (
              <div className="avatar avatar--xs" key={m.clave_municipio}>
                {m.nombre.slice(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
          <button
            className="btn-circle btn-circle--glass"
            onClick={() => onSectionChange('mapa')}
            aria-label="Ver el mapa maestro"
            type="button"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* ── Card del estado ── */}
      <section className="service-card glass-strong animate-fade-in-right delay-3" aria-label="Estado destacado">
        <div className="service-card__header">
          <div>
            <h2 className="text-h2">{ESTADO.nombre}</h2>
            <p className="service-card__location text-small">
              <MapPin size={13} className="icon-xs" />
              Entidad {ESTADO.clave_entidad} · {ESTADO.municipios} municipios
            </p>
          </div>
          <button
            className="btn-circle btn-circle--glass"
            onClick={() => onSectionChange('mapa')}
            aria-label="Abrir el mapa maestro"
            type="button"
          >
            <ArrowRight size={18} />
          </button>
        </div>

        <p className="service-card__description text-body truncate-2">
          Padrón de planteles del SIGED cartografiado sobre el estado, con localidades,
          predios y cobertura por municipio.
        </p>

        <div className="service-card__specs">
          <div className="spec">
            <Users size={16} />
            <span className="spec__value">{fmt(ESTADO.poblacion2020)}</span>
            <span className="spec__label">habitantes</span>
          </div>
          <div className="spec">
            <School size={16} />
            <span className="spec__value">{fmt(escuelasResumen.resumen.planteles)}</span>
            <span className="spec__label">planteles</span>
          </div>
          <div className="spec">
            <MapPinned size={16} />
            <span className="spec__value">{fmt(escuelasResumen.resumen.sitios)}</span>
            <span className="spec__label">predios</span>
          </div>
          <div className="spec">
            <Building2 size={16} />
            <span className="spec__value">{fmt(localidadesResumen.resumen.total)}</span>
            <span className="spec__label">localidades</span>
          </div>
        </div>

        <div className="service-card__actions">
          {acceso('resultados', ClipboardList, 'Resultados')}
          {acceso('alertas', Bell, 'Alertas')}
          {acceso('monitor', Radio, 'Medios')}
        </div>
      </section>

      <div className="dc-logo" aria-label="Cerebro Electoral"><span>CE</span></div>
    </>
  );
};
