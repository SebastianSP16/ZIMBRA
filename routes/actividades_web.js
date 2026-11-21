const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verificarRol, ROLES } = require('./auth');

router.get('/', verificarRol([ROLES.ADMINISTRADOR, ROLES.SOPORTE]), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, accion } = req.query;

    let query = `
      SELECT a.id_actividad, a.fecha, a.accion, a.id_usuario, u.nombre AS usuario,
             a.id_cliente, c.nombre_empresa AS cliente
      FROM actividades_web a
      INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
      LEFT JOIN clientes c ON a.id_cliente = c.id_cliente
    `;
    const params = [];
    const conditions = [];

    if (fecha_inicio && fecha_fin) {
      conditions.push('a.fecha BETWEEN ? AND ?');
      params.push(fecha_inicio, fecha_fin);
    }
    if (accion) {
      conditions.push('a.accion = ?');
      params.push(accion);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY a.id_actividad DESC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', verificarRol([ROLES.ADMINISTRADOR]), async (req, res) => {
  try {
    const { fecha, accion, id_usuario, id_cliente } = req.body;

    if (!fecha || !accion || !id_usuario) {
      return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios' });
    }

    if (id_cliente) {
      const [clientes] = await pool.query('SELECT id_cliente FROM clientes WHERE id_cliente = ?', [id_cliente]);
      if (clientes.length === 0) {
        return res.status(400).json({ success: false, error: 'El cliente seleccionado no existe' });
      }
    }

    await pool.query(
      'INSERT INTO actividades_web (fecha, accion, id_usuario, id_cliente) VALUES (?, ?, ?, ?)',
      [fecha, accion, id_usuario, id_cliente || null]
    );
    res.status(201).json({ success: true, mensaje: 'Actividad web registrada exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;