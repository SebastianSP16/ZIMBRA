require('dotenv').config();

const mysql = require('mysql2/promise');
const { applyMigration } = require('../scripts/migrate-routines');

const config = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
};
const sourceDatabase = process.env.DB_NAME;
const testDatabase = `zimbra_check_${process.pid}_${Date.now()}`;
const tableOrder = [
  'roles',
  'usuarios',
  'clientes',
  'servicios',
  'propuestas',
  'ventas',
  'detalle_venta',
  'seguimiento_clientes',
  'actividades_web',
  'auditoria_ventas'
];
const results = [];

function record(name, passed, detail) {
  results.push({ name, passed, detail });
}

async function main() {
  let admin;
  let source;
  let sandbox;

  try {
    admin = await mysql.createConnection(config);
    await admin.query(`CREATE DATABASE \`${testDatabase}\``);
    source = await mysql.createConnection({ ...config, database: sourceDatabase });
    sandbox = await mysql.createConnection({ ...config, database: testDatabase });

    for (const table of tableOrder) {
      const [rows] = await source.query(`SHOW CREATE TABLE \`${table}\``);
      await sandbox.query(rows[0]['Create Table']);
    }

    const [sourceTriggers] = await source.query(
      `SELECT trigger_name, event_manipulation, event_object_table, action_timing, action_statement
       FROM information_schema.triggers WHERE trigger_schema = ?`,
      [sourceDatabase]
    );
    for (const trigger of sourceTriggers) {
      await sandbox.query(
        `CREATE TRIGGER \`${trigger.TRIGGER_NAME}\` ${trigger.ACTION_TIMING} ${trigger.EVENT_MANIPULATION}
         ON \`${trigger.EVENT_OBJECT_TABLE}\` FOR EACH ROW ${trigger.ACTION_STATEMENT}`
      );
    }

    const [sourceProcedures] = await source.query(
      `SELECT routine_name, routine_definition FROM information_schema.routines
       WHERE routine_schema = ? AND routine_type = 'PROCEDURE'`,
      [sourceDatabase]
    );
    for (const procedure of sourceProcedures) {
      const [rows] = await source.query(`SHOW CREATE PROCEDURE \`${procedure.ROUTINE_NAME}\``);
      await sandbox.query(rows[0]['Create Procedure']);
    }

    await applyMigration(sandbox);
    const [triggers] = await sandbox.query(
      'SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = DATABASE()'
    );
    const [procedures] = await sandbox.query(
      `SELECT routine_name, routine_definition FROM information_schema.routines
       WHERE routine_schema = DATABASE() AND routine_type = 'PROCEDURE'`
    );
    record('Seis triggers instalados', triggers.length === 6, `${triggers.length} encontrados`);
    record('Cinco procedimientos instalados', procedures.length === 5, `${procedures.length} encontrados`);

    await sandbox.query(
      "INSERT INTO roles (id_rol, nombre_rol, descripcion) VALUES (1, 'Prueba', 'Fixture')"
    );
    await sandbox.query(
      `INSERT INTO usuarios (id_usuario, nombre, correo, contrasena, estado, id_rol)
       VALUES (1, 'Usuario de prueba', 'prueba@example.invalid', 'hash-no-utilizable', 'Activo', 1)`
    );
    await sandbox.query(
      `INSERT INTO servicios (id_servicio, nombre_servicio, descripcion, precio, estado)
       VALUES (1, 'Servicio de prueba', 'Fixture', 125.50, 'Activo')`
    );
    await sandbox.query(
      `INSERT INTO clientes (id_cliente, nombre_empresa, correo, fecha_registro)
       VALUES (1, 'Cliente de prueba', 'CLIENTE-TRIGGER@EXAMPLE.INVALID', CURDATE())`
    );

    const [[client]] = await sandbox.query('SELECT id_cliente, correo FROM clientes WHERE id_cliente = 1');
    record(
      'Normaliza el correo al insertar cliente',
      client.correo === 'cliente-trigger@example.invalid',
      client.correo
    );
    await sandbox.query("UPDATE clientes SET correo = 'CLIENTE-EDITADO@EXAMPLE.INVALID' WHERE id_cliente = 1");
    const [[updatedClient]] = await sandbox.query('SELECT correo FROM clientes WHERE id_cliente = 1');
    record(
      'Normaliza el correo al actualizar cliente',
      updatedClient.correo === 'cliente-editado@example.invalid',
      updatedClient.correo
    );
    await sandbox.query(
      `INSERT INTO propuestas (id_propuesta, fecha_propuesta, valor_total, id_cliente, id_servicio, estado)
       VALUES (1, CURDATE(), 125.50, 1, 1, 'Pendiente')`
    );
    await sandbox.query(
      `INSERT INTO seguimiento_clientes (id_seguimiento, fecha, descripcion, tipo_contacto, id_cliente, id_usuario)
       VALUES (1, CURDATE(), 'Contacto de prueba', 'Llamada', 1, 1)`
    );
    await sandbox.query(
      `INSERT INTO actividades_web (id_actividad, fecha, accion, id_usuario, id_cliente)
       VALUES (1, CURDATE(), 'Visita de prueba', 1, 1)`
    );

    await sandbox.query('CALL sp_registrar_venta_completa(1, 1, 1, 3, @mensaje, @id_venta)');
    const [[successMessage]] = await sandbox.query('SELECT @mensaje AS mensaje, @id_venta AS id_venta');
    const [[sale]] = await sandbox.query('SELECT id_venta, valor_total FROM ventas');
    const [[detail]] = await sandbox.query('SELECT cantidad, subtotal FROM detalle_venta');
    const [[proposal]] = await sandbox.query('SELECT estado FROM propuestas WHERE id_propuesta = 1');
    record(
      'Venta, subtotal, total y aceptación de propuesta',
      successMessage.mensaje === 'Venta registrada exitosamente.' &&
        Number(successMessage.id_venta) === Number(sale.id_venta) &&
        Number(detail.cantidad) === 3 &&
        Number(detail.subtotal) === 376.5 &&
        Number(sale.valor_total) === 376.5 &&
        proposal.estado === 'Aceptada',
      successMessage.mensaje
    );

    const [[date]] = await sandbox.query('SELECT MONTH(CURDATE()) AS mes, YEAR(CURDATE()) AS anio');
    const [monthly] = await sandbox.query(
      'CALL sp_reporte_ventas_mensual(?, ?)',
      [date.mes, date.anio]
    );
    const [topCustomers] = await sandbox.query('CALL sp_top_clientes_compras()');
    const [bestServices] = await sandbox.query('CALL sp_servicios_mas_vendidos()');
    record(
      'Procedimientos de reportes devuelven resultados',
      monthly[0].length === 1 && topCustomers[0].length === 1 && bestServices[0].length === 1,
      `mensual=${monthly[0].length}, clientes=${topCustomers[0].length}, servicios=${bestServices[0].length}`
    );

    const [history] = await sandbox.query('CALL sp_historial_cliente(1, NULL)');
    record(
      'Historial incluye actividad web',
      history[0].some((row) => String(row.Tipo_Registro).toLowerCase().includes('actividad web')),
      `${history[0].length} registro(s) de venta, seguimiento y web`
    );

    await sandbox.query('DELETE FROM ventas WHERE id_venta = ?', [sale.id_venta]);
    const [[audit]] = await sandbox.query('SELECT COUNT(*) AS total FROM auditoria_ventas');
    record('Audita la eliminación de ventas', Number(audit.total) === 1, `${audit.total} registro(s) de auditoría`);

    await sandbox.query('CALL sp_registrar_venta_completa(999999, 1, 1, 1, @mensaje, @id_venta)');
    const [[rollbackMessage]] = await sandbox.query('SELECT @mensaje AS mensaje');
    const [[saleCount]] = await sandbox.query('SELECT COUNT(*) AS total FROM ventas');
    record(
      'Revierte una venta ante error de llave foránea',
      rollbackMessage.mensaje.includes('ROLLBACK') && Number(saleCount.total) === 0,
      rollbackMessage.mensaje
    );

    let duplicateRejected = false;
    try {
      await sandbox.query(
        `INSERT INTO clientes (nombre_empresa, correo, fecha_registro)
         VALUES ('Duplicado', 'CLIENTE-EDITADO@EXAMPLE.INVALID', CURDATE())`
      );
    } catch (error) {
      duplicateRejected = error.code === 'ER_DUP_ENTRY';
    }
    record('Rechaza correo duplicado', duplicateRejected, duplicateRejected ? 'UNIQUE aplicado' : 'No fue rechazado');

    let invalidEmailRejected = false;
    try {
      await sandbox.query(
        `INSERT INTO clientes (nombre_empresa, correo, fecha_registro)
         VALUES ('Correo inválido', 'correo-invalido', CURDATE())`
      );
    } catch {
      invalidEmailRejected = true;
    }
    record(
      'Rechaza formato de correo inválido',
      invalidEmailRejected,
      invalidEmailRejected ? 'Rechazado' : 'El trigger solo normaliza a minúsculas'
    );

    let invalidUpdateRejected = false;
    try {
      await sandbox.query("UPDATE clientes SET correo = 'correo-invalido' WHERE id_cliente = 1");
    } catch {
      invalidUpdateRejected = true;
    }
    record(
      'Rechaza formato inválido al actualizar cliente',
      invalidUpdateRejected,
      invalidUpdateRejected ? 'Rechazado' : 'El trigger de actualización no lo bloqueó'
    );

    const topDefinition = procedures.find((item) => item.ROUTINE_NAME === 'sp_top_clientes_compras')?.ROUTINE_DEFINITION || '';
    const servicesDefinition = procedures.find((item) => item.ROUTINE_NAME === 'sp_servicios_mas_vendidos')?.ROUTINE_DEFINITION || '';
    record('RP-05 entrega máximo 10 clientes', /LIMIT\s+10/i.test(topDefinition), 'La especificación solicita los diez primeros');
    record('RP-04 entrega máximo 10 servicios', /LIMIT\s+10/i.test(servicesDefinition), 'La especificación solicita los diez primeros');

    console.table(results);
    if (results.some((result) => !result.passed)) process.exitCode = 1;
  } finally {
    if (sandbox) await sandbox.end();
    if (source) await source.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS \`${testDatabase}\``);
      await admin.end();
    }
  }
}

main().catch((error) => {
  console.error('No se pudo completar la comprobación de triggers/procedimientos:', error.message);
  process.exitCode = 1;
});
