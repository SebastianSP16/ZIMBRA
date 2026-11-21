const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verificarRol, ROLES } = require('./auth');

const rolesSeguimiento = [ROLES.ADMINISTRADOR, ROLES.VENDEDOR, ROLES.SOPORTE];

router.get('/', verificarRol(rolesSeguimiento), async (req, res) => {
  try {
    const { id_cliente } = req.query;
    const rolUsuario = req.headers['x-user-role'];
    const idUsuario = req.headers['x-user-id'];
    if (rolUsuario === ROLES.VENDEDOR && !idUsuario) {
      return res.status(400).json({ success: false, error: 'Se requiere el ID del vendedor' });
    }

    let query = `
      SELECT s.id_seguimiento, s.fecha, s.descripcion, s.tipo_contacto,
             c.nombre_empresa AS cliente,
             u.nombre AS usuario
      FROM seguimiento_clientes s
      INNER JOIN clientes c ON s.id_cliente = c.id_cliente
      INNER JOIN usuarios u ON s.id_usuario = u.id_usuario
    `;
    const params = [];
    const conditions = [];

    if (id_cliente) {
      conditions.push('s.id_cliente = ?');
      params.push(id_cliente);
    }

    if (rolUsuario === ROLES.VENDEDOR && idUsuario) {
      conditions.push('s.id_usuario = ?');
      params.push(idUsuario);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY s.id_seguimiento DESC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', verificarRol(rolesSeguimiento), async (req, res) => {
  try {
    const { fecha, descripcion, tipo_contacto, id_cliente, id_usuario } = req.body;

    if (!fecha || !descripcion || !tipo_contacto || !id_cliente || !id_usuario) {
      return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios' });
    }

    await pool.query(
      'INSERT INTO seguimiento_clientes (fecha, descripcion, tipo_contacto, id_cliente, id_usuario) VALUES (?, ?, ?, ?, ?)',
      [fecha, descripcion, tipo_contacto, id_cliente, id_usuario]
    );
    res.status(201).json({ success: true, mensaje: 'Seguimiento registrado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;