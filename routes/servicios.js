const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verificarRol, ROLES } = require('./auth');

const rolesServicios = [ROLES.ADMINISTRADOR, ROLES.VENDEDOR, ROLES.SOPORTE];

router.get('/', verificarRol(rolesServicios), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM servicios ORDER BY id_servicio DESC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', verificarRol([ROLES.ADMINISTRADOR]), async (req, res) => {
  try {
    const { nombre_servicio, descripcion, precio, estado } = req.body;

    if (!nombre_servicio || !precio) {
      return res.status(400).json({ success: false, error: 'El nombre del servicio y el precio son obligatorios' });
    }

    const estadoServicio = estado || 'Activo';

    await pool.query(
      'INSERT INTO servicios (nombre_servicio, descripcion, precio, estado) VALUES (?, ?, ?, ?)',
      [nombre_servicio, descripcion, precio, estadoServicio]
    );
    res.status(201).json({ success: true, mensaje: 'Servicio creado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', verificarRol([ROLES.ADMINISTRADOR]), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_servicio, descripcion, precio, estado } = req.body;

    if (!nombre_servicio || !precio) {
      return res.status(400).json({ success: false, error: 'El nombre del servicio y el precio son obligatorios' });
    }

    await pool.query(
      'UPDATE servicios SET nombre_servicio = ?, descripcion = ?, precio = ?, estado = ? WHERE id_servicio = ?',
      [nombre_servicio, descripcion, precio, estado, id]
    );
    res.json({ success: true, mensaje: 'Servicio actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', verificarRol([ROLES.ADMINISTRADOR]), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM servicios WHERE id_servicio = ?', [id]);
    res.json({ success: true, mensaje: 'Servicio eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;