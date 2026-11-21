require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Ruta raíz — redirige al login
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Rutas de autenticación
app.use('/api/auth', require('./routes/auth').router);

// Rutas de la API
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/servicios', require('./routes/servicios'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/propuestas', require('./routes/propuestas'));
app.use('/api/actividades-web', require('./routes/actividades_web'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/seguimiento', require('./routes/seguimiento_clientes'));
app.use('/api/reportes', require('./routes/reportes'));

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});