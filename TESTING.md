# Pruebas automatizadas

Las pruebas de integración usan `node:test` y `fetch` de Node; no requieren instalar paquetes. Trabajan contra un servidor que ya esté iniciado y una base de datos configurada en `.env`.

## Ejecutarlas

1. Inicia MySQL y el servidor:

   ```powershell
   npm start
   ```

2. En otra terminal, desde la carpeta del proyecto, ejecuta:

   ```powershell
   npm test
   ```

   Para probar un servidor en otra dirección:

   ```powershell
   $env:TEST_BASE_URL = "http://localhost:3001"
   npm test
   ```

## Prueba opcional de login y perfil

Configura temporalmente credenciales de un usuario de pruebas en la misma terminal. No las agregues a `package.json`, al código ni a archivos versionados:

```powershell
$env:TEST_LOGIN_EMAIL = "usuario-de-prueba@ejemplo.com"
$env:TEST_LOGIN_PASSWORD = "contraseña"
npm test
```

La prueba comprueba login y perfil. El inicio de sesión exitoso deja un evento de actividad en la base de datos, igual que el uso normal de la aplicación. Si no defines ambas variables, esa prueba queda marcada como omitida.

## Qué comprueban

- Que la página de login y el panel se sirven, y que el panel contiene perfil y cierre de sesión.
- Que las rutas protegidas rechazan solicitudes sin rol.
- Que las lecturas principales aplican la matriz de permisos por perfil, incluidos los reportes RP-07/RP-08 para soporte.
- Que las consultas de ventas y seguimiento de un vendedor exigen su ID para evitar devolver resultados sin filtro.
- Que soporte no puede registrar ventas ni actividades web.
- Que el reporte mensual exige mes y año.
- Que credenciales inexistentes son rechazadas.
- Opcionalmente, que un usuario real puede iniciar sesión y consultar su perfil.

Las comprobaciones de API son de lectura, excepto el registro de actividad causado por la prueba opcional de login; no crean ni eliminan clientes, ventas, usuarios o servicios.

## Límite importante de la validación actual

El backend usa `x-user-role`, `x-user-id` y `x-user-email` como datos de identidad y autorización enviados por el cliente. Por eso estas pruebas validan la matriz de permisos implementada, pero **no demuestran que un usuario no pueda falsificar su rol**. Para validar autenticación/autorización real se requiere que el backend verifique una sesión o token firmado en lugar de confiar en esos encabezados. El cierre de sesión actual solo elimina los datos del navegador.

Una prueba en verde significa que los casos incluidos pasaron contra la base de datos y servidor disponibles; no certifica por sí sola todos los requisitos del documento ni reemplaza las pruebas manuales de los flujos CRUD y de negocio.

## Validar triggers y procedimientos

Primero aplica la migración corregida a la base configurada en `.env`:

```powershell
npm run db:migrate
```

La migración agrega `actividades_web.id_cliente` como nullable con llave foránea y reinstala los seis triggers y cinco procedimientos. No borra registros; haz una copia de seguridad antes de ejecutarla en una base con datos importantes. El usuario MySQL necesita permisos para `ALTER`, `CREATE/DROP TRIGGER` y `CREATE/DROP ROUTINE`.

Luego ejecuta:

```powershell
npm run test:db
```

Esta comprobación crea un esquema temporal con la estructura y los objetos instalados, aplica la misma migración y prueba inserciones, cálculo de subtotales/totales, aceptación de propuesta, auditoría al borrar, historial, reportes y `ROLLBACK`. Al terminar elimina únicamente ese esquema temporal; no inserta ni borra registros de negocio en `proyecto_zimbra`. El usuario MySQL necesita permisos para crear y eliminar bases de datos.

Si el SQL instalado está desactualizado, la comprobación reporta qué criterios fallan; después de aplicar la migración, esos mismos criterios deben pasar.
