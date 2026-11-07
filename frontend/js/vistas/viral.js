/* Viral Intelligence Engine — Fase 2 (prototipo funcional).
   Todo se calcula en el navegador con DATOS SINTÉTICOS (semilla fija, reproducible).
   No se conecta a WhatsApp/SMS/correo/redes y no envía nada. Cada cifra sale de una regla
   visible en este archivo; ninguna es resultado real de campaña. */
(function () {
  'use strict';
  const root = document.getElementById('viral-engine');
  if (!root) return;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Math.round(n).toLocaleString('es-MX');
  const pc = (v, d = 1) => `${(v * 100).toFixed(d)} %`;
  const tok = (n, f) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f;
  const $ = (s, el = root) => el.querySelector(s);
  const $$ = (s, el = root) => [...el.querySelectorAll(s)];

  function rngSeed(seed) {            // mulberry32
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const normal = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

  /* ═════════ 01 · Customer Data Intelligence (sintético, sin nombres: minimización) ═════════ */
  const ZONAS = ['Centro', 'Norte', 'Sur', 'Oriente', 'Poniente'];
  const INTERESES = ['Rally', 'Fórmula 1', 'Drag', 'Resistencia', 'Sin declarar'];
  const normTel = (t) => { let d = String(t).replace(/\D/g, ''); if (d.length === 12 && d.startsWith('52')) d = d.slice(2); return d.length === 10 ? d : null; };
  const normMail = (m) => { const x = String(m).trim().toLowerCase(); return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(x) ? x : null; };

  function genAudiencia() {
    const r = rngSeed(2026);
    const raw = [];
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const tel = `99${Math.floor(r() * 1e8).toString().padStart(8, '0')}`;
      const f = r();
      raw.push({
        id: `R-${String(i).padStart(4, '0')}`,
        tel: f < 0.04 ? tel.slice(0, 8) : f < 0.35 ? `+52 ${tel.slice(0, 3)}-${tel.slice(3, 6)}-${tel.slice(6)}` : tel,
        mail: r() < 0.05 ? `x${i}[at]mail` : `u${i}@correo.mx`,
        zona: ZONAS[Math.floor(r() * ZONAS.length)],
        interes: INTERESES[Math.floor(Math.pow(r(), 1.4) * INTERESES.length)],
        wa: r() < 0.62, sms: r() < 0.25, mail_ok: r() < 0.48, baja: r() < 0.03,
        fuente: r() < 0.7 ? 'Estación de servicio (formulario)' : r() < 0.6 ? 'Programa de recomendación' : 'Canal digital oficial',
      });
    }
    for (let i = 0; i < 64; i++) {      // duplicados con otro formato
      const o = raw[Math.floor(r() * N)];
      raw.push({ ...o, id: `R-${String(raw.length).padStart(4, '0')}`, tel: o.tel.length === 10 ? `${o.tel.slice(0, 2)} ${o.tel.slice(2)}` : o.tel });
    }
    const vistos = new Map(); let dup = 0, telMal = 0, mailMal = 0;
    raw.forEach((x) => {
      const t = normTel(x.tel), m = normMail(x.mail);
      if (!t) telMal++;
      if (!m) mailMal++;
      const k = t || m || x.id;
      if (vistos.has(k)) { dup++; return; }
      vistos.set(k, { ...x, t, m });
    });
    const unicos = [...vistos.values()];
    const habil = (u) => !u.baja && ((u.wa && u.t) || (u.sms && u.t) || (u.mail_ok && u.m));
    const elegibles = unicos.filter(habil);
    const grupo = (campo, vals) => vals.map((v) => ({ v, n: elegibles.filter((u) => u[campo] === v).length }));
    return {
      brutos: raw.length, dup, telMal, mailMal, unicos: unicos.length, bajas: unicos.filter((u) => u.baja).length,
      elegibles: elegibles.length,
      canal: { wa: elegibles.filter((u) => u.wa && u.t).length, sms: elegibles.filter((u) => u.sms && u.t).length, mail: elegibles.filter((u) => u.mail_ok && u.m).length },
      zonas: grupo('zona', ZONAS), intereses: grupo('interes', INTERESES),
      muestra: unicos.slice(0, 6),
    };
  }

  /* ═════════ 02 · Referral graph (cascada sintética + analítica real sobre ese grafo) ═════════ */
  function genCascada() {
    const r = rngSeed(77);
    const nodos = []; const SEMILLAS = 14, TOPE = 210;
    for (let i = 0; i < SEMILLAS; i++) nodos.push({ id: i, padre: -1, gen: 0, t: r() * 24 });
    let frente = [...nodos];
    while (frente.length && nodos.length < TOPE) {
      const sig = [];
      frente.forEach((p) => {
        const inv = Math.floor(-Math.log(1 - r()) * 4.5);
        const conv = 0.38 * Math.pow(0.82, p.gen);
        for (let k = 0; k < inv; k++) if (r() < conv && nodos.length < TOPE) {
          const n = { id: nodos.length, padre: p.id, gen: p.gen + 1, t: p.t + 2 + r() * 70 };
          nodos.push(n); sig.push(n);
        }
      });
      frente = sig;
    }
    const base = nodos[20];                 // actividad atípica inyectada para probar la regla antifraude
    for (let k = 0; k < 8; k++) nodos.push({ id: nodos.length, padre: base.id, gen: base.gen + 1, t: base.t + 5 + k * 0.012 });
    nodos.forEach((n) => { n.hijos = 0; n.com = n.id; });
    nodos.forEach((n) => { if (n.padre >= 0) nodos[n.padre].hijos++; });
    nodos.forEach((n) => { let a = n; while (a.padre >= 0) a = nodos[a.padre]; n.com = a.id; });
    const ady = nodos.map(() => []);
    nodos.forEach((n) => { if (n.padre >= 0) { ady[n.id].push(n.padre); ady[n.padre].push(n.id); } });
    // intermediación (Brandes, no dirigido)
    const bc = nodos.map(() => 0);
    for (let s = 0; s < nodos.length; s++) {
      const S = [], P = nodos.map(() => []), sg = nodos.map(() => 0), d = nodos.map(() => -1);
      sg[s] = 1; d[s] = 0; const Q = [s];
      while (Q.length) { const v = Q.shift(); S.push(v); ady[v].forEach((w) => { if (d[w] < 0) { d[w] = d[v] + 1; Q.push(w); } if (d[w] === d[v] + 1) { sg[w] += sg[v]; P[w].push(v); } }); }
      const de = nodos.map(() => 0);
      while (S.length) { const w = S.pop(); P[w].forEach((v) => { de[v] += (sg[v] / sg[w]) * (1 + de[w]); }); if (w !== s) bc[w] += de[w]; }
    }
    nodos.forEach((n, i) => { n.bc = bc[i] / 2; n.grado = ady[i].length; });
    // antifraude: ≥6 altas de un mismo código en una ventana < 10 min (regla explícita y editable)
    nodos.forEach((n) => {
      const ts = nodos.filter((x) => x.padre === n.id).map((x) => x.t).sort((a, b) => a - b);
      n.sospechoso = ts.some((_, i) => i + 5 < ts.length && ts[i + 5] - ts[i] < 10 / 60);
    });
    // layout radial por sectores: cada rama de cascada ocupa un abanico proporcional a su tamaño (sin simulación, sin deformarse)
    const pmax = Math.max(...nodos.map((n) => n.gen));
    const hojas = nodos.map(() => 0);
    for (let i = nodos.length - 1; i >= 0; i--) { if (!nodos[i].hijos) hojas[i] = 1; if (nodos[i].padre >= 0) hojas[nodos[i].padre] += hojas[i]; }
    const kids = nodos.map(() => []);
    nodos.forEach((n) => { if (n.padre >= 0) kids[n.padre].push(n.id); });
    const colocar = (id, a0, a1) => {
      const n = nodos[id]; const ang = (a0 + a1) / 2; const rad = 0.14 + 0.86 * (n.gen / (pmax || 1));
      n.x = Math.cos(ang) * rad; n.y = Math.sin(ang) * rad;
      let cur = a0; const tot = kids[id].reduce((v, k) => v + hojas[k], 0) || 1;
      kids[id].forEach((k) => { const w = ((a1 - a0) * hojas[k]) / tot; colocar(k, cur, cur + w); cur += w; });
    };
    const semillas = nodos.filter((n) => n.padre < 0); const totH = semillas.reduce((v, n) => v + hojas[n.id], 0);
    let ang0 = -Math.PI / 2;
    semillas.forEach((n) => { const w = (2 * Math.PI * hojas[n.id]) / totH; colocar(n.id, ang0, ang0 + w); ang0 += w; });
    const prof = Math.max(...nodos.map((n) => n.gen));
    const porGen = Array.from({ length: prof + 1 }, (_, g) => nodos.filter((n) => n.gen === g).length);
    const ratios = porGen.slice(1).map((v, i) => (porGen[i] ? v / porGen[i] : 0));
    const comTam = {}; nodos.forEach((n) => { comTam[n.com] = (comTam[n.com] || 0) + 1; });
    return { nodos, prof, porGen, ratios, comTam, tMax: Math.max(...nodos.map((n) => n.t)) };
  }

  /* ═════════ 03/07 · Modelo SIR adaptado + Monte Carlo ═════════
     Ecuaciones (paso diario):
       S/N            = fracción de audiencia aún no registrada
       nuevos_oficial = N · alcance · conv_oficial · S/N
       nuevos_ref     = I · k · c · S/N
       I(t+1)         = I(t) · (1 − γ) + s · (nuevos)
       R0_invitaciones = s · k · c / γ
     Cada corrida muestrea k y c (lognormal σ=0.2), ruido normal √λ y tasa de asistencia N(μ, 0.06). */
  const P0 = { N: 3000, alcance: 15, conv: 10, k: 3, c: 12, gamma: 20, s: 40, show: 62, cap: 250, dias: 21 };
  function monteCarlo(p, runs = 400) {
    const r = rngSeed(11); const D = p.dias;
    const trayect = []; const asist = [];
    for (let q = 0; q < runs; q++) {
      const k = (p.k) * Math.exp(0.2 * normal(r)), c = (p.c / 100) * Math.exp(0.2 * normal(r));
      const show = Math.min(0.98, Math.max(0.05, p.show / 100 + 0.06 * normal(r)));
      let I = 0, cum = 0; const tr = [];
      for (let d = 0; d < D; d++) {
        const sat = Math.max(0, 1 - cum / p.N);
        const lam = p.N * (p.alcance / 1000) * (p.conv / 100) * sat + I * k * c * sat;
        const nuevos = Math.min(p.N - cum, Math.max(0, lam + Math.sqrt(lam) * normal(r)));
        cum += nuevos; I = I * (1 - p.gamma / 100) + (p.s / 100) * nuevos; tr.push(cum);
      }
      trayect.push(tr); asist.push(cum * show);
    }
    const pct = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
    const banda = Array.from({ length: D }, (_, d) => { const col = trayect.map((t) => t[d]); return [pct(col, 0.1), pct(col, 0.5), pct(col, 0.9)]; });
    return { banda, asist: [pct(asist, 0.1), pct(asist, 0.5), pct(asist, 0.9)], pSobre: asist.filter((a) => a > p.cap).length / runs, R0: (p.s / 100) * p.k * (p.c / 100) / (p.gamma / 100) };
  }

  /* ═════════ Estado y datos ═════════ */
  const AUD = genAudiencia();
  const CAS = genCascada();
  const st = { tab: 'cmd', params: { ...P0 }, T: CAS.tMax, sel: null, play: null, presupuesto: 60000, aprobados: [], cupo: 0, checkin: new Set(), cancel: new Set(), studioOut: [] };
  const registrados = [...CAS.nodos].sort((a, b) => a.t - b.t).map((n) => `QR-${String(n.id).padStart(4, '0')}`);
  st.cupo = Math.round(registrados.length * 0.8);

  const TABS = [
    ['cmd', 'layout-dashboard', '1', 'Centro de mando', 'Embudo y KPIs ejecutivos'],
    ['aud', 'database', '2', 'Audiencia y datos', 'Segmentos y consentimiento'],
    ['net', 'share-2', '3', 'Laboratorio de red viral', 'Cascada y simulación'],
    ['stu', 'sparkles', '4', 'Estudio de campaña', 'Mensajes y creativos'],
    ['ops', 'ticket-check', '5', 'Operación de eventos', 'Cupos y check-in'],
    ['gov', 'shield-check', '', 'Agentes y gobernanza', 'Modelos y controles'],
  ];

  function marco() {
    root.innerHTML = `
      <div class="vie">
        <div class="vie__tabs" role="tablist">${TABS.map(([id, ic, n, t, sub]) => `<button class="vie__tab" role="tab" data-tab="${id}" aria-selected="${st.tab === id}"><span class="vie__ico">${n || `<i data-lucide="${ic}"></i>`}</span><span class="vie__txt"><b>${t}</b><small>${sub}</small></span></button>`).join('')}</div>
        <div id="vie-body"></div>
      </div>`;
    $$('.vie__tab').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.tab; if (st.play) { cancelAnimationFrame(st.play); st.play = null; } marco(); }));
    ({ cmd: vCmd, aud: vAud, net: vNet, stu: vStu, ops: vOps, gov: vGov })[st.tab]();
    if (window.lucide) lucide.createIcons();
  }

  const kpi = (l, v, s = '') => `<div class="vie__kpi"><span>${l}</span><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`;
  const bar = (l, v, max, txt) => `<div class="vie__bar"><span>${esc(l)}</span><i><s style="width:${Math.min(100, (v / (max || 1)) * 100)}%"></s></i><em>${txt || fmt(v)}</em></div>`;

  /* ═════════ 1 · Command Center ═════════ */
  function embudo() {
    const reg = CAS.nodos.length;        // registros = nodos de la cascada
    const conf = Math.min(reg, st.cupo);
    const asis = st.checkin.size;
    const visitas = Math.round(reg / 0.31), imp = Math.round(visitas / 0.045);
    const interes = Math.round(visitas * 0.58);
    return [['Impresión', imp], ['Visita', visitas], ['Interés', interes], ['Registro', reg], ['Confirmación', conf], ['Check-in / asistencia', asis]];
  }
  function vCmd() {
    const f = embudo(); const reg = f[3][1]; const alc = AUD.canal;
    const K = CAS.ratios.length ? Math.exp(CAS.ratios.reduce((a, v) => a + Math.log(v || 0.01), 0) / CAS.ratios.length) : 0;
    const invitaciones = Math.round(reg * 3.1);
    $('#vie-body').innerHTML = `
      <div class="vie__grid">
        ${kpi('Audiencia elegible', fmt(AUD.elegibles), 'consentimiento + contacto válido')}
        ${kpi('Usuarios únicos alcanzados', fmt(f[1][1]), 'visitas únicas (sintético)')}
        ${kpi('Invitaciones generadas', fmt(invitaciones), 'regla: 3.1 por registro')}
        ${kpi('Coef. reproducción K', K.toFixed(2), 'media geométrica entre generaciones')}
        ${kpi('Profundidad de cascada', CAS.prof, 'generaciones observadas')}
        ${kpi('Registros', fmt(reg), `conv. visita→registro ${pc(reg / f[1][1], 0)}`)}
        ${kpi('Costo por registro', `$${(st.presupuesto / reg).toFixed(0)}`, 'presupuesto editable abajo')}
        ${kpi('Asistencia real', fmt(f[5][1]), `capacidad ${fmt(st.cupo)}`)}
        ${kpi('Costo por asistente', f[5][1] ? `$${(st.presupuesto / f[5][1]).toFixed(0)}` : '—', 'se calcula con check-ins')}
      </div>
      <div class="vie__cols">
        <div class="vie__card"><h4>Embudo integral</h4>
          ${f.map(([l, v], i) => bar(l, v, f[0][1], `${fmt(v)}${i ? ` · ${pc(v / (f[i - 1][1] || 1), 0)}` : ''}`)).join('')}
          <p class="vie__nota">Cada etapa tiene su propio indicador: alcance, interés, registro y asistencia no se mezclan. Los porcentajes son la conversión contra la etapa anterior.</p>
          <label class="vie__f">Presupuesto (supuesto editable, MXN)<input type="number" id="vie-pres" value="${st.presupuesto}" min="1" step="1000"></label>
        </div>
        <div class="vie__card"><h4>Alcance por canal (audiencia habilitada)</h4>
          ${bar('WhatsApp', alc.wa, AUD.elegibles)}${bar('SMS', alc.sms, AUD.elegibles)}${bar('Correo', alc.mail, AUD.elegibles)}
          <p class="vie__nota">Un contacto puede estar habilitado en varios canales. El dashboard solo muestra agregados; sin datos personales.</p>
        </div>
      </div>
      <div class="vie__card"><h4>Registros acumulados (cascada observada) vs. escenario medio simulado</h4><canvas id="vie-ts" height="220"></canvas>
        <p class="vie__nota">Línea sólida: altas por hora de la cascada sintética. Línea punteada: mediana Monte Carlo con parámetros del laboratorio, reescalada a días. Comparar escenario y realidad es el insumo para calibrar el modelo.</p></div>`;
    $('#vie-pres').addEventListener('change', (e) => { st.presupuesto = Math.max(1, +e.target.value || 1); vCmd(); });
    const cv = $('#vie-ts'); const g = prep(cv); const W = cv.clientWidth, H = 220;
    const dias = Math.ceil(CAS.tMax / 24); const ord = [...CAS.nodos].sort((a, b) => a.t - b.t);
    const mc = monteCarlo(st.params);
    const maxY = Math.max(ord.length, mc.banda[mc.banda.length - 1][1]) * 1.1;
    axes(g, W, H, maxY, dias, 'día');
    g.strokeStyle = tok('--accent-cyan', '#22e0ff'); g.lineWidth = 2; g.beginPath(); // color-ok
    ord.forEach((n, i) => { const x = 40 + (n.t / 24 / dias) * (W - 50), y = H - 24 - ((i + 1) / maxY) * (H - 40); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    g.strokeStyle = tok('--accent-warm', '#ffb020'); g.setLineDash([5, 4]); g.beginPath(); // color-ok
    mc.banda.forEach((b, d) => { const x = 40 + (d / (mc.banda.length - 1)) * (W - 50), y = H - 24 - (b[1] / maxY) * (H - 40); d ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.setLineDash([]);
  }

  /* utilidades de canvas */
  function prep(cv) { const d = window.devicePixelRatio || 1; if (!cv.dataset.h) cv.dataset.h = cv.getAttribute('height'); const w = cv.clientWidth, h = +cv.dataset.h; cv.style.height = `${h}px`; cv.width = w * d; cv.height = h * d; const g = cv.getContext('2d'); g.scale(d, d); g.clearRect(0, 0, w, h); return g; }
  function axes(g, W, H, maxY, maxX, lx) {
    g.strokeStyle = tok('--velo-10', 'rgba(255,255,255,.1)'); g.fillStyle = tok('--text-muted', '#7d889e'); g.font = '10px sans-serif'; g.lineWidth = 1; // color-ok
    for (let i = 0; i <= 4; i++) { const y = H - 24 - (i / 4) * (H - 40); g.beginPath(); g.moveTo(40, y); g.lineTo(W - 10, y); g.stroke(); g.fillText(fmt((maxY * i) / 4), 4, y + 3); }
    for (let i = 0; i <= 4; i++) g.fillText(`${lx} ${Math.round((maxX * i) / 4)}`, 40 + (i / 4) * (W - 50) - 8, H - 8);
  }

  /* ═════════ 2 · Audience & Data ═════════ */
  function vAud() {
    const A = AUD; const k = 10;   // k-anonimato mínimo de agregación
    $('#vie-body').innerHTML = `
      <div class="vie__grid">
        ${kpi('Registros importados', fmt(A.brutos), 'CSV/Excel/CRM/API (sintético)')}
        ${kpi('Duplicados fusionados', fmt(A.dup), 'por teléfono o correo normalizado')}
        ${kpi('Teléfonos inválidos', fmt(A.telMal), 'no son 10 dígitos MX')}
        ${kpi('Correos inválidos', fmt(A.mailMal), 'formato no válido')}
        ${kpi('Contactos únicos', fmt(A.unicos))}
        ${kpi('Bajas / exclusiones', fmt(A.bajas), 'excluidos de toda comunicación')}
        ${kpi('Elegibles para contacto', fmt(A.elegibles), 'consentimiento por canal + contacto válido')}
      </div>
      <div class="vie__cols">
        <div class="vie__card"><h4>Segmentos agregados por zona</h4>${A.zonas.map((z) => (z.n >= k ? bar(z.v, z.n, A.elegibles) : bar(z.v, 0, 1, '< 10 (oculto)'))).join('')}
          <p class="vie__nota">Grupos de menos de ${k} personas se ocultan para no reidentificar. Sin inferencias sobre relaciones sociales ni rasgos sensibles.</p></div>
        <div class="vie__card"><h4>Intereses automovilísticos declarados</h4>${A.intereses.map((z) => bar(z.v, z.n, A.elegibles)).join('')}
          <p class="vie__nota">Solo información proporcionada voluntariamente.</p></div>
      </div>
      <div class="vie__card"><h4>Muestra de registros normalizados (sin nombre; ID seudónimo)</h4>
        <table><tr><th>ID</th><th>Teléfono</th><th>Correo</th><th>Zona</th><th>Fuente / finalidad</th><th>WA</th><th>SMS</th><th>Correo</th></tr>
        ${A.muestra.map((u) => `<tr><td>${esc(u.id)}</td><td>${u.t ? `••••••${u.t.slice(-4)}` : '<span class="vie__pill vie__pill--bad">inválido</span>'}</td><td>${u.m ? `${esc(u.m[0])}•••@${esc(u.m.split('@')[1])}` : '<span class="vie__pill vie__pill--bad">inválido</span>'}</td><td>${esc(u.zona)}</td><td>${esc(u.fuente)}</td><td>${u.wa ? 'sí' : 'no'}</td><td>${u.sms ? 'sí' : 'no'}</td><td>${u.mail_ok ? 'sí' : 'no'}</td></tr>`).join('')}</table>
        <p class="vie__nota">Teléfono y correo se muestran enmascarados. Antes de una campaña promocional, Compliance Guardian verifica que la finalidad sea compatible con el aviso de privacidad vigente.</p></div>`;
  }

  /* ═════════ 3 · Viral Network Lab ═════════ */
  function vNet() {
    const p = st.params; const mc = monteCarlo(p);
    const sosp = CAS.nodos.filter((n) => n.sospechoso);
    const puentes = [...CAS.nodos].filter((n) => n.padre >= 0).sort((a, b) => b.bc - a.bc).slice(0, 5);
    const ctrl = (k, l, min, max, step, u) => `<label class="vie__ctrl"><span>${l}</span><output id="o-${k}">${p[k]}${u}</output><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${p[k]}"></label>`;
    $('#vie-body').innerHTML = `
      <div class="vie__cols">
        <div class="vie__card" style="grid-column:1/-1"><h4>Grafo de referidos observados (${CAS.nodos.length} participantes · seudónimos)</h4>
          <canvas id="vie-g" height="460"></canvas>
          <div class="vie__row"><button class="vie__btn" id="vie-play">▶ Reproducir cascada</button>
            <input type="range" id="vie-t" min="0" max="${Math.ceil(CAS.tMax)}" value="${Math.ceil(st.T)}" style="flex:1;accent-color:var(--accent-cyan)"><output id="vie-tt"></output></div>
          <div id="vie-insp" class="vie__nota">Toca un nodo para ver su detalle. Color = comunidad (rama de cascada desde una semilla). Aro rojo = patrón atípico. El grafo solo contiene invitaciones observadas, no relaciones personales supuestas.</div></div>
        <div class="vie__card"><h4>Métricas de red (calculadas sobre este grafo)</h4>
          <table><tr><th>Generación</th><th>Participantes</th><th>Razón vs. anterior</th></tr>
          ${CAS.porGen.map((v, g) => `<tr><td>${g}</td><td>${v}</td><td>${g ? CAS.ratios[g - 1].toFixed(2) : '—'}</td></tr>`).join('')}</table>
          <p class="vie__nota">Profundidad ${CAS.prof}. Razón < 1 indica cascada subcrítica: sin impulso externo se apaga.</p>
          <h4 style="margin-top:10px">Puentes (mayor intermediación)</h4>
          <ul>${puentes.map((n) => `<li>P-${String(n.id).padStart(4, '0')} · gen ${n.gen} · intermediación ${n.bc.toFixed(0)} · ${n.hijos} altas directas</li>`).join('')}</ul>
          <h4 style="margin-top:10px">Detección de actividad atípica</h4>
          <p>${sosp.length ? sosp.map((n) => `<span class="vie__pill vie__pill--bad">P-${String(n.id).padStart(4, '0')}</span>`).join(' ') + ` · regla: ≥ 6 altas del mismo código en menos de 10 min. Se envía a revisión humana; no se sanciona automáticamente.` : 'Sin casos.'}</p></div>
        <div class="vie__card"><h4>Simulación SIR adaptada + Monte Carlo (400 corridas)</h4>
          <div class="vie__row"><button class="vie__btn vie__btn--ghost" data-esc="baja">Respuesta baja</button><button class="vie__btn vie__btn--ghost" data-esc="media">Media</button><button class="vie__btn vie__btn--ghost" data-esc="alta">Alta</button></div>
          ${ctrl('N', 'Universo elegible', 500, 20000, 500, '')}${ctrl('alcance', 'Alcance oficial diario (‰ del universo)', 2, 40, 1, '')}
          ${ctrl('conv', 'Conversión del canal oficial', 1, 20, 1, ' %')}${ctrl('k', 'Invitaciones por difusor por día (k)', 1, 8, 0.5, '')}
          ${ctrl('c', 'Conversión de invitación (c)', 2, 30, 1, ' %')}${ctrl('gamma', 'Abandono diario de difusores (γ)', 5, 60, 1, ' %')}
          ${ctrl('s', 'Registrados que se vuelven difusores (s)', 5, 80, 5, ' %')}${ctrl('show', 'Tasa de asistencia', 30, 90, 1, ' %')}${ctrl('cap', 'Capacidad del recinto', 50, 3000, 50, '')}
        </div>
        <div class="vie__card"><h4>Proyección de registros con incertidumbre</h4><canvas id="vie-mc" height="240"></canvas>
          <p><span class="vie__pill ${mc.R0 >= 1 ? 'vie__pill--warn' : 'vie__pill--ok'}">R₀ invitaciones = ${mc.R0.toFixed(2)}</span>
          Asistencia P10 / P50 / P90: <b>${fmt(mc.asist[0])} / ${fmt(mc.asist[1])} / ${fmt(mc.asist[2])}</b> · probabilidad de superar capacidad: <b>${pc(mc.pSobre, 0)}</b></p>
          <p class="vie__nota">R₀ = s·k·c / γ. Banda = P10–P90; línea = mediana. Supuestos: población homogénea, k y c con incertidumbre lognormal (σ=0,2), ruido de Poisson aproximado, saturación lineal. Limitaciones: sin precisión histórica todavía (no hay campañas previas calibradas); no incluye comunidades superpuestas ni contagio complejo.</p></div>
      </div>`;
    GL = null; dibujaGrafo(); arranca(); dibujaMC(mc);
    $$('input[data-k]').forEach((i) => i.addEventListener('input', () => { st.params[i.dataset.k] = +i.value; const u = $(`#o-${i.dataset.k}`); u.textContent = i.value + (u.textContent.includes('%') ? ' %' : ''); }));
    $$('input[data-k]').forEach((i) => i.addEventListener('change', vNet));
    $$('[data-esc]').forEach((b) => b.addEventListener('click', () => {
      const m = { baja: 0.6, media: 1, alta: 1.5 }[b.dataset.esc]; const q = st.params;
      q.alcance = Math.round(P0.alcance * m); q.c = Math.round(P0.c * m); q.k = Math.round(P0.k * m * 2) / 2; vNet();
    }));
    $('#vie-t').addEventListener('input', (e) => { st.T = +e.target.value; pedirDibujo(); });
    $('#vie-play').addEventListener('click', () => {
      if (st.play) { cancelAnimationFrame(st.play); st.play = null; return; }
      const max = Math.ceil(CAS.tMax); const ini = performance.now(); st.T = 0;
      const paso = (ahora) => {
        st.T = Math.min(max, ((ahora - ini) / 6000) * max);       // 6 s de reproducción, independiente del equipo
        $('#vie-t').value = st.T; dibujaGrafo();
        st.play = st.T < max ? requestAnimationFrame(paso) : null;
      };
      st.play = requestAnimationFrame(paso);
    });
    $('#vie-g').addEventListener('click', (e) => {
      const cv = e.currentTarget, b = cv.getBoundingClientRect(); const x = e.clientX - b.left, y = e.clientY - b.top;
      let best = null, bd = 144; const L = tamGrafo();
      CAS.nodos.forEach((n) => { if (n.t > st.T) return; const d = (L.cx + n.x * L.R - x) ** 2 + (L.cy + n.y * L.R - y) ** 2; if (d < bd) { bd = d; best = n; } });
      st.sel = best; dibujaGrafo();
      $('#vie-insp').innerHTML = best ? `<b>P-${String(best.id).padStart(4, '0')}</b> · generación ${best.gen} · ${best.hijos} altas directas · grado ${best.grado} · intermediación ${best.bc.toFixed(1)} · comunidad ${best.com} (${CAS.comTam[best.com]} personas) · alta a las ${best.t.toFixed(1)} h${best.sospechoso ? ' · <span class="vie__pill vie__pill--bad">patrón atípico</span>' : ''}` : '';
    });
  }
  /* Render del grafo: tamaño del canvas y paleta se calculan una vez (no en cada cuadro) y se dibuja a lo sumo 1 vez por frame. */
  let GL = null, PAL = null, pendiente = false;
  function tamGrafo() {
    const cv = $('#vie-g'); if (!cv.dataset.h) cv.dataset.h = cv.getAttribute('height'); const W = cv.clientWidth, H = +cv.dataset.h; cv.style.height = `${H}px`;
    if (!GL || GL.cv !== cv || GL.W !== W) {
      const d = window.devicePixelRatio || 1; cv.width = W * d; cv.height = H * d;
      const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
      GL = { cv, g, W, H, cx: W / 2, cy: H / 2, R: Math.min(W, H) / 2 - 16 };
    }
    return GL;
  }
  function arranca() { if (!vivo) { vivo = true; requestAnimationFrame(animaGrafo); } }
  function pedirDibujo() { if (pendiente) return; pendiente = true; requestAnimationFrame(() => { pendiente = false; dibujaGrafo(); }); }
  function dibujaGrafo() {
    if (!$('#vie-g')) return; const L = tamGrafo(); const { g, W, H, cx, cy, R } = L;
    if (!PAL) PAL = { pal: ['--accent-cyan', '--accent-purple', '--accent-warm', '--accent-lime', '--accent-coral', '--accent-blue', '--accent-green'].map((v) => tok(v, '#888')), linea: tok('--velo-10', 'rgba(255,255,255,.1)'), alerta: tok('--accent-coral', '#ff3d6e'), sel: tok('--text-heading', '#fff') }; // color-ok
    $('#vie-tt').textContent = `${Math.round(st.T)} h`;
    g.clearRect(0, 0, W, H);
    const ahora = performance.now(), V = Math.max(1, CAS.tMax * 0.05);     // V = ventana de "recién nacido", en horas simuladas
    g.strokeStyle = tok('--velo-05', 'rgba(255,255,255,.05)'); g.lineWidth = 1; // color-ok
    for (let q = 1; q <= 4; q++) { g.beginPath(); g.arc(cx, cy, (R * (0.14 + 0.86 * (q / 4))), 0, 7); g.stroke(); }   // anillos = generaciones
    if (st.play) {                                           // barrido: onda que sale del centro mientras reproduce
      const w = (ahora / 1800) % 1; g.strokeStyle = `rgba(34,224,255,${0.35 * (1 - w)})`; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R * w, 0, 7); g.stroke();
    }
    g.strokeStyle = PAL.linea; g.lineWidth = 1; g.beginPath();
    CAS.nodos.forEach((n) => {
      if (n.padre < 0 || n.t > st.T) return; const p = CAS.nodos[n.padre]; const k = Math.min(1, (st.T - n.t) / V);   // la arista crece del padre al hijo
      g.moveTo(cx + p.x * R, cy + p.y * R); g.lineTo(cx + (p.x + (n.x - p.x) * k) * R, cy + (p.y + (n.y - p.y) * k) * R);
    });
    g.stroke();
    const tramo = (n, f) => { const p = CAS.nodos[n.padre]; return [cx + (p.x + (n.x - p.x) * f) * R, cy + (p.y + (n.y - p.y) * f) * R]; };
    CAS.nodos.forEach((n) => {
      if (n.t > st.T) return; const age = Math.min(1, (st.T - n.t) / V), e = 1 - (1 - age) ** 3;   // nace creciendo
      const x = cx + n.x * R, y = cy + n.y * R; const r = (2.5 + Math.sqrt(n.grado) * 1.5) * e;
      const col = PAL.pal[n.com % PAL.pal.length];
      if (age < 1) { g.strokeStyle = col; g.globalAlpha = 0.8 * (1 - age); g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + age * 22, 0, 7); g.stroke(); g.globalAlpha = 1; }   // pulso al nacer
      g.fillStyle = col; g.globalAlpha = e; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.globalAlpha = 1;
      if (n.sospechoso || st.sel === n) { g.strokeStyle = n.sospechoso ? PAL.alerta : PAL.sel; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + 3 + (n.sospechoso ? Math.sin(ahora / 300) * 1.5 : 0), 0, 7); g.stroke(); }
    });
    g.fillStyle = PAL.pal[0];                                // partículas viajando por las aristas: la invitación en tránsito
    CAS.nodos.forEach((n) => {
      if (n.padre < 0 || n.t > st.T) return; const age = (st.T - n.t) / V;
      const f = age < 1 ? age : (((ahora / 2600) + n.id * 0.37) % 1.6) - 0.3;   // al nacer: sigue la arista; luego, latido ambiental
      if (f <= 0 || f >= 1 || (age >= 1 && n.id % 4)) return;
      const [px, py] = tramo(n, f); g.globalAlpha = 0.9; g.beginPath(); g.arc(px, py, 2.2, 0, 7); g.fill(); g.globalAlpha = 1;
    });
  }
  /* Bucle de animación: mantiene vivo el grafo (latidos, partículas) mientras exista el canvas. */
  let vivo = false;
  function animaGrafo() {
    if (!$('#vie-g')) { vivo = false; return; }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches || st.play) dibujaGrafo();
    requestAnimationFrame(animaGrafo);
  }

  function dibujaMC(mc) {
    const cv = $('#vie-mc'); const g = prep(cv); const W = cv.clientWidth, H = 240, D = mc.banda.length;
    const maxY = Math.max(...mc.banda.map((b) => b[2]), st.params.cap) * 1.1; axes(g, W, H, maxY, D - 1, 'día');
    const X = (d) => 40 + (d / (D - 1)) * (W - 50), Y = (v) => H - 24 - (v / maxY) * (H - 40);
    g.fillStyle = tok('--accent-blue-light', 'rgba(91,134,255,.16)'); g.beginPath(); // color-ok
    mc.banda.forEach((b, d) => (d ? g.lineTo(X(d), Y(b[2])) : g.moveTo(X(d), Y(b[2])))); for (let d = D - 1; d >= 0; d--) g.lineTo(X(d), Y(mc.banda[d][0])); g.fill();
    g.strokeStyle = tok('--accent-cyan', '#22e0ff'); g.lineWidth = 2; g.beginPath(); // color-ok
    mc.banda.forEach((b, d) => (d ? g.lineTo(X(d), Y(b[1])) : g.moveTo(X(d), Y(b[1])))); g.stroke();
    g.strokeStyle = tok('--accent-coral', '#ff3d6e'); g.setLineDash([4, 4]); g.beginPath(); g.moveTo(40, Y(st.params.cap)); g.lineTo(W - 10, Y(st.params.cap)); g.stroke(); g.setLineDash([]); // color-ok
    g.fillStyle = tok('--accent-coral', '#ff3d6e'); g.fillText('capacidad', W - 60, Y(st.params.cap) - 4); // color-ok
  }

  /* ═════════ 4 · Creative Studio con guardia de cumplimiento ═════════ */
  const PROHIBIDO = [/miles de personas ya/i, /garantizad/i, /agotad[oa]s? en minutos/i, /testimonio/i, /\bya confirmaron\b/i, /sin falta/i];
  function plantillas(c) {
    const { ev, fecha, lugar, pers, canal, obj } = c; const link = 'https://[dominio-del-evento]/r/[tu-codigo]';
    const lead = { registro: 'Regístrate', recordatorio: 'Recuerda tu lugar', logistica: 'Tu guía para llegar' }[obj];
    const T = {
      wa: [`Hola 👋 Te invitamos a ${ev}${pers ? ` con ${pers}` : ''}. ${fecha} · ${lugar}.\n${lead}: ${link}\nResponde BAJA para no recibir más mensajes.`, `${lead} para ${ev} (${fecha}, ${lugar}). Cupo limitado según aforo del recinto. ${link}\nResponde BAJA para dejar de recibir avisos.`, `¿Te gustan los autos? ${ev} abre registro. ${lead}: ${link}\nSi ya no quieres recibir mensajes, responde BAJA.`],
      video: [`GUION 20 s\n0–3 s: plano del recinto, texto "${ev}".\n3–12 s: voz en off con los datos (${fecha}, ${lugar}).\n12–20 s: llamado a la acción "${lead}" + enlace en bio.`, `GUION 15 s\nGancho: "¿Qué se siente en la pista?"\nDesarrollo: 3 imágenes autorizadas del evento.\nCierre: "${lead} en ${link}".`, `GUION 30 s (detrás de cámaras)\nMuestra la preparación logística real del evento. Cierre: fecha, lugar y "${lead}".`],
      social: [`${ev} · ${fecha} · ${lugar}\n${lead} y comparte el evento con quien le guste el automovilismo: ${link}`, `Cuenta regresiva: faltan [N] días para ${ev}. ${lead}: ${link}`, `Pregunta a tu comunidad: ¿cuál es tu pista favorita? Y ${lead.toLowerCase()} en ${link}`],
      qr: [`CARTEL ESTACIÓN\nTítulo: ${ev}\nSubtítulo: ${fecha} · ${lugar}\nQR → ${link}\nPie: Aviso de privacidad en [URL]. Participación voluntaria.`, `VOLANTE\n"${lead}" + QR único por estación para medir atribución.\n${fecha} · ${lugar}`, `TICKET DE ESTACIÓN\nQR con código de la estación [ID]. Texto: invitación opcional, sin condicionar el servicio.`],
      logi: [`Logística ${ev}: apertura de puertas [hora], accesos [puerta], estacionamiento [zona]. Lleva tu QR de registro. Accesibilidad: [información verificada por operaciones].`, `Recordatorio: ${fecha}, ${lugar}. Llega 60 min antes para el check-in. Tu QR es personal e intransferible.`, `Cambios de último momento se publicarán solo en canales oficiales: [lista].`],
    };
    return T[canal];
  }
  function revisar(txt, c) {
    const f = [];
    PROHIBIDO.forEach((re) => { if (re.test(txt)) f.push(`Frase no permitida (popularidad o testimonio no verificable): ${re}`); });
    if (c.pers && !c.auth) f.push('Usa el nombre de la personalidad pública sin autorización de nombre/imagen/voz.');
    if (c.canal === 'wa' && !/BAJA/i.test(txt)) f.push('Falta mecanismo de baja.');
    return f;
  }
  function vStu() {
    $('#vie-body').innerHTML = `
      <div class="vie__cols">
        <div class="vie__card"><h4>Brief del contenido</h4>
          <div class="vie__row"><label class="vie__f">Evento<input type="text" id="s-ev" value="Evento automovilístico [nombre por definir]"></label><label class="vie__f">Fecha<input type="text" id="s-fe" value="[fecha por confirmar]"></label></div>
          <div class="vie__row"><label class="vie__f">Lugar<input type="text" id="s-lu" value="[recinto por confirmar]"></label><label class="vie__f">Personalidad pública<input type="text" id="s-pe" value="" placeholder="dejar vacío si aún no hay autorización"></label></div>
          <div class="vie__row"><label class="vie__f">Canal<select id="s-ca"><option value="wa">WhatsApp</option><option value="video">Video corto</option><option value="social">Redes sociales</option><option value="qr">Estación de servicio + QR</option><option value="logi">Logística previa</option></select></label>
          <label class="vie__f">Objetivo<select id="s-ob"><option value="registro">Registro</option><option value="recordatorio">Recordatorio</option><option value="logistica">Logística</option></select></label></div>
          <label class="vie__row" style="font-size:.76rem"><input type="checkbox" id="s-au"> Cuento con autorización documentada de nombre, imagen y voz</label>
          <div class="vie__row"><button class="vie__btn" id="s-go">Generar variantes</button></div>
          <p class="vie__nota">Plantillas basadas en contexto público del evento. Prohibidos: testimonios falsos, popularidad fabricada, suplantación y contenido engañoso. WhatsApp habilitado a ${fmt(AUD.canal.wa)} contactos con consentimiento.</p></div>
        <div class="vie__card"><h4>Variantes y revisión de cumplimiento</h4><div id="s-out"><p class="vie__nota">Genera variantes para revisarlas.</p></div></div>
      </div>
      <div class="vie__card"><h4>Cola de aprobación humana (${st.aprobados.length})</h4>${st.aprobados.length ? `<ul>${st.aprobados.map((a) => `<li><b>${esc(a.canal)}</b> · ${esc(a.txt.slice(0, 90))}… <span class="vie__pill vie__pill--ok">aprobado — no enviado</span></li>`).join('')}</ul>` : '<p class="vie__nota">Nada aprobado todavía. Este prototipo no envía nada.</p>'}</div>`;
    const lee = () => ({ ev: $('#s-ev').value.trim() || '[evento]', fecha: $('#s-fe').value.trim(), lugar: $('#s-lu').value.trim(), pers: $('#s-pe').value.trim(), canal: $('#s-ca').value, obj: $('#s-ob').value, auth: $('#s-au').checked });
    $('#s-go').addEventListener('click', () => {
      const c = lee(); st.studioOut = plantillas(c).map((t) => ({ txt: t, prob: revisar(t, c), canal: $('#s-ca').selectedOptions[0].text }));
      $('#s-out').innerHTML = st.studioOut.map((v, i) => `<div class="vie__var ${v.prob.length ? 'vie__var--bloq' : ''}"><b>Variante ${i + 1}</b> ${v.prob.length ? '<span class="vie__pill vie__pill--bad">Bloqueada por Compliance Guardian</span>' : '<span class="vie__pill vie__pill--ok">Cumple reglas automáticas</span>'}<pre>${esc(v.txt)}</pre>${v.prob.map((p) => `<div class="vie__nota">⚠ ${esc(p)}</div>`).join('')}<button class="vie__btn vie__btn--ghost" data-ap="${i}" ${v.prob.length ? 'disabled' : ''}>Aprobar (humano)</button></div>`).join('');
      $$('[data-ap]').forEach((b) => b.addEventListener('click', () => { st.aprobados.push(st.studioOut[+b.dataset.ap]); vStu(); }));
    });
  }

  /* ═════════ 5 · Event Operations: cupos, lista de espera, check-in ═════════ */
  function estadoOps() {
    const base = registrados.filter((c) => !st.cancel.has(c));
    return { conf: base.slice(0, st.cupo), espera: base.slice(st.cupo) };
  }
  function vOps() {
    const e = estadoOps(); const asist = st.checkin.size;
    $('#vie-body').innerHTML = `
      <div class="vie__grid">${kpi('Registrados', fmt(registrados.length - st.cancel.size))}${kpi('Cupo confirmado', `${fmt(e.conf.length)} / ${fmt(st.cupo)}`)}${kpi('Lista de espera', fmt(e.espera.length))}${kpi('Check-in', fmt(asist), e.conf.length ? `${pc(asist / e.conf.length, 0)} de confirmados` : '')}${kpi('Cancelaciones', fmt(st.cancel.size))}</div>
      <div class="vie__cols">
        <div class="vie__card"><h4>Check-in presencial</h4>
          <div class="vie__row"><input type="text" id="o-code" placeholder="Código QR, ej. QR-0003"><button class="vie__btn" id="o-ci">Validar entrada</button><button class="vie__btn vie__btn--ghost" id="o-sim">Simular 10 check-ins</button></div>
          <div class="vie__msg" id="o-msg"></div>
          <div class="vie__row"><input type="text" id="o-can" placeholder="Código a cancelar"><button class="vie__btn vie__btn--ghost" id="o-cb">Cancelar registro</button></div>
          <p class="vie__nota">Cada QR entra una sola vez; un duplicado se rechaza. Al cancelar, el primero de la lista de espera pasa a confirmado.</p></div>
        <div class="vie__card"><h4>Aforo y capacidad</h4>
          <label class="vie__ctrl"><span>Cupo del recinto</span><output>${fmt(st.cupo)}</output><input type="range" id="o-cupo" min="20" max="${registrados.length}" value="${st.cupo}"></label>
          ${bar('Confirmados', e.conf.length, st.cupo, `${pc(e.conf.length / (st.cupo || 1), 0)}`)}${bar('Dentro del recinto', asist, st.cupo, fmt(asist))}
          <p class="vie__nota">El aforo máximo debe validarse con el recinto y protección civil; aquí es un parámetro. Accesibilidad y seguridad quedan como lista de verificación operativa del evento.</p></div>
      </div>`;
    const msg = (t, ok) => { const m = $('#o-msg'); m.textContent = t; m.style.color = ok ? 'var(--status-success)' : 'var(--status-error)'; };
    $('#o-ci').addEventListener('click', () => {
      const c = $('#o-code').value.trim().toUpperCase(); const e2 = estadoOps();
      if (!registrados.includes(c) || st.cancel.has(c)) return msg('Código no registrado o cancelado.', false);
      if (st.checkin.has(c)) return msg('Rechazado: este QR ya ingresó.', false);
      if (!e2.conf.includes(c)) return msg('En lista de espera: sin cupo confirmado.', false);
      st.checkin.add(c); msg(`Entrada válida: ${c}.`, true); vOps();
    });
    $('#o-sim').addEventListener('click', () => { const r = rngSeed(Date.now() % 1e6); estadoOps().conf.filter((c) => !st.checkin.has(c) && r() < 0.65).slice(0, 10).forEach((c) => st.checkin.add(c)); vOps(); });
    $('#o-cb').addEventListener('click', () => { const c = $('#o-can').value.trim().toUpperCase(); if (registrados.includes(c) && !st.cancel.has(c)) { st.cancel.add(c); st.checkin.delete(c); vOps(); } });
    $('#o-cupo').addEventListener('change', (ev) => { st.cupo = +ev.target.value; vOps(); });
  }

  /* ═════════ Agentes, modelos científicos y gobernanza ═════════ */
  function vGov() {
    const mc = monteCarlo(st.params);
    const sosp = CAS.nodos.filter((n) => n.sospechoso).length;
    const AG = [
      ['01 Data Steward', `${fmt(AUD.dup)} duplicados fusionados, ${fmt(AUD.telMal)} teléfonos inválidos.`, 'valida calidad, permisos y consistencia'],
      ['02 Audience Analyst', `Zona más grande: ${AUD.zonas.slice().sort((a, b) => b.n - a.n)[0].v}.`, 'segmentos agregados'],
      ['03 Network Scientist', `Cascada de ${CAS.nodos.length} nodos, profundidad ${CAS.prof}, ${Object.keys(CAS.comTam).length} comunidades.`, 'redes de referidos'],
      ['04 Viral Strategist', `Hipótesis: subir k de ${st.params.k} a ${st.params.k + 1} llevaría R₀ de ${mc.R0.toFixed(2)} a ${((st.params.s / 100) * (st.params.k + 1) * (st.params.c / 100) / (st.params.gamma / 100)).toFixed(2)} (por validar con A/B).`, 'hipótesis y experimentos'],
      ['05 Creative Director', `${st.studioOut.length} variantes en la última generación.`, 'propuestas de contenido'],
      ['06 Campaign Planner', 'Borrador: 3 semanas, WhatsApp + estaciones + redes, recordatorios a T-7, T-2, T-0.', 'cronograma y recursos'],
      ['07 Experimentation Scientist', 'Sin pruebas A/B ejecutadas: no se declara ningún efecto incremental.', 'pruebas e incrementalidad'],
      ['08 Predictive Analyst', `Asistencia P10/P50/P90: ${fmt(mc.asist[0])}/${fmt(mc.asist[1])}/${fmt(mc.asist[2])}.`, 'simulación'],
      ['09 Event Operations', `Probabilidad de exceder capacidad (${fmt(st.params.cap)}): ${pc(mc.pSobre, 0)}.`, 'demanda vs. capacidad'],
      ['10 Compliance Guardian', `${st.studioOut.filter((v) => v.prob.length).length} variantes bloqueadas; ${sosp} patrón(es) atípico(s) a revisión.`, 'privacidad, frecuencia, restricciones'],
      ['11 Executive Intelligence', `Riesgo principal: ${mc.R0 < 1 ? 'cascada subcrítica, depende de difusión oficial' : 'saturación rápida de la audiencia'}.`, 'síntesis'],
    ];
    const MOD = [
      ['Tipping Point', 'Connectors, Mavens, Advocates, Stickiness, Context', 'Se usa intermediación y altas directas como proxy observable de conectores.', 'Es un marco conceptual, no un modelo predictivo validado.'],
      ['Difusión de innovaciones', 'Innovadores → Rezagados', 'Se clasifica por momento de alta observado, no por rasgos de personas.', 'Etiqueta de adopción; no es perfil psicológico permanente.'],
      ['SIR adaptado', 'S, I, R0 de invitaciones, γ, saturación', 'Población homogénea, mezcla uniforme.', 'Ignora estructura de comunidades; requiere calibración histórica.'],
      ['Contagio complejo', 'Exposición repetida, umbrales', 'Pendiente de datos de exposición por canal.', 'No implementado en el prototipo.'],
      ['Diseño conductual', 'Motivación, facilidad, llamado a la acción', 'Se refleja en c (conversión) y fricción del registro.', 'Medible solo con A/B.'],
      ['Experimentación', 'A/B, control, intervalos de confianza', 'Requiere grupos de control y tamaño de muestra previo.', 'Aún sin experimentos reales.'],
    ];
    const GOB = [['Aviso de privacidad y finalidades', 'warn', 'Requiere validación jurídica'], ['Consentimiento por canal', 'ok', 'Modelado en datos'], ['Bajas y exclusiones', 'ok', 'Aplicadas al universo elegible'], ['Derechos ARCO', 'warn', 'Flujo por diseñar con el área legal'], ['Minimización y seudonimización', 'ok', 'IDs en vez de nombres; datos enmascarados'], ['Cifrado y control de acceso por roles', 'warn', 'Fase 3: backend'], ['Auditoría de acciones', 'warn', 'Fase 3: backend'], ['Supervisión humana de envíos', 'ok', 'Cola de aprobación activa'], ['Políticas de retención', 'warn', 'Por definir con el responsable de datos']];
    const FASES = [['Fase 1 · Blueprint', 'ok', 'Esta sección documenta módulos, modelos, agentes y gobernanza'], ['Fase 2 · Prototipo funcional', 'ok', 'Datos sintéticos, grafo, simulación, estudio, embudo y check-in'], ['Fase 3 · Plataforma operativa', 'warn', 'Backend, base de datos, roles e integraciones: pendiente'], ['Fase 4 · Inteligencia avanzada', 'warn', 'Modelos con datos reales: pendiente'], ['Fase 5 · Validación y despliegue', 'warn', 'Pruebas, seguridad y capacitación: pendiente']];
    $('#vie-body').innerHTML = `
      <div class="vie__cols">
        <div class="vie__card"><h4>Orquestador multiagente (recomiendan; no publican solos)</h4>${AG.map(([n, t, s]) => `<div class="vie__agente"><b>${esc(n.split(' ')[0])}</b><span><strong>${esc(n.slice(3))}</strong> — ${esc(t)}</span><small>${esc(s)}</small></div>`).join('')}</div>
        <div><div class="vie__card"><h4>Hoja de ruta</h4><ul>${FASES.map(([f, k, t]) => `<li><span class="vie__pill vie__pill--${k}">${k === 'ok' ? 'listo' : 'pendiente'}</span> <b>${f}</b> — ${t}</li>`).join('')}</ul></div>
        <div class="vie__card" style="margin-top:var(--space-sm)"><h4>Privacidad, seguridad y gobernanza</h4><ul>${GOB.map(([t, k, n]) => `<li><span class="vie__pill vie__pill--${k}">${k === 'ok' ? 'en prototipo' : 'por validar'}</span> ${t} · <span class="vie__nota">${n}</span></li>`).join('')}</ul>
          <p class="vie__nota">No se afirma cumplimiento legal ni certificaciones: la evaluación jurídica (LFPDPPP y políticas de plataformas) debe hacerla el responsable correspondiente.</p></div></div>
      </div>
      <div class="vie__card"><h4>Modelos científicos: supuestos y límites</h4>
        <table><tr><th>Modelo</th><th>Variables</th><th>Supuesto</th><th>Limitación</th></tr>${MOD.map((m) => `<tr>${m.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</table></div>`;
  }

  marco();
  let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { GL = null; if (st.tab === 'cmd') vCmd(); else if (st.tab === 'net') vNet(); }, 200); });
})();
