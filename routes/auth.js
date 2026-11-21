const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');

const ROLES = {
  ADMINISTRADOR: 'Administrador',
  VENDEDOR: 'Vendedor',
  SOPORTE: 'Soporte'
};

const ROLES_PERMITIDOS = Object.values(ROLES);

function verificarRol(rolesPermitidos) {
  return (req, res, next) => {
    const rolUsuario = req.headers['x-user-role'] || req.user?.rol;
    if (!rolUsuario || !rolesPermitidos.includes(rolUsuario)) {
      return res.status(403).json({ success: false, error: 'Acceso denegado: rol no autorizado' });
    }
    req.user = {
      ...(req.user || {}),
      rol: rolUsuario,
      id_usuario: req.headers['x-user-id'] || req.user?.id_usuario || null
    };
    next();
  };
}

router.post('/login', async (req, res) => {
  try {
    const { clave, contrasena } = req.body;

    if (clave) {
      const claveMap = { ADM: { rol: ROLES.ADMINISTRADOR, id_rol: 1 }, USU: { rol: ROLES.VENDEDOR, id_rol: 2 }, SUP: { rol: ROLES.SOPORTE, id_rol: 3 } };
      const prefijo = clave.substring(0, 3);
      const numero = clave.substring(3);
      if (!claveMap[prefijo]) return res.status(400).json({ success: false, error: 'Formato de clave inválido' });
      const mapa = claveMap[prefijo];
      const [usuarios] = await pool.query('SELECT u.id_usuario, u.nombre, u.correo, u.contrasena, u.estado, u.id_rol, r.nombre_rol AS rol FROM usuarios u INNER JOIN roles r ON u.id_rol = r.id_rol WHERE r.nombre_rol = ? AND u.id_usuario = ?', [mapa.rol, parseInt(numero) || 1]);
      if (usuarios.length === 0) return res.status(401).json({ success: false, error: 'Credenciales inválidas - clave no registrada' });
      const usuario = usuarios[0];
      if (usuario.estado !== 'Activo') return res.status(401).json({ success: false, error: 'Usuario inactivo' });
      const valido = await bcrypt.compare(contrasena, usuario.contrasena);
      if (!valido) return res.status(401).json({ success: false, error: 'Credenciales inválidas - contraseña incorrecta' });
      await pool.query('INSERT INTO actividades_web (fecha, accion, id_usuario) VALUES (CURDATE(), "Inicio de sesión", ?)', [usuario.id_usuario]);
      res.json({ success: true, mensaje: 'Inicio de sesión exitoso', usuario: { id_usuario: usuario.id_usuario, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol, id_rol: usuario.id_rol } });
    } else if (req.body.correo) {
      const { correo, contrasena } = req.body;
      if (!correo || !contrasena) return res.status(400).json({ success: false, error: 'Correo y contraseña son obligatorios' });
      const [usuarios] = await pool.query('SELECT u.id_usuario, u.nombre, u.correo, u.contrasena, u.estado, u.id_rol, r.nombre_rol AS rol FROM usuarios u INNER JOIN roles r ON u.id_rol = r.id_rol WHERE u.correo = ?', [correo]);
      if (usuarios.length === 0) return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
      const usuario = usuarios[0];
      if (usuario.estado !== 'Activo') return res.status(401).json({ success: false, error: 'Usuario inactivo' });
      const valido = await bcrypt.compare(contrasena, usuario.contrasena);
      if (!valido) return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
      await pool.query('INSERT INTO actividades_web (fecha, accion, id_usuario) VALUES (CURDATE(), "Inicio de sesión", ?)', [usuario.id_usuario]);
      res.json({ success: true, mensaje: 'Inicio de sesión exitoso', usuario: { id_usuario: usuario.id_usuario, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol, id_rol: usuario.id_rol } });
    } else {
      return res.status(400).json({ success: false, error: 'Use formato clave o correo y contraseña' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/perfil', verificarRol(ROLES_PERMITIDOS), async (req, res) => {
  const correoUsuario = req.headers['x-user-email'];
  const [usuarios] = await pool.query('SELECT u.id_usuario, u.nombre, u.correo, u.estado, u.id_rol, r.nombre_rol AS rol FROM usuarios u INNER JOIN roles r ON u.id_rol = r.id_rol WHERE u.correo = ?', [correoUsuario]);
  if (usuarios.length === 0) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
  res.json({ success: true, data: usuarios[0] });
});

module.exports = { router, verificarRol, ROLES, ROLES_PERMITIDOS };
