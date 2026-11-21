const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verificarRol, ROLES } = require('./auth');

const rolesReportes = [ROLES.ADMINISTRADOR, ROLES.VENDEDOR];
const rolesSeguimientoReporte = [...rolesReportes, ROLES.SOPORTE];
const rolesActividadWeb = [ROLES.ADMINISTRADOR, ROLES.SOPORTE];

router.get('/top-clientes', verificarRol([ROLES.ADMINISTRADOR]), async (req, res) => {
  try {
    const [rows] = await pool.query('CALL sp_top_clientes_compras()');
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/servicios-vendidos', verificarRol(rolesReportes), async (req, res) => {
  try {
    const [rows] = await pool.query('CALL sp_servicios_mas_vendidos()');
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/ventas-mensuales', verificarRol([ROLES.ADMINISTRADOR]), async (req, res) => {
  try {
    const { mes, anio } = req.query;

    if (!mes || !anio) {
      return res.status(400).json({ success: false, error: 'Se requieren los parámetros mes y anio' });
    }

    const [rows] = await pool.query('CALL sp_reporte_ventas_mensual(?, ?)', [mes, anio]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/ventas-rango-fechas', verificarRol(rolesReportes), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const rolUsuario = req.headers['x-user-role'];
    const idUsuario = req.headers['x-user-id'];

    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({ success: false, error: 'Se requieren fecha_inicio y fecha_fin' });
    }
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
      WHERE v.fecha_venta BETWEEN ? AND ?
    `;
    const params = [fecha_inicio, fecha_fin];

    if (rolUsuario === ROLES.VENDEDOR && idUsuario) {
      query += ' AND v.id_usuario = ?';
      params.push(idUsuario);
    }

    query += ' ORDER BY v.fecha_venta DESC';
    const [rows] = await pool.query(query, params);

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/ventas-vendedor', verificarRol(rolesReportes), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const rolUsuario = req.headers['x-user-role'];
    const idUsuario = req.headers['x-user-id'];
    if (rolUsuario === ROLES.VENDEDOR && !idUsuario) {
      return res.status(400).json({ success: false, error: 'Se requiere el ID del vendedor' });
    }

    let query = `
      SELECT u.id_usuario, u.nombre AS vendedor,
             COUNT(v.id_venta) AS total_ventas,
             SUM(v.valor_total) AS monto_total
      FROM usuarios u
      INNER JOIN ventas v ON u.id_usuario = v.id_usuario
    `;
    const params = [];

    if (fecha_inicio && fecha_fin) {
      query += ' WHERE v.fecha_venta BETWEEN ? AND ?';
      params.push(fecha_inicio, fecha_fin);
    }

    if (rolUsuario === ROLES.VENDEDOR && idUsuario) {
      const hasWhere = query.includes('WHERE');
      query += hasWhere ? ' AND v.id_usuario = ?' : ' WHERE v.id_usuario = ?';
      params.push(idUsuario);
    }

    query += ' GROUP BY u.id_usuario, u.nombre ORDER BY monto_total DESC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/propuestas-estado', verificarRol(rolesReportes), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT estado, COUNT(*) AS cantidad, SUM(valor_total) AS monto_total
      FROM propuestas
      GROUP BY estado
      ORDER BY cantidad DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/seguimiento-cliente', verificarRol(rolesSeguimientoReporte), async (req, res) => {
  try {
    const { id_cliente } = req.query;
    const rolUsuario = req.headers['x-user-role'];
    const idUsuario = req.headers['x-user-id'];

    if (!id_cliente) {
      return res.status(400).json({ success: false, error: 'Se requiere el parámetro id_cliente' });
    }
    if (rolUsuario === ROLES.VENDEDOR && !idUsuario) {
      return res.status(400).json({ success: false, error: 'Se requiere el ID del vendedor' });
    }

    const params = [id_cliente];
    let filtroUsuario = '';
    if (rolUsuario === ROLES.VENDEDOR) {
      filtroUsuario = ' AND s.id_usuario = ?';
      params.push(idUsuario);
    }

    const [rows] = await pool.query(`
      SELECT s.id_seguimiento, s.fecha, s.descripcion, s.tipo_contacto,
             u.nombre AS usuario
      FROM seguimiento_clientes s
      INNER JOIN usuarios u ON s.id_usuario = u.id_usuario
      WHERE s.id_cliente = ?${filtroUsuario}
      ORDER BY s.fecha DESC
    `, params);

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/historial-cliente', verificarRol(rolesSeguimientoReporte), async (req, res) => {
  try {
    const { id_cliente } = req.query;
    const rolUsuario = req.headers['x-user-role'];
    const idUsuario = req.headers['x-user-id'];

    if (!id_cliente) {
      return res.status(400).json({ success: false, error: 'Se requiere el parámetro id_cliente' });
    }
    if (rolUsuario === ROLES.VENDEDOR && !idUsuario) {
      return res.status(400).json({ success: false, error: 'Se requiere el ID del vendedor' });
    }

    const idUsuarioFiltro = rolUsuario === ROLES.VENDEDOR ? idUsuario : null;
    const [rows] = await pool.query('CALL sp_historial_cliente(?, ?)', [id_cliente, idUsuarioFiltro]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/actividad-web', verificarRol(rolesActividadWeb), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    let query = `
      SELECT a.accion, COUNT(*) AS cantidad, a.fecha
      FROM actividades_web a
    `;
    const params = [];

    if (fecha_inicio && fecha_fin) {
      query += ' WHERE a.fecha BETWEEN ? AND ?';
      params.push(fecha_inicio, fecha_fin);
    }

    query += ' GROUP BY a.accion, a.fecha ORDER BY a.fecha DESC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;