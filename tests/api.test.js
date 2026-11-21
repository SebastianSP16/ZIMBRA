const assert = require('node:assert/strict');
const test = require('node:test');

const BASE_URL = (process.env.TEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const TEST_EMAIL = process.env.TEST_LOGIN_EMAIL;
const TEST_PASSWORD = process.env.TEST_LOGIN_PASSWORD;

async function request(path, options = {}) {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
}

async function expectJson(response, expectedStatus) {
  assert.equal(response.status, expectedStatus);
  return response.json();
}

test('publica la pantalla de login y el panel con perfil y cierre de sesión', async () => {
  const [loginResponse, dashboardResponse] = await Promise.all([
    request('/login.html'),
    request('/index.html')
  ]);
  const [loginHtml, dashboardHtml] = await Promise.all([
    loginResponse.text(),
    dashboardResponse.text()
  ]);

  assert.equal(loginResponse.status, 200);
  assert.match(loginHtml, /formLogin/);
  assert.equal(dashboardResponse.status, 200);
  assert.match(dashboardHtml, /modalPerfil/);
  assert.match(dashboardHtml, /cerrarSesion/);
});

test('bloquea lecturas protegidas cuando no se informa un rol', async () => {
  const protectedPaths = [
    '/api/clientes',
    '/api/servicios',
    '/api/ventas',
    '/api/propuestas',
    '/api/actividades-web',
    '/api/usuarios',
    '/api/roles',
    '/api/reportes/ventas-mensuales?mes=1&anio=2026'
  ];

  const responses = await Promise.all(protectedPaths.map((path) => request(path)));
  assert.deepEqual(responses.map((response) => response.status), protectedPaths.map(() => 403));
});

test('aplica la matriz de permisos en lecturas de los módulos', async () => {
  const cases = [
    { path: '/api/clientes', role: 'Soporte', status: 200 },
    { path: '/api/servicios', role: 'Soporte', status: 200 },
    { path: '/api/propuestas', role: 'Soporte', status: 200 },
    { path: '/api/ventas', role: 'Soporte', status: 200 },
    { path: '/api/seguimiento', role: 'Soporte', status: 200 },
    { path: '/api/actividades-web', role: 'Soporte', status: 200 },
    { path: '/api/reportes/seguimiento-cliente?id_cliente=1', role: 'Soporte', status: 200 },
    { path: '/api/reportes/historial-cliente?id_cliente=1', role: 'Soporte', status: 200 },
    { path: '/api/reportes/actividad-web', role: 'Soporte', status: 200 },
    { path: '/api/ventas', role: 'Vendedor', userId: '3', status: 200 },
    { path: '/api/reportes/ventas-mensuales?mes=1&anio=2026', role: 'Vendedor', status: 403 },
    { path: '/api/reportes/top-clientes', role: 'Vendedor', status: 403 },
    { path: '/api/reportes/actividad-web', role: 'Vendedor', status: 403 },
    { path: '/api/reportes/seguimiento-cliente?id_cliente=1', role: 'Vendedor', userId: '3', status: 200 },
    { path: '/api/reportes/historial-cliente?id_cliente=1', role: 'Vendedor', userId: '3', status: 200 },
    { path: '/api/usuarios', role: 'Vendedor', status: 403 },
    { path: '/api/roles', role: 'Soporte', status: 403 },
    { path: '/api/roles', role: 'Administrador', status: 200 },
    { path: '/api/usuarios', role: 'Administrador', status: 200 }
  ];

  for (const testCase of cases) {
    const response = await request(testCase.path, {
      headers: {
        'x-user-role': testCase.role,
        ...(testCase.userId ? { 'x-user-id': testCase.userId } : {})
      }
    });
    assert.equal(response.status, testCase.status, `${testCase.role} -> ${testCase.path}`);

    if (response.ok) {
      const body = await response.json();
      assert.equal(body.success, true, `${testCase.role} -> ${testCase.path}`);
      assert.ok(Array.isArray(body.data), `${testCase.role} -> ${testCase.path} debe devolver una lista`);
    }
  }
});

test('exige el ID del vendedor antes de consultar sus datos', async () => {
  const paths = [
    '/api/ventas',
    '/api/seguimiento',
    '/api/reportes/ventas-rango-fechas?fecha_inicio=2026-01-01&fecha_fin=2026-12-31',
    '/api/reportes/ventas-vendedor',
    '/api/reportes/seguimiento-cliente?id_cliente=1',
    '/api/reportes/historial-cliente?id_cliente=1'
  ];
  const responses = await Promise.all(paths.map((path) => request(path, {
    headers: { 'x-user-role': 'Vendedor' }
  })));

  assert.deepEqual(responses.map((response) => response.status), paths.map(() => 400));
});

test('impide a soporte registrar ventas o actividades web', async () => {
  const [saleResponse, activityResponse] = await Promise.all([
    request('/api/ventas', {
      method: 'POST',
      headers: { 'x-user-role': 'Soporte' },
      body: JSON.stringify({})
    }),
    request('/api/actividades-web', {
      method: 'POST',
      headers: { 'x-user-role': 'Soporte' },
      body: JSON.stringify({})
    })
  ]);

  assert.equal(saleResponse.status, 403);
  assert.equal(activityResponse.status, 403);
});

test('valida parámetros obligatorios del reporte mensual', async () => {
  const response = await request('/api/reportes/ventas-mensuales', {
    headers: { 'x-user-role': 'Administrador' }
  });
  const body = await expectJson(response, 400);

  assert.match(body.error, /mes y anio/i);
});

test('rechaza credenciales inexistentes', async () => {
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      correo: `prueba-inexistente-${Date.now()}@invalid.example`,
      contrasena: 'clave-no-valida'
    })
  });
  const body = await expectJson(response, 401);

  assert.equal(body.success, false);
});

