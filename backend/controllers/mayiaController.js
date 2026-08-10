import pool from '../config/database.js';
import { buscarServicioPorNombre, buscarCursos, obtenerEstadisticasServicios } from '../services/dbService.js';

// Obtener todos los departamentos
export async function getDepartamentos(req, res) {
  try {
    const [departamentos] = await pool.query(
      'SELECT * FROM departamentos ORDER BY nombre'
    );
    res.json({ success: true, data: departamentos });
  } catch (error) {
    console.error('❌ Error obteniendo departamentos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Obtener servicios por departamento
export async function getServiciosPorDepartamento(req, res) {
  try {
    const { departamento } = req.params;
    const [servicios] = await pool.query(
      `SELECT s.* FROM servicios s 
       JOIN departamentos d ON s.departamento_id = d.id 
       WHERE d.nombre LIKE ? AND s.disponible = ?`,
      [`%${departamento}%`, true]
    );
    res.json({ success: true, data: servicios });
  } catch (error) {
    console.error('❌ Error obteniendo servicios:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Obtener todos los cursos
export async function getCursos(req, res) {
  try {
    const { nivel, categoria, limit } = req.query;
    const cursos = await buscarCursos({ nivel, categoria, limit });
    res.json({ success: true, data: cursos });
  } catch (error) {
    console.error('❌ Error obteniendo cursos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Obtener servicios corporativos (Grid 3x3)
export async function getServiciosCorporativos(req, res) {
  try {
    const [servicios] = await pool.query(
      'SELECT * FROM servicios_corporativos WHERE disponible = ? ORDER BY posicion',
      [true]
    );
    res.json({ success: true, data: servicios });
  } catch (error) {
    console.error('❌ Error obteniendo servicios corporativos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Obtener información de empresa (MABE)
export async function getInfoEmpresa(req, res) {
  try {
    const [info] = await pool.query(
      'SELECT * FROM info_empresa WHERE empresa = ?',
      ['MABE']
    );
    res.json({ success: true, data: info[0] || null });
  } catch (error) {
    console.error('❌ Error obteniendo info empresa:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Buscar servicio específico
export async function buscarServicio(req, res) {
  try {
    const { nombre } = req.query;
    if (!nombre) {
      return res.status(400).json({ success: false, error: 'Nombre es requerido' });
    }
    const servicio = await buscarServicioPorNombre(nombre);
    res.json({ success: true, data: servicio });
  } catch (error) {
    console.error('❌ Error buscando servicio:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Estadísticas generales
export async function getEstadisticasMayia(req, res) {
  try {
    const stats = await obtenerEstadisticasServicios();
    const [totalCursos] = await pool.query(
      'SELECT COUNT(*) as total FROM cursos_academia WHERE disponible = ?',
      [true]
    );
    
    res.json({
      success: true,
      data: {
        ...stats,
        total_cursos: totalCursos[0].total
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
