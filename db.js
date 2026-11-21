const mysql = require('mysql2/promise');
require('dotenv').config();

// Crear pool de conexiones a MySQL usando las variables de entorno
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'proyecto_zimbra',
  connectionLimit: 10
});

// Verificar la conexión al iniciar y mostrar mensaje exacto en consola
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Conexión exitosa a la base de datos MySQL (proyecto_zimbra)');
    connection.release();
  } catch (error) {
    console.error(' Error al conectar a la base de datos:', error.message);
    process.exit(1);
  }
})();

module.exports = pool;