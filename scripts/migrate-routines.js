require('dotenv').config();

const mysql = require('mysql2/promise');

const connectionConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

const triggers = [
  {
    name: 'trg_actualizar_estado_propuesta',
    create: `CREATE TRIGGER trg_actualizar_estado_propuesta
      AFTER INSERT ON ventas
      FOR EACH ROW
      BEGIN
        UPDATE propuestas
        SET estado = 'Aceptada'
        WHERE id_cliente = NEW.id_cliente AND estado = 'Pendiente';
      END`
  },
  {
    name: 'trg_calcular_subtotal_detalle',
    create: `CREATE TRIGGER trg_calcular_subtotal_detalle
      BEFORE INSERT ON detalle_venta
      FOR EACH ROW
      BEGIN
        DECLARE v_precio DECIMAL(10,2);
        SELECT precio INTO v_precio FROM servicios WHERE id_servicio = NEW.id_servicio;
        SET NEW.subtotal = NEW.cantidad * v_precio;
      END`
  },
  {
    name: 'trg_auditar_eliminacion_venta',
    create: `CREATE TRIGGER trg_auditar_eliminacion_venta
      AFTER DELETE ON ventas
      FOR EACH ROW
      BEGIN
        INSERT INTO auditoria_ventas (id_venta_eliminada, valor_total)
        VALUES (OLD.id_venta, OLD.valor_total);
      END`
  },
  {
    name: 'trg_validar_correo_cliente',
    create: `CREATE TRIGGER trg_validar_correo_cliente
      BEFORE INSERT ON clientes
      FOR EACH ROW
      BEGIN
        SET NEW.correo = LOWER(TRIM(NEW.correo));
        IF NEW.correo IS NULL OR NEW.correo NOT REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$' THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El correo del cliente no es válido';
        END IF;
      END`
  },
  {
    name: 'trg_validar_correo_cliente_update',
    create: `CREATE TRIGGER trg_validar_correo_cliente_update
      BEFORE UPDATE ON clientes
      FOR EACH ROW
      BEGIN
        SET NEW.correo = LOWER(TRIM(NEW.correo));
        IF NEW.correo IS NULL OR NEW.correo NOT REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$' THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El correo del cliente no es válido';
        END IF;
      END`
  },
  {
    name: 'trg_actualizar_total_venta',
    create: `CREATE TRIGGER trg_actualizar_total_venta
      AFTER INSERT ON detalle_venta
      FOR EACH ROW
      BEGIN
        UPDATE ventas
        SET valor_total = (
          SELECT SUM(subtotal) FROM detalle_venta WHERE id_venta = NEW.id_venta
        )
        WHERE id_venta = NEW.id_venta;
      END`
  }
];

