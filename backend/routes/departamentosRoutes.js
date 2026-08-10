import express from 'express';
import {
  getEmpleados,
  getPresupuestos,
  getVentas,
  getInventario,
  getTicketsTI,
  getEstadisticasGenerales
} from '../controllers/departamentosController.js';

const router = express.Router();

// Recursos Humanos
router.get('/rh/empleados', getEmpleados);

// Finanzas
router.get('/finanzas/presupuestos', getPresupuestos);

// Ventas
router.get('/ventas/ventas', getVentas);

// Operaciones
router.get('/operaciones/inventario', getInventario);

// TI
router.get('/ti/tickets', getTicketsTI);

// Dashboard general
router.get('/estadisticas', getEstadisticasGenerales);

export default router;
