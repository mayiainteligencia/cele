import express from 'express';
import {
  getDepartamentos,
  getServiciosPorDepartamento,
  getCursos,
  getServiciosCorporativos,
  getInfoEmpresa,
  buscarServicio,
  getEstadisticasMayia
} from '../controllers/mayiaController.js';

const router = express.Router();

// Departamentos
router.get('/departamentos', getDepartamentos);
router.get('/departamentos/:departamento/servicios', getServiciosPorDepartamento);

// Cursos Academia
router.get('/cursos', getCursos);

// Servicios Corporativos
router.get('/servicios-corporativos', getServiciosCorporativos);

// Información empresa
router.get('/empresa', getInfoEmpresa);

// Búsqueda
router.get('/buscar-servicio', buscarServicio);

// Estadísticas
router.get('/estadisticas', getEstadisticasMayia);

export default router;
