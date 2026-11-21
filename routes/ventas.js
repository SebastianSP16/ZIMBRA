const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verificarRol, ROLES } = require('./auth');

const rolesVentas = [ROLES.ADMINISTRADOR, ROLES.VENDEDOR];
const rolesConsultaVentas = [...rolesVentas, ROLES.SOPORTE];

router.get('/', verificarRol(rolesConsultaVentas), async (req, res) => {
  try {
    const rolUsuario = req.headers['x-user-role'];
    const idUsuario = req.headers['x-user-id'];
    if (rolUsuario === ROLES.VENDEDOR && !idUsuario) {
      return res.status(400).json({ success: false, error: 'Se requiere el ID del vendedor' });
    }

    let query = `
      SELECT v.id_venta, v.fecha_venta, v.valor_total,
             c.nombre_empresa AS cliente,
             u.nombre AS vendedor
      FROM ventas v
      INNER JOIN clientes c ON v.id_cliente = c.id_cliente
      INNER JOIN usuarios u ON v.id_usuario = u.id_usuario
    `;
    const params = [];

    if (rolUsuario === ROLES.VENDEDOR && idUsuario) {
      query += ' WHERE v.id_usuario = ?';
      params.push(idUsuario);
    }

    query += ' ORDER BY v.id_venta DESC';
    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', verificarRol(rolesVentas), async (req, res) => {
  let connection;
  try {
    const { id_cliente, id_usuario, id_servicio, cantidad } = req.body;

    if (!id_cliente || !id_usuario || !id_servicio || !cantidad) {
      return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios: id_cliente, id_usuario, id_servicio, cantidad' });
    }
    if (!Number.isInteger(Number(cantidad)) || Number(cantidad) <= 0) {
      return res.status(400).json({ success: false, error: 'La cantidad debe ser un entero mayor que cero' });
    }

    connection = await pool.getConnection();
    await connection.query(
      'CALL sp_registrar_venta_completa(?, ?, ?, ?, @mensaje, @id_venta)',
      [id_cliente, id_usuario, id_servicio, cantidad]
    );
    const [mensajeResult] = await connection.query('SELECT @mensaje AS mensaje, @id_venta AS id_venta');
    const { mensaje, id_venta } = mensajeResult[0];

    if (!mensaje || mensaje.startsWith('Error:')) {
      return res.status(400).json({ success: false, error: mensaje || 'No se pudo registrar la venta' });
    }

    res.status(201).json({ success: true, mensaje, id_venta });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;