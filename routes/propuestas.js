const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verificarRol, ROLES } = require('./auth');

const rolesPropuestas = [ROLES.ADMINISTRADOR, ROLES.VENDEDOR];
const rolesConsultaPropuestas = [...rolesPropuestas, ROLES.SOPORTE];

router.get('/', verificarRol(rolesConsultaPropuestas), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.id_propuesta, p.fecha_propuesta, p.valor_total, p.estado,
             c.nombre_empresa AS cliente,
             s.nombre_servicio AS servicio
      FROM propuestas p
      INNER JOIN clientes c ON p.id_cliente = c.id_cliente
      INNER JOIN servicios s ON p.id_servicio = s.id_servicio
      ORDER BY p.id_propuesta DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', verificarRol(rolesPropuestas), async (req, res) => {
  try {
    const { fecha_propuesta, valor_total, id_cliente, id_servicio, estado } = req.body;

    if (!fecha_propuesta || !valor_total || !id_cliente || !id_servicio) {
      return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios' });
    }

    const estadoPropuesta = estado || 'Pendiente';

    await pool.query(
      'INSERT INTO propuestas (fecha_propuesta, valor_total, id_cliente, id_servicio, estado) VALUES (?, ?, ?, ?, ?)',
      [fecha_propuesta, valor_total, id_cliente, id_servicio, estadoPropuesta]
    );
    res.status(201).json({ success: true, mensaje: 'Propuesta creada exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', verificarRol(rolesPropuestas), async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado || !['Pendiente', 'Aceptada', 'Rechazada'].includes(estado)) {
      return res.status(400).json({ success: false, error: 'Estado debe ser: Pendiente, Aceptada o Rechazada' });
    }

    await pool.query('UPDATE propuestas SET estado = ? WHERE id_propuesta = ?', [estado, id]);
    res.json({ success: true, mensaje: 'Propuesta actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', verificarRol([ROLES.ADMINISTRADOR]), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM propuestas WHERE id_propuesta = ?', [id]);
    res.json({ success: true, mensaje: 'Propuesta eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;