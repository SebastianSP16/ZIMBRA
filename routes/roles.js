const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verificarRol, ROLES } = require('./auth');

router.get('/', verificarRol([ROLES.ADMINISTRADOR]), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM roles ORDER BY id_rol');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', verificarRol([ROLES.ADMINISTRADOR]), async (req, res) => {
  try {
    const { nombre_rol, descripcion } = req.body;

    if (!nombre_rol) {
      return res.status(400).json({ success: false, error: 'El nombre del rol es obligatorio' });
    }

    await pool.query(
      'INSERT INTO roles (nombre_rol, descripcion) VALUES (?, ?)',
      [nombre_rol, descripcion]
    );
    res.status(201).json({ success: true, mensaje: 'Rol creado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', verificarRol([ROLES.ADMINISTRADOR]), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_rol, descripcion } = req.body;

    if (!nombre_rol) {
      return res.status(400).json({ success: false, error: 'El nombre del rol es obligatorio' });
    }

    await pool.query(
      'UPDATE roles SET nombre_rol = ?, descripcion = ? WHERE id_rol = ?',
      [nombre_rol, descripcion, id]
    );
    res.json({ success: true, mensaje: 'Rol actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', verificarRol([ROLES.ADMINISTRADOR]), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM roles WHERE id_rol = ?', [id]);
    res.json({ success: true, mensaje: 'Rol eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;