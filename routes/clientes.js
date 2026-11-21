const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verificarRol, ROLES } = require('./auth');

const rolesClientes = [ROLES.ADMINISTRADOR, ROLES.VENDEDOR, ROLES.SOPORTE];
const formatoCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/', verificarRol(rolesClientes), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id_cliente, nombre_empresa, correo, telefono, direccion, fecha_registro FROM clientes ORDER BY id_cliente DESC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', verificarRol(rolesClientes), async (req, res) => {
  try {
    const { nombre_empresa, telefono, direccion } = req.body;
    const correo = typeof req.body.correo === 'string' ? req.body.correo.trim().toLowerCase() : '';

    if (!nombre_empresa || !correo) {
      return res.status(400).json({ success: false, error: 'El nombre de la empresa y el correo son obligatorios' });
    }
    if (!formatoCorreo.test(correo)) {
      return res.status(400).json({ success: false, error: 'El formato del correo no es válido' });
    }

    const [existe] = await pool.query('SELECT id_cliente FROM clientes WHERE correo = ?', [correo]);
    if (existe.length > 0) {
      return res.status(400).json({ success: false, error: 'El correo ya está registrado en el sistema' });
    }

    await pool.query(
      'INSERT INTO clientes (nombre_empresa, correo, telefono, direccion, fecha_registro) VALUES (?, ?, ?, ?, CURDATE())',
      [nombre_empresa, correo, telefono, direccion]
    );
    res.status(201).json({ success: true, mensaje: 'Cliente creado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', verificarRol(rolesClientes), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_empresa, telefono, direccion } = req.body;
    const correo = typeof req.body.correo === 'string' ? req.body.correo.trim().toLowerCase() : '';

    if (!nombre_empresa || !correo) {
      return res.status(400).json({ success: false, error: 'El nombre de la empresa y el correo son obligatorios' });
    }
    if (!formatoCorreo.test(correo)) {
      return res.status(400).json({ success: false, error: 'El formato del correo no es válido' });
    }

    const [duplicado] = await pool.query('SELECT id_cliente FROM clientes WHERE correo = ? AND id_cliente != ?', [correo, id]);
    if (duplicado.length > 0) {
      return res.status(400).json({ success: false, error: 'El correo ya está registrado en el sistema' });
    }

    await pool.query(
      'UPDATE clientes SET nombre_empresa = ?, correo = ?, telefono = ?, direccion = ? WHERE id_cliente = ?',
      [nombre_empresa, correo, telefono, direccion, id]
    );
    res.json({ success: true, mensaje: 'Cliente actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/descargar-prueba', async (req, res) => {
  try {
    const { id } = req.params;
    const [columnas] = await pool.query("SHOW COLUMNS FROM clientes LIKE 'fecha_descarga_prueba'");

    if (columnas.length === 0) {
      await pool.query('ALTER TABLE clientes ADD COLUMN fecha_descarga_prueba DATE NULL');
    }

    const [clientes] = await pool.query('SELECT id_cliente, fecha_descarga_prueba FROM clientes WHERE id_cliente = ?', [id]);

    if (clientes.length === 0) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }

    const yaDescargo = clientes[0].fecha_descarga_prueba;
    if (yaDescargo) {
      return res.status(200).json({ success: true, mensaje: 'El cliente ya descargó la versión de prueba anteriormente', fecha_descarga_prueba: yaDescargo });
    }

    await pool.query('UPDATE clientes SET fecha_descarga_prueba = CURDATE() WHERE id_cliente = ?', [id]);

    const [usuarios] = await pool.query('SELECT id_usuario FROM usuarios LIMIT 1');
    if (usuarios.length > 0) {
      await pool.query(
        'INSERT INTO actividades_web (fecha, accion, id_usuario, id_cliente) VALUES (CURDATE(), ?, ?, ?)',
        ['Descarga de prueba 60 días', usuarios[0].id_usuario, clientes[0].id_cliente]
      );
    }

    res.status(200).json({ success: true, mensaje: 'Descarga de prueba registrada correctamente', fecha_descarga_prueba: new Date().toISOString().slice(0, 10) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', verificarRol([ROLES.ADMINISTRADOR]), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM clientes WHERE id_cliente = ?', [id]);
    res.json({ success: true, mensaje: 'Cliente eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;