const procedures = [
  {
    name: 'sp_reporte_ventas_mensual',
    create: `CREATE PROCEDURE sp_reporte_ventas_mensual(IN p_mes INT, IN p_anio INT)
      BEGIN
        SELECT v.id_venta, c.nombre_empresa AS Cliente, u.nombre AS Vendedor,
               v.fecha_venta, v.valor_total
        FROM ventas v
        INNER JOIN clientes c ON v.id_cliente = c.id_cliente
        INNER JOIN usuarios u ON v.id_usuario = u.id_usuario
        WHERE MONTH(v.fecha_venta) = p_mes AND YEAR(v.fecha_venta) = p_anio;
      END`
  },
  {
    name: 'sp_top_clientes_compras',
    create: `CREATE PROCEDURE sp_top_clientes_compras()
      BEGIN
        SELECT c.nombre_empresa, COUNT(v.id_venta) AS total_compras,
               SUM(v.valor_total) AS monto_total
        FROM clientes c
        INNER JOIN ventas v ON c.id_cliente = v.id_cliente
        GROUP BY c.id_cliente, c.nombre_empresa
        ORDER BY monto_total DESC
        LIMIT 10;
      END`
  },
  {
    name: 'sp_historial_cliente',
    create: `CREATE PROCEDURE sp_historial_cliente(IN p_id_cliente INT, IN p_id_usuario INT)
      BEGIN
        SELECT v.id_venta AS id_registro, 'Venta' AS Tipo_Registro, v.fecha_venta AS Fecha,
               CONCAT('Venta por valor de ', v.valor_total) AS Detalle, u.nombre AS Responsable
        FROM ventas v
        INNER JOIN usuarios u ON v.id_usuario = u.id_usuario
        WHERE v.id_cliente = p_id_cliente
          AND (p_id_usuario IS NULL OR v.id_usuario = p_id_usuario)
        UNION ALL
        SELECT s.id_seguimiento, 'Seguimiento', s.fecha, s.descripcion, u.nombre
        FROM seguimiento_clientes s
        INNER JOIN usuarios u ON s.id_usuario = u.id_usuario
        WHERE s.id_cliente = p_id_cliente
          AND (p_id_usuario IS NULL OR s.id_usuario = p_id_usuario)
        UNION ALL
        SELECT a.id_actividad, 'Actividad web', a.fecha, a.accion, u.nombre
        FROM actividades_web a
        INNER JOIN usuarios u ON a.id_usuario = u.id_usuario
        WHERE a.id_cliente = p_id_cliente
        ORDER BY Fecha DESC, id_registro DESC;
      END`
  },
  {
    name: 'sp_servicios_mas_vendidos',
    create: `CREATE PROCEDURE sp_servicios_mas_vendidos()
      BEGIN
        SELECT s.nombre_servicio, SUM(dv.cantidad) AS total_vendido,
               SUM(dv.subtotal) AS ingresos_generados
        FROM servicios s
        INNER JOIN detalle_venta dv ON s.id_servicio = dv.id_servicio
        GROUP BY s.id_servicio, s.nombre_servicio
        ORDER BY total_vendido DESC
        LIMIT 10;
      END`
  },
  {
    name: 'sp_registrar_venta_completa',
    create: `CREATE PROCEDURE sp_registrar_venta_completa(
        IN p_id_cliente INT,
        IN p_id_usuario INT,
        IN p_id_servicio INT,
        IN p_cantidad INT,
        OUT p_mensaje VARCHAR(100),
        OUT p_id_venta INT
      )
      proc: BEGIN
        DECLARE v_id_venta INT;
        DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
          ROLLBACK;
          SET p_mensaje = 'Error: Transacción revertida (ROLLBACK).';
          SET p_id_venta = NULL;
        END;

        SET p_mensaje = NULL;
        SET p_id_venta = NULL;
        IF p_id_cliente IS NULL OR p_id_usuario IS NULL OR p_id_servicio IS NULL
          OR p_cantidad IS NULL OR p_cantidad <= 0 THEN
          SET p_mensaje = 'Error: Los datos de venta y una cantidad positiva son obligatorios.';
          LEAVE proc;
        END IF;

        START TRANSACTION;
        INSERT INTO ventas (fecha_venta, valor_total, id_cliente, id_usuario)
        VALUES (CURDATE(), 0, p_id_cliente, p_id_usuario);
        SET v_id_venta = LAST_INSERT_ID();

        INSERT INTO detalle_venta (id_venta, id_servicio, cantidad, subtotal)
        VALUES (v_id_venta, p_id_servicio, p_cantidad, 0);

        COMMIT;
        SET p_mensaje = 'Venta registrada exitosamente.';
        SET p_id_venta = v_id_venta;
      END`
  }
];

async function ensureActivityClientColumn(connection) {
  const [columns] = await connection.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'actividades_web' AND column_name = 'id_cliente'`
  );
  if (columns.length === 0) {
    await connection.query('ALTER TABLE actividades_web ADD COLUMN id_cliente INT NULL AFTER id_usuario');
  }

  const [constraints] = await connection.query(
    `SELECT 1 FROM information_schema.key_column_usage
     WHERE table_schema = DATABASE() AND table_name = 'actividades_web'
       AND column_name = 'id_cliente' AND referenced_table_name = 'clientes'`
  );
  if (constraints.length === 0) {
    await connection.query(
      `ALTER TABLE actividades_web
       ADD CONSTRAINT fk_actividades_web_cliente
       FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente)
       ON DELETE SET NULL ON UPDATE CASCADE`
    );
  }
}

async function applyMigration(connection) {
  await ensureActivityClientColumn(connection);

  for (const trigger of triggers) {
    await connection.query(`DROP TRIGGER IF EXISTS \`${trigger.name}\``);
    await connection.query(trigger.create);
  }

  for (const procedure of procedures) {
    await connection.query(`DROP PROCEDURE IF EXISTS \`${procedure.name}\``);
    await connection.query(procedure.create);
  }
}

async function main() {
  const connection = await mysql.createConnection(connectionConfig);
  try {
    await applyMigration(connection);
    console.log(`Migración aplicada a ${process.env.DB_NAME}: 6 triggers y 5 procedimientos.`);
  } finally {
    await connection.end();
  }
}

module.exports = { applyMigration };

if (require.main === module) {
  main().catch((error) => {
    console.error('Falló la migración de triggers/procedimientos:', error.message);
    process.exitCode = 1;
  });
}
