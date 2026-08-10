import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  let connection;
  
  try {
    console.log('🔄 Conectando a MySQL...');
    
    // Conectar sin seleccionar base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
      multipleStatements: true
    });

    console.log('✅ Conectado a MySQL');

    // Leer el archivo SQL
    const sqlFile = path.join(__dirname, '../data/demo-data.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('📝 Ejecutando migraciones...');

    // Ejecutar el SQL
    await connection.query(sql);

    console.log('✅ Migraciones completadas exitosamente!');
    console.log('\n📊 Tablas creadas:');
    console.log('   - departamentos');
    console.log('   - servicios');
    console.log('   - cursos_academia');
    console.log('   - servicios_corporativos');
    console.log('   - info_empresa');
    console.log('   - empleados');
    console.log('   - presupuestos');
    console.log('   - ventas');
    console.log('   - inventario');
    console.log('   - tickets_ti');

  } catch (error) {
    console.error('❌ Error ejecutando migraciones:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar migración
migrate()
  .then(() => {
    console.log('\n🎉 Base de datos lista para usar!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
