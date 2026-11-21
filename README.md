# Sistema de gestión Zimbra

Aplicación web para administrar clientes, servicios, propuestas, ventas, seguimientos, actividades web, usuarios y reportes. La solución utiliza HTML, JavaScript y Bootstrap en el frontend, Node.js/Express en el backend y MySQL como base de datos.

## Requisitos

- Node.js y npm
- MySQL
- Un esquema `proyecto_zimbra` con las tablas requeridas por el backend

## Configuración

1. Instala las dependencias:

   ```powershell
   npm install
   ```

2. Copia `.env.example` como `.env` y configura las credenciales locales de MySQL. No publiques el archivo `.env`.

3. Crea o restaura el esquema de desarrollo antes de ejecutar la migración. El SQL de referencia del proyecto contiene `DROP DATABASE IF EXISTS`; no lo ejecutes sobre una base con información que quieras conservar.

4. Aplica la migración de triggers y procedimientos:

   ```powershell
   npm run db:migrate
   ```

   La migración agrega la relación opcional entre actividad web y cliente, y crea seis triggers y cinco procedimientos. Requiere permisos MySQL para alterar tablas y administrar triggers y procedimientos.

## Ejecución

Inicia la aplicación:

```powershell
npm start
```

Abre `http://localhost:3000`. Detén el servidor con `Ctrl+C`.

## Pruebas

Para validar triggers y procedimientos en un esquema temporal:

```powershell
npm run test:db
```

Esta prueba requiere permisos para crear y eliminar una base temporal. Para las pruebas de API, inicia primero el servidor en una terminal y ejecuta en otra:

```powershell
npm test
```

Consulta [TESTING.md](./TESTING.md) para los detalles y límites de las pruebas.

## Consideraciones

- La base validada contiene seis triggers y cinco procedimientos.
- `sp_registrar_venta_completa` recibe cuatro parámetros de entrada y dos de salida.
- El flujo de versión de prueba registra la fecha y la actividad; no entrega un instalador.
- La autorización del backend debe reforzarse antes de usar el sistema en producción; no se deben confiar roles recibidos en cabeceras controladas por el cliente.
- No se debe presentar la implementación de vistas, permisos nativos de MySQL ni pruebas de concurrencia como completa sin evidencia adicional.
