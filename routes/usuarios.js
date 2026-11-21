const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const { verificarRol, ROLES } = require('./auth');

router.get('/', verificarRol([ROLES.ADMINISTRADOR]), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id_usuario, u.nombre, u.correo, u.estado, u.id_rol,
             r.nombre_rol AS rol
      FROM usuarios u
      INNER JOIN roles r ON u.id_rol = r.id_rol
      ORDER BY u.id_usuario DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', verificarRol([ROLES.ADMINISTRADOR]), async (req, res) => {
  try {
    const { nombre, correo, contrasena, id_rol } = req.body;

    if (!nombre || !correo || !contrasena || !id_rol) {
      return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios' });
    }

    const [correoDuplicado] = await pool.query('SELECT id_usuario FROM usuarios WHERE correo = ?', [correo]);
    if (correoDuplicado.length > 0) {
      return res.status(400).json({ success: false, error: 'El correo ya está registrado en el sistema' });
    }

    const [rol] = await pool.query('SELECT id_rol FROM roles WHERE id_rol = ?', [id_rol]);
    if (rol.length === 0) {
      return res.status(400).json({ success: false, error: 'El rol seleccionado no existe' });
    }

    const hashContrasena = await bcrypt.hash(contrasena, 10);

    await pool.query(
      'INSERT INTO usuarios (nombre, correo, contrasena, estado, id_rol) VALUES (?, ?, ?, "Activo", ?)',
      [nombre, correo, hashContrasena, id_rol]
    );
    res.status(201).json({ success: true, mensaje: 'Usuario creado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', verificarRol([ROLES.ADMINISTRADOR]), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, correo, estado, id_rol, contrasena } = req.body;

    if (!nombre || !correo || !estado || !id_rol) {
      return res.status(400).json({ success: false, error: 'Nombre, correo, estado y rol son obligatorios' });
    }

    const [correoDuplicado] = await pool.query('SELECT id_usuario FROM usuarios WHERE correo = ? AND id_usuario != ?', [correo, id]);
    if (correoDuplicado.length > 0) {
      return res.status(400).json({ success: false, error: 'El correo ya está registrado en el sistema' });
    }

    if (contrasena) {
      const hashContrasena = await bcrypt.hash(contrasena, 10);
      await pool.query(
        'UPDATE usuarios SET nombre = ?, correo = ?, estado = ?, id_rol = ?, contrasena = ? WHERE id_usuario = ?',
        [nombre, correo, estado, id_rol, hashContrasena, id]
      );
    } else {
      await pool.query(
        'UPDATE usuarios SET nombre = ?, correo = ?, estado = ?, id_rol = ? WHERE id_usuario = ?',
        [nombre, correo, estado, id_rol, id]
      );
    }

    res.json({ success: true, mensaje: 'Usuario actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', verificarRol([ROLES.ADMINISTRADOR]), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM usuarios WHERE id_usuario = ?', [id]);
    res.json({ success: true, mensaje: 'Usuario eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;