test('rechaza cantidades inválidas antes de llamar al procedimiento de venta', async () => {
  for (const cantidad of [0, -1, 1.5, 'no-es-numero']) {
    const response = await request('/api/ventas', {
      method: 'POST',
      headers: { 'x-user-role': 'Administrador' },
      body: JSON.stringify({
        id_cliente: 1,
        id_usuario: 1,
        id_servicio: 1,
        cantidad
      })
    });
    const body = await expectJson(response, 400);

    assert.match(body.error, /cantidad/i);
  }
});

test('rechaza correos mal formados antes de guardarlos', async () => {
  const response = await request('/api/clientes', {
    method: 'POST',
    headers: { 'x-user-role': 'Administrador' },
    body: JSON.stringify({ nombre_empresa: 'Prueba', correo: 'correo-invalido' })
  });
  const body = await expectJson(response, 400);

  assert.match(body.error, /correo/i);
});

test('devuelve error si el procedimiento revierte una venta inválida', async () => {
  const response = await request('/api/ventas', {
    method: 'POST',
    headers: { 'x-user-role': 'Administrador' },
    body: JSON.stringify({
      id_cliente: -1,
      id_usuario: -1,
      id_servicio: -1,
      cantidad: 1
    })
  });
  const body = await expectJson(response, 400);

  assert.equal(body.success, false);
  assert.match(body.error, /ROLLBACK/i);
});

test('inicia sesión y consulta el perfil (opcional)', {
  skip: !TEST_EMAIL || !TEST_PASSWORD
    ? 'Define TEST_LOGIN_EMAIL y TEST_LOGIN_PASSWORD para habilitar esta prueba.'
    : false
}, async () => {
  const loginResponse = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo: TEST_EMAIL, contrasena: TEST_PASSWORD })
  });
  const loginBody = await expectJson(loginResponse, 200);

  assert.equal(loginBody.success, true);
  assert.ok(loginBody.usuario?.id_usuario);
  assert.ok(loginBody.usuario?.rol);

  const profileResponse = await request('/api/auth/perfil', {
    headers: {
      'x-user-role': loginBody.usuario.rol,
      'x-user-id': String(loginBody.usuario.id_usuario),
      'x-user-email': loginBody.usuario.correo
    }
  });
  const profileBody = await expectJson(profileResponse, 200);

  assert.equal(profileBody.success, true);
  assert.equal(profileBody.data.correo, loginBody.usuario.correo);
  assert.equal(profileBody.data.rol, loginBody.usuario.rol);
});
