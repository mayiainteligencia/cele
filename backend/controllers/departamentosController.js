import pool from '../config/database.js';

// Recursos Humanos - Empleados
export async function getEmpleados(req, res) {
  try {
    const [empleados] = await pool.query('SELECT * FROM empleados ORDER BY nombre');
    res.json({ success: true, data: empleados });
  } catch (error) {
    console.error('Error obteniendo empleados:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Finanzas - Presupuestos
export async function getPresupuestos(req, res) {
  try {
    const [presupuestos] = await pool.query('SELECT * FROM presupuestos ORDER BY departamento');
    res.json({ success: true, data: presupuestos });
  } catch (error) {
    console.error('Error obteniendo presupuestos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Ventas
export async function getVentas(req, res) {
  try {
    const [ventas] = await pool.query('SELECT * FROM ventas ORDER BY fecha DESC');
    res.json({ success: true, data: ventas });
  } catch (error) {
    console.error('Error obteniendo ventas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Operaciones - Inventario
export async function getInventario(req, res) {
  try {
    const [inventario] = await pool.query('SELECT * FROM inventario ORDER BY producto');
    res.json({ success: true, data: inventario });
  } catch (error) {
    console.error('Error obteniendo inventario:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// TI - Tickets
export async function getTicketsTI(req, res) {
  try {
    const [tickets] = await pool.query('SELECT * FROM tickets_ti ORDER BY fecha_creacion DESC');
    res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('Error obteniendo tickets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Estadísticas Generales
export async function getEstadisticasGenerales(req, res) {
  try {
    const [totalEmpleados] = await pool.query('SELECT COUNT(*) as total FROM empleados WHERE status = "activo"');
    const [totalVentas] = await pool.query('SELECT COUNT(*) as total, SUM(monto) as suma FROM ventas WHERE status = "cerrada"');
    const [totalTickets] = await pool.query('SELECT COUNT(*) as total FROM tickets_ti WHERE status != "resuelto"');
    const [presupuestoTotal] = await pool.query('SELECT SUM(monto_asignado) as total, SUM(monto_gastado) as gastado FROM presupuestos');

    res.json({
      success: true,
      data: {
        empleadosActivos: totalEmpleados[0].total,
        ventasCerradas: totalVentas[0].total,
        montoVentas: totalVentas[0].suma || 0,
        ticketsAbiertos: totalTickets[0].total,
        presupuestoTotal: presupuestoTotal[0].total || 0,
        presupuestoGastado: presupuestoTotal[0].gastado || 0
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
