import { generarRespuestaIA } from '../services/geminiService.js';
import { buscarContextoEnDB } from '../services/dbService.js';

export async function enviarMensaje(req, res) {
  try {
    const { mensaje, departamento } = req.body;
    console.log('BODY RECIBIDO:', req.body);
    if (!mensaje) {
      return res.status(400).json({ error: 'El mensaje es requerido' });
    }

    console.log(`💬 Mensaje recibido: "${mensaje}"`);
    console.log(`📂 Departamento: ${departamento || 'general'}`);

    // 1. Buscar contexto en la base de datos
    const contexto = await buscarContextoEnDB(mensaje, departamento);

    // 2. Generar respuesta con Gemini
    const respuesta = await generarRespuestaIA(mensaje, contexto, departamento);

    res.json({
      success: true,
      respuesta: respuesta,
      contexto: contexto ? 'Información encontrada en la base de datos' : 'Respuesta general',
      timestamp: new Date()
    });

  } catch (error) {
    console.error('❌ Error en chat:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar el mensaje',
      details: error.message
    });
  }
}
