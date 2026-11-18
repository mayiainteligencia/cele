/** Diálogo de confirmación con el estilo de la app (reemplaza window.confirm). */
export function confirmar(o: { titulo: string; mensaje: string; aceptar?: string; cancelar?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    const previo = document.activeElement as HTMLElement | null;
    const fondo = document.createElement('div');
    fondo.className = 'cenet-dlg';
    const caja = document.createElement('div');
    caja.className = 'cenet-dlg__box cenet-hud-glass';
    caja.setAttribute('role', 'alertdialog');
    caja.setAttribute('aria-modal', 'true');
    const h = document.createElement('h3');
    h.textContent = o.titulo;
    const p = document.createElement('p');
    p.textContent = o.mensaje;   // textContent: sin HTML inyectable
    const fila = document.createElement('div');
    fila.className = 'cenet-dlg__actions';
    const no = document.createElement('button');
    no.type = 'button';
    no.className = 'cenet-hist-refresh';
    no.textContent = o.cancelar ?? 'Cancelar';
    const si = document.createElement('button');
    si.type = 'button';
    si.className = 'cenet-btn-search';
    si.textContent = o.aceptar ?? 'Continuar';
    fila.append(no, si);
    caja.append(h, p, fila);
    fondo.append(caja);
    document.body.append(fondo);
    const cerrar = (v: boolean) => {
      document.removeEventListener('keydown', tecla);
      fondo.remove();
      previo?.focus();
      resolve(v);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar(false);
    };
    document.addEventListener('keydown', tecla);
    no.addEventListener('click', () => cerrar(false));
    si.addEventListener('click', () => cerrar(true));
    fondo.addEventListener('click', (e) => e.target === fondo && cerrar(false));
    si.focus();
  });
}
