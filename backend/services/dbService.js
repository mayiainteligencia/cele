import pool from '../config/database.js';

export async function buscarContextoEnDB(mensaje, departamento) {
  try {
    const mensajeLower = mensaje.toLowerCase();
    let resultados = [];

    // Buscar servicios de MAYIA
    if (mensajeLower.includes('servicio') || mensajeLower.includes('solución') || mensajeLower.includes('ia')) {
      const [servicios] = await pool.query(
        `SELECT s.nombre, s.descripcion, s.precio, d.nombre as departamento 
         FROM servicios s 
         JOIN departamentos d ON s.departamento_id = d.id 
         WHERE s.disponible = ? 
         LIMIT 10`,
        [true]
      );
      if (servicios.length > 0) {
        resultados.push({ tipo: 'servicios', datos: servicios });
      }
    }

    // Buscar cursos de Academia
    if (mensajeLower.includes('curso') || mensajeLower.includes('capacitación') || mensajeLower.includes('academia')) {
      const [cursos] = await pool.query(
        `SELECT titulo, descripcion, duracion_horas, nivel, categoria 
         FROM cursos_academia 
         WHERE disponible = ? 
         LIMIT 10`,
        [true]
      );
      if (cursos.length > 0) {
        resultados.push({ tipo: 'cursos', datos: cursos });
      }
    }

    // Buscar servicios corporativos (Grid 3x3)
    if (mensajeLower.includes('centro de datos') || mensajeLower.includes('nube') || 
        mensajeLower.includes('edgenet') || mensajeLower.includes('flai')) {
      const [corporativos] = await pool.query(
        `SELECT nombre, descripcion, categoria 
         FROM servicios_corporativos 
         WHERE disponible = ? 
         ORDER BY posicion`,
        [true]
      );
      if (corporativos.length > 0) {
        resultados.push({ tipo: 'servicios_corporativos', datos: corporativos });
      }
    }

    // Buscar por departamento específico
    if (departamento && departamento !== 'general') {
      const [serviciosDept] = await pool.query(
        `SELECT s.nombre, s.descripcion, s.precio 
         FROM servicios s 
         JOIN departamentos d ON s.departamento_id = d.id 
         WHERE d.nombre LIKE ? AND s.disponible = ?`,
        [`%${departamento}%`, true]
      );
      if (serviciosDept.length > 0) {
        resultados.push({ tipo: 'servicios_departamento', datos: serviciosDept });
      }
    }

    // Buscar información de MABE
    if (mensajeLower.includes('mabe') || mensajeLower.includes('empresa') || mensajeLower.includes('electrodomésticos')) {
      const [info] = await pool.query(
        `SELECT empresa, descripcion, industria, fundacion, pais 
         FROM info_empresa 
         WHERE empresa = ?`,
        ['MABE']
      );
      if (info.length > 0) {
        resultados.push({ tipo: 'empresa', datos: info });
      }
    }

    // ========== DATOS DEMO ORIGINALES (con SQL parametrizado) ==========

    // Buscar en Recursos Humanos
    if (mensajeLower.includes('empleado') || mensajeLower.includes('personal') || departamento === 'rh') {
      const [empleados] = await pool.query(
        `SELECT nombre, puesto, departamento, status 
         FROM empleados 
         WHERE status = ? 
         LIMIT ?`,
        ['activo', 10]
      );
      if (empleados.length > 0) {
        resultados.push({ tipo: 'empleados', datos: empleados });
      }
    }

    // Buscar en Finanzas
    if (mensajeLower.includes('presupuesto') || mensajeLower.includes('finanzas') || mensajeLower.includes('gasto') || departamento === 'finanzas') {
      const [presupuestos] = await pool.query(
        `SELECT departamento, categoria, monto_asignado, monto_gastado, periodo 
         FROM presupuestos 
         ORDER BY departamento 
         LIMIT ?`,
        [10]
      );
      if (presupuestos.length > 0) {
        resultados.push({ tipo: 'presupuestos', datos: presupuestos });
      }
    }

    // Buscar en Ventas
    if (mensajeLower.includes('venta') || mensajeLower.includes('cliente') || mensajeLower.includes('ingreso') || departamento === 'ventas') {
      const [ventas] = await pool.query(
        `SELECT cliente, producto, monto, vendedor, status 
         FROM ventas 
         WHERE status IN (?, ?) 
         ORDER BY fecha DESC 
         LIMIT ?`,
        ['cerrada', 'en-proceso', 10]
      );
      if (ventas.length > 0) {
        resultados.push({ tipo: 'ventas', datos: ventas });
      }
    }

    // Buscar en Inventario
    if (mensajeLower.includes('inventario') || mensajeLower.includes('producto') || mensajeLower.includes('stock') || departamento === 'operaciones') {
      const [inventario] = await pool.query(
        `SELECT producto, categoria, cantidad, ubicacion, precio_unitario 
         FROM inventario 
         WHERE cantidad > ? 
         LIMIT ?`,
        [0, 10]
      );
      if (inventario.length > 0) {
        resultados.push({ tipo: 'inventario', datos: inventario });
      }
    }

    // Buscar en Tickets TI
    if (mensajeLower.includes('ticket') || mensajeLower.includes('soporte') || mensajeLower.includes('ti') || departamento === 'ti') {
      const [tickets] = await pool.query(
        `SELECT titulo, prioridad, status, reportado_por, asignado_a 
         FROM tickets_ti 
         WHERE status != ? 
         ORDER BY fecha_creacion DESC 
         LIMIT ?`,
        ['resuelto', 5]
      );
      if (tickets.length > 0) {
        resultados.push({ tipo: 'tickets', datos: tickets });
      }
    }

    return resultados.length > 0 ? resultados : null;

  } catch (error) {
    console.error('❌ Error buscando en DB:', error);
    return null;
  }
}

// Función para buscar un servicio específico por nombre
export async function buscarServicioPorNombre(nombre) {
  try {
    const [servicio] = await pool.query(
      `SELECT s.*, d.nombre as departamento_nombre 
       FROM servicios s 
       JOIN departamentos d ON s.departamento_id = d.id 
       WHERE s.nombre LIKE ? AND s.disponible = ?`,
      [`%${nombre}%`, true]
    );
    return servicio.length > 0 ? servicio[0] : null;
  } catch (error) {
    console.error('❌ Error buscando servicio:', error);
    return null;
  }
}

// Función para buscar cursos por nivel o categoría
export async function buscarCursos(filtros = {}) {
  try {
    let query = 'SELECT * FROM cursos_academia WHERE disponible = ?';
    let params = [true];

    if (filtros.nivel) {
      query += ' AND nivel = ?';
      params.push(filtros.nivel);
    }

    if (filtros.categoria) {
      query += ' AND categoria = ?';
      params.push(filtros.categoria);
    }

    query += ' ORDER BY titulo LIMIT ?';
    params.push(filtros.limit || 10);

    const [cursos] = await pool.query(query, params);
    return cursos;
  } catch (error) {
    console.error('❌ Error buscando cursos:', error);
    return [];
  }
}

// Función para obtener estadísticas de servicios
export async function obtenerEstadisticasServicios() {
  try {
    const [stats] = await pool.query(
      `SELECT 
        COUNT(*) as total_servicios,
        COUNT(DISTINCT departamento_id) as total_departamentos,
        SUM(CASE WHEN precio IS NOT NULL THEN 1 ELSE 0 END) as servicios_con_precio
       FROM servicios 
       WHERE disponible = ?`,
      [true]
    );
    return stats[0];
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    return null;
  }
}
