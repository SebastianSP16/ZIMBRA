/**
 * Zimbra - Frontend Logic (app.js)
 * Dashboard administrativo con consumo de API REST y Bootstrap 5.
 * Soporta los 10 módulos del sistema con CRUD completo.
 */

const API_BASE = 'http://localhost:3000/api';
const ROLE_ACCESS = {
  Administrador: ['dashboard', 'clientes', 'servicios', 'ventas', 'propuestas', 'seguimiento', 'actividades', 'usuarios', 'roles', 'reportes'],
  Vendedor: ['dashboard', 'clientes', 'servicios', 'ventas', 'propuestas', 'seguimiento', 'reportes'],
  Soporte: ['dashboard', 'clientes', 'servicios', 'ventas', 'propuestas', 'seguimiento', 'actividades', 'reportes']
};
const REPORT_ACCESS = {
  'RP-01': ['Administrador', 'Vendedor'],
  'RP-02': ['Administrador', 'Vendedor'],
  'RP-03': ['Administrador'],
  'RP-04': ['Administrador', 'Vendedor'],
  'RP-05': ['Administrador'],
  'RP-06': ['Administrador', 'Vendedor'],
  'RP-07': ['Administrador', 'Vendedor', 'Soporte'],
  'RP-08': ['Administrador', 'Soporte']
};
const REPORT_ELEMENTS = {
  'RP-01': 'formRangoFechas',
  'RP-02': 'formVendedor',
  'RP-03': 'formMes',
  'RP-04': 'tbodyServiciosVendidos',
  'RP-05': 'tbodyTopClientes',
  'RP-06': 'tbodyPropuestasEstado',
  'RP-07': 'formSeguimientoReporte',
  'RP-08': 'formActividadWeb'
};

const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const usuario = JSON.parse(sessionStorage.getItem('zimbra_usuario') || '{}');
  const headers = new Headers(init.headers || {});
  if (usuario.rol) headers.set('x-user-role', usuario.rol);
  if (usuario.id_usuario) headers.set('x-user-id', String(usuario.id_usuario));
  if (usuario.correo) headers.set('x-user-email', usuario.correo);
  return originalFetch(input, { ...init, headers });
};

function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(valor || 0);
}

function formatearFecha(fecha) {
  return new Date(fecha).toLocaleDateString('es-CO');
}

function mostrarAlerta(mensaje, tipo = 'success') {
  const alerta = document.createElement('div');
  alerta.className = `alert alert-${tipo === 'success' ? 'success' : 'danger'} alert-dismissible fade show position-fixed`;
  alerta.style.top = '1rem';
  alerta.style.right = '1rem';
  alerta.style.zIndex = '9999';
  alerta.style.minWidth = '300px';
  alerta.innerHTML = `${mensaje}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>`;
  document.body.appendChild(alerta);
  setTimeout(() => { const bsAlert = bootstrap.Alert.getOrCreateInstance(alerta); bsAlert.close(); }, 5000);
}

function obtenerDatosRespuesta(datos) {
  return datos.data || datos;
}

const app = {
  // ============================================
  // INICIALIZACIÓN
  // ============================================
  async inicializar() {
    this.cargarPermisos();
    this.cambiarSeccion(null, 'dashboard');
    this.cargarStats();
    this.cargarClientes();
  },

  cargarPermisos() {
    const usuario = JSON.parse(sessionStorage.getItem('zimbra_usuario') || '{}');
    if (!usuario || !usuario.rol) return;

    const modulosPermitidos = ROLE_ACCESS[usuario.rol] || [];
    document.querySelectorAll('.nav-link').forEach((link) => {
      const seccion = link.dataset.section;
      const visible = modulosPermitidos.includes(seccion);
      link.parentElement.style.display = visible ? '' : 'none';
    });

    Object.entries(REPORT_ELEMENTS).forEach(([reporte, elementId]) => {
      const card = document.getElementById(elementId)?.closest('.col-12');
      if (card) card.style.display = REPORT_ACCESS[reporte].includes(usuario.rol) ? '' : 'none';
    });
  },

  puedeAccederA(seccion) {
    const usuario = JSON.parse(sessionStorage.getItem('zimbra_usuario') || '{}');
    const modulosPermitidos = ROLE_ACCESS[usuario.rol] || [];
    return modulosPermitidos.includes(seccion);
  },

  cambiarSeccion(e, sectionId) {
    const seccionDestino = sectionId || window.location.hash.replace('#', '') || 'dashboard';
    if (e) e.preventDefault();
    if (!this.puedeAccederA(seccionDestino)) {
      const fallback = 'dashboard';
      this.cambiarSeccion(null, fallback);
      return;
    }

    const section = document.getElementById('section-' + seccionDestino);
    if (!section) return;

    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    section.classList.add('active');

    const navLink = document.querySelector(`.nav-link[data-section="${seccionDestino}"]`);
    if (navLink) navLink.classList.add('active');

    if (seccionDestino === 'dashboard') {
      if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
    } else if (window.location.hash !== '#' + seccionDestino) {
      window.location.hash = seccionDestino;
    }

    if (seccionDestino === 'clientes') this.cargarClientes();
    if (seccionDestino === 'servicios') this.cargarServicios();
    if (seccionDestino === 'ventas') { this.cargarVentas(); this.cargarSelectsVentas(); }
    if (seccionDestino === 'propuestas') { this.cargarPropuestas(); this.cargarSelectsPropuestas(); }
    if (seccionDestino === 'seguimiento') { this.cargarSeguimiento(); this.cargarSelectsSeguimiento(); }
    if (seccionDestino === 'actividades') { this.cargarActividades(); this.cargarSelectsActividades(); }
    if (seccionDestino === 'usuarios') { this.cargarUsuarios(); this.cargarSelectsRoles(); }
    if (seccionDestino === 'roles') this.cargarRoles();
    if (seccionDestino === 'reportes') this.cargarStats();
    if (seccionDestino === 'dashboard') this.cargarStats();
  },

  async cargarStats() {
    try {
      const [resClientes, resServicios, resVentas] = await Promise.all([
        fetch(`${API_BASE}/clientes`),
        fetch(`${API_BASE}/servicios`),
        fetch(`${API_BASE}/ventas`)
      ]);

      const clientes = obtenerDatosRespuesta(await resClientes.json());
      const servicios = obtenerDatosRespuesta(await resServicios.json());
      const ventas = obtenerDatosRespuesta(await resVentas.json());

      const totalClientes = Array.isArray(clientes) ? clientes.length : 0;
      const totalServicios = Array.isArray(servicios) ? servicios.length : 0;
      const totalVentas = Array.isArray(ventas) ? ventas.length : 0;
      const ingresosTotales = Array.isArray(ventas)
        ? ventas.reduce((suma, venta) => suma + Number(venta.valor_total || 0), 0)
        : 0;

      document.getElementById('stat-clientes').textContent = totalClientes;
      document.getElementById('stat-servicios').textContent = totalServicios;
      document.getElementById('stat-ventas').textContent = totalVentas;
      document.getElementById('stat-ingresos').textContent = formatearMoneda(ingresosTotales);
      document.getElementById('sum-clientes').textContent = totalClientes;
      document.getElementById('sum-servicios').textContent = totalServicios;
      document.getElementById('sum-ventas').textContent = totalVentas;
      document.getElementById('ultima-actualizacion').textContent = new Date().toLocaleString('es-CO');
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  },

  actualizarDatosUsuario() {
    const usuario = JSON.parse(sessionStorage.getItem('zimbra_usuario') || '{}');
    const nombre = usuario.nombre || 'Usuario';
    const correo = usuario.correo || 'Sin correo';
    const rol = usuario.rol || 'Sin rol';

    const sidebarUsuario = document.getElementById('sidebarUsuario');
    const sidebarRol = document.getElementById('sidebarRol');
    const headerUsuario = document.getElementById('headerUsuario');
    const perfilNombre = document.getElementById('perfilNombre');
    const perfilCorreo = document.getElementById('perfilCorreo');
    const perfilRol = document.getElementById('perfilRol');

    if (sidebarUsuario) sidebarUsuario.textContent = nombre;
    if (sidebarRol) sidebarRol.textContent = rol;
    if (headerUsuario) headerUsuario.textContent = nombre;
    if (perfilNombre) perfilNombre.textContent = nombre;
    if (perfilCorreo) perfilCorreo.textContent = correo;
    if (perfilRol) perfilRol.textContent = rol;
  },

  mostrarPerfil() {
    this.actualizarDatosUsuario();
    const modalPerfil = document.getElementById('modalPerfil');
    if (modalPerfil) {
      const instancia = bootstrap.Modal.getOrCreateInstance(modalPerfil);
      instancia.show();
    }
  },

  cerrarSesion() {
    sessionStorage.removeItem('zimbra_usuario');
    window.location.href = 'login.html';
  },

  // ============================================
  // CLIENTES
  // ============================================
  async cargarClientes() {
    try {
      const respuesta = await fetch(`${API_BASE}/clientes`);
      const datos = await respuesta.json();
      const clientes = obtenerDatosRespuesta(datos);
      const tbody = document.getElementById('tbodyClientes');
      tbody.innerHTML = '';
      clientes.forEach(c => {
        const fila = document.createElement('tr');
        fila.innerHTML = `<td>${c.id_cliente}</td><td>${c.nombre_empresa}</td><td>${c.correo}</td><td>${c.telefono || '-'}</td><td>${c.direccion || '-'}</td><td><span class="date-cell">${formatearFecha(c.fecha_registro)}</span></td><td><button class="btn btn-success-custom btn-sm me-1" onclick="app.descargarPruebaCliente(${c.id_cliente})"><i class="bi bi-download"></i></button><button class="btn btn-outline-custom btn-sm" onclick="app.editarCliente(${c.id_cliente})"><i class="bi bi-pencil"></i></button><button class="btn btn-danger-custom btn-sm" onclick="app.eliminarCliente(${c.id_cliente})"><i class="bi bi-trash"></i></button></td>`;
        tbody.appendChild(fila);
      });
    } catch (error) { console.error('Error cargando clientes:', error); mostrarAlerta('Error al cargar clientes', 'danger'); }
  },

  async guardarClienteModal() {
    const nombre_empresa = document.getElementById('mcNombreEmpresa').value;
    const correo = document.getElementById('mcCorreo').value;
    const telefono = document.getElementById('mcTelefono').value;
    const direccion = document.getElementById('mcDireccion').value;
    try {
      const respuesta = await fetch(`${API_BASE}/clientes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_empresa, correo, telefono, direccion })
      });
      const datos = await respuesta.json();
      if (respuesta.ok) {
        mostrarAlerta('Cliente creado exitosamente');
        bootstrap.Modal.getInstance(document.getElementById('modalCliente')).hide();
        document.getElementById('formClienteModal').reset();
        this.cargarClientes(); this.cargarStats();
      } else { mostrarAlerta(datos.error || 'Error al crear cliente', 'danger'); }
    } catch (error) { console.error('Error guardando cliente:', error); mostrarAlerta('Error al guardar cliente', 'danger'); }
  },

  async editarCliente(id) {
    try {
      const respuesta = await fetch(`${API_BASE}/clientes`);
      const datos = await respuesta.json();
      const clientes = obtenerDatosRespuesta(datos);
      const c = clientes.find(x => x.id_cliente === id);
      if (!c) return;
      document.getElementById('mcNombreEmpresa').value = c.nombre_empresa;
      document.getElementById('mcCorreo').value = c.correo;
      document.getElementById('mcTelefono').value = c.telefono || '';
      document.getElementById('mcDireccion').value = c.direccion || '';
      const modal = new bootstrap.Modal(document.getElementById('modalCliente'));
      modal.show();
      document.getElementById('formClienteModal').onsubmit = async (e) => {
        e.preventDefault();
        try {
          const resp = await fetch(`${API_BASE}/clientes/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nombre_empresa: document.getElementById('mcNombreEmpresa').value,
              correo: document.getElementById('mcCorreo').value,
              telefono: document.getElementById('mcTelefono').value,
              direccion: document.getElementById('mcDireccion').value
            })
          });
          const resData = await resp.json();
          if (resp.ok) {
            mostrarAlerta('Cliente actualizado exitosamente');
            modal.hide();
            document.getElementById('formClienteModal').reset();
            document.getElementById('formClienteModal').onsubmit = null;
            this.cargarClientes(); this.cargarStats();
          } else { mostrarAlerta(resData.error || 'Error al actualizar', 'danger'); }
        } catch (err) { mostrarAlerta('Error al actualizar cliente', 'danger'); }
      };
    } catch (error) { mostrarAlerta('Error cargando cliente', 'danger'); }
  },

  async descargarPruebaCliente(id) {
    try {
      const respuesta = await fetch(`${API_BASE}/clientes/${id}/descargar-prueba`, { method: 'POST' });
      const datos = await respuesta.json();
      if (respuesta.ok) {
        mostrarAlerta(datos.mensaje || 'Prueba registrada correctamente');
        this.cargarClientes();
      } else {
        mostrarAlerta(datos.error || 'No se pudo registrar la descarga', 'danger');
      }
    } catch (error) {
      mostrarAlerta('Error al registrar la descarga', 'danger');
    }
  },

  async eliminarCliente(id) {
    if (!confirm('¿Está seguro de eliminar este cliente?')) return;
    try {
      const respuesta = await fetch(`${API_BASE}/clientes/${id}`, { method: 'DELETE' });
      if (respuesta.ok) { mostrarAlerta('Cliente eliminado'); this.cargarClientes(); this.cargarStats(); }
    } catch (error) { mostrarAlerta('Error al eliminar cliente', 'danger'); }
  },

  // ============================================
  // SERVICIOS
  // ============================================
  async cargarServicios() {
    try {
      const respuesta = await fetch(`${API_BASE}/servicios`);
      const datos = await respuesta.json();
      const servicios = obtenerDatosRespuesta(datos);
      const tbody = document.getElementById('tbodyServicios');
      tbody.innerHTML = '';
      servicios.forEach(s => {
        const fila = document.createElement('tr');
        const badgeClass = s.estado === 'Activo' ? 'badge-active' : 'badge-inactive';
        fila.innerHTML = `<td>${s.id_servicio}</td><td>${s.nombre_servicio}</td><td>${s.descripcion || '-'}</td><td class="price-cell">${formatearMoneda(s.precio)}</td><td><span class="badge-status ${badgeClass}">${s.estado}</span></td><td><button class="btn btn-outline-custom btn-sm" onclick="app.editarServicio(${s.id_servicio})"><i class="bi bi-pencil"></i></button><button class="btn btn-danger-custom btn-sm" onclick="app.eliminarServicio(${s.id_servicio})"><i class="bi bi-trash"></i></button></td>`;
        tbody.appendChild(fila);
      });
    } catch (error) { console.error('Error cargando servicios:', error); mostrarAlerta('Error al cargar servicios', 'danger'); }
  },

  async guardarServicioModal() {
    const nombre_servicio = document.getElementById('msNombre').value;
    const descripcion = document.getElementById('msDescripcion').value;
    const precio = document.getElementById('msPrecio').value;
    const estado = document.getElementById('msEstado').value;
    try {
      const respuesta = await fetch(`${API_BASE}/servicios`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_servicio, descripcion, precio, estado })
      });
      const datos = await respuesta.json();
      if (respuesta.ok) {
        mostrarAlerta('Servicio creado exitosamente');
        bootstrap.Modal.getInstance(document.getElementById('modalServicio')).hide();
        document.getElementById('formServicioModal').reset();
        this.cargarServicios(); this.cargarStats();
      } else { mostrarAlerta(datos.error || 'Error al crear servicio', 'danger'); }
    } catch (error) { console.error('Error guardando servicio:', error); mostrarAlerta('Error al guardar servicio', 'danger'); }
  },

  async editarServicio(id) {
    try {
      const respuesta = await fetch(`${API_BASE}/servicios`);
      const datos = await respuesta.json();
      const servicios = obtenerDatosRespuesta(datos);
      const s = servicios.find(x => x.id_servicio === id);
      if (!s) return;
      document.getElementById('msNombre').value = s.nombre_servicio;
      document.getElementById('msDescripcion').value = s.descripcion || '';
      document.getElementById('msPrecio').value = s.precio;
      document.getElementById('msEstado').value = s.estado;
      const modal = new bootstrap.Modal(document.getElementById('modalServicio'));
      modal.show();
      document.getElementById('formServicioModal').onsubmit = async (e) => {
        e.preventDefault();
        try {
          const resp = await fetch(`${API_BASE}/servicios/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nombre_servicio: document.getElementById('msNombre').value,
              descripcion: document.getElementById('msDescripcion').value,
              precio: document.getElementById('msPrecio').value,
              estado: document.getElementById('msEstado').value
            })
          });
          const resData = await resp.json();
          if (resp.ok) {
            mostrarAlerta('Servicio actualizado exitosamente');
            modal.hide();
            document.getElementById('formServicioModal').reset();
            document.getElementById('formServicioModal').onsubmit = null;
            this.cargarServicios(); this.cargarStats();
          } else { mostrarAlerta(resData.error || 'Error al actualizar', 'danger'); }
        } catch (err) { mostrarAlerta('Error al actualizar servicio', 'danger'); }
      };
    } catch (error) { mostrarAlerta('Error cargando servicio', 'danger'); }
  },

  async eliminarServicio(id) {
    if (!confirm('¿Está seguro de eliminar este servicio?')) return;
    try {
      const respuesta = await fetch(`${API_BASE}/servicios/${id}`, { method: 'DELETE' });
      if (respuesta.ok) { mostrarAlerta('Servicio eliminado'); this.cargarServicios(); this.cargarStats(); }
    } catch (error) { mostrarAlerta('Error al eliminar servicio', 'danger'); }
  },

  // ============================================
  // VENTAS
  // ============================================
  async cargarVentas() {
    try {
      const respuesta = await fetch(`${API_BASE}/ventas`);
      const datos = await respuesta.json();
      const ventas = obtenerDatosRespuesta(datos);
      const tbody = document.getElementById('tbodyVentas');
      const tbodyRecientes = document.getElementById('tbodyVentasRecientes');
      tbody.innerHTML = '';
      tbodyRecientes.innerHTML = '';
      ventas.forEach((v, i) => {
        const fila = `<tr><td>${v.id_venta}</td><td>${formatearFecha(v.fecha_venta)}</td><td>${v.cliente}</td><td>${v.vendedor}</td><td class="price-cell">${formatearMoneda(v.valor_total)}</td></tr>`;
        const tr = document.createElement('tr');
        tr.innerHTML = fila;
        tbody.appendChild(tr);
        if (i < 5) { const tr2 = document.createElement('tr'); tr2.innerHTML = fila; tbodyRecientes.appendChild(tr2); }
      });
    } catch (error) { console.error('Error cargando ventas:', error); mostrarAlerta('Error al cargar ventas', 'danger'); }
  },

  async cargarSelectsVentas() {
    this.actualizarVendedorVenta();
    try {
      const [resC, resS] = await Promise.all([fetch(`${API_BASE}/clientes`), fetch(`${API_BASE}/servicios`)]);
      const datosC = await resC.json(); const datosS = await resS.json();
      const clientes = obtenerDatosRespuesta(datosC); const servicios = obtenerDatosRespuesta(datosS);
      const selC = document.getElementById('ventaCliente'); selC.innerHTML = '<option value="">Seleccionar cliente...</option>';
      clientes.forEach(c => { const o = document.createElement('option'); o.value = c.id_cliente; o.textContent = c.nombre_empresa; selC.appendChild(o); });
      const selS = document.getElementById('ventaServicio'); selS.innerHTML = '<option value="">Seleccionar servicio...</option>';
      servicios.forEach(s => { const o = document.createElement('option'); o.value = s.id_servicio; o.textContent = s.nombre_servicio; selS.appendChild(o); });
    } catch (error) { console.error('Error cargando selects:', error); }
  },

  actualizarVendedorVenta() {
    const usuario = JSON.parse(sessionStorage.getItem('zimbra_usuario') || '{}');
    const idUsuario = document.getElementById('ventaUsuario');
    const nombreVendedor = document.getElementById('ventaVendedor');

    if (!idUsuario || !nombreVendedor) return;

    idUsuario.value = usuario.id_usuario ? String(usuario.id_usuario) : '';
    nombreVendedor.value = usuario.id_usuario
      ? `${usuario.nombre || 'Usuario'} (ID ${usuario.id_usuario})`
      : 'No se pudo identificar al usuario';
  },

  async registrarVenta(e) {
    e.preventDefault();
    const id_cliente = document.getElementById('ventaCliente').value;
    const id_servicio = document.getElementById('ventaServicio').value;
    const cantidad = document.getElementById('ventaCantidad').value;
    const usuario = JSON.parse(sessionStorage.getItem('zimbra_usuario') || '{}');
    const id_usuario = Number(usuario.id_usuario);
    if (!Number.isInteger(id_usuario) || id_usuario <= 0) {
      mostrarAlerta('No se pudo identificar al vendedor. Cierra sesión e inicia nuevamente.', 'danger');
      return;
    }

    try {
      const respuesta = await fetch(`${API_BASE}/ventas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_cliente, id_usuario, id_servicio, cantidad })
      });
      const datos = await respuesta.json();
      if (respuesta.ok) {
        alert(datos.mensaje);
        mostrarAlerta(datos.mensaje, 'success');
        document.getElementById('formVenta').reset();
        document.getElementById('ventaCantidad').value = 1;
        this.actualizarVendedorVenta();
        await Promise.all([this.cargarVentas(), this.cargarStats()]);
      } else { alert(datos.error || 'Error al registrar venta'); mostrarAlerta(datos.error || 'Error al registrar venta', 'danger'); }
    } catch (error) { console.error('Error registrando venta:', error); alert('Error al conectar con el servidor'); mostrarAlerta('Error al registrar venta', 'danger'); }
  },

  // ============================================
  // PROPUESTAS
  // ============================================
  async cargarPropuestas() {
    try {
      const respuesta = await fetch(`${API_BASE}/propuestas`);
      const datos = await respuesta.json();
      const propuestas = obtenerDatosRespuesta(datos);
      const tbody = document.getElementById('tbodyPropuestas');
      tbody.innerHTML = '';
      propuestas.forEach(p => {
        const badgeClass = p.estado === 'Aceptada' ? 'badge-accepted' : p.estado === 'Rechazada' ? 'badge-rejected' : 'badge-pending';
        const fila = document.createElement('tr');
        fila.innerHTML = `<td>${p.id_propuesta}</td><td>${formatearFecha(p.fecha_propuesta)}</td><td>${p.cliente}</td><td>${p.servicio}</td><td class="price-cell">${formatearMoneda(p.valor_total)}</td><td><span class="badge-status ${badgeClass}">${p.estado}</span></td><td><button class="btn btn-outline-custom btn-sm" onclick="app.cambiarEstadoPropuesta(${p.id_propuesta}, '${p.estado}')"><i class="bi bi-pencil"></i></button><button class="btn btn-danger-custom btn-sm" onclick="app.eliminarPropuesta(${p.id_propuesta})"><i class="bi bi-trash"></i></button></td>`;
        tbody.appendChild(fila);
      });
    } catch (error) { console.error('Error cargando propuestas:', error); mostrarAlerta('Error al cargar propuestas', 'danger'); }
  },

  async cargarSelectsPropuestas() {
    try {
      const [resC, resS] = await Promise.all([fetch(`${API_BASE}/clientes`), fetch(`${API_BASE}/servicios`)]);
      const datosC = await resC.json(); const datosS = await resS.json();
      const clientes = obtenerDatosRespuesta(datosC); const servicios = obtenerDatosRespuesta(datosS);
      const selC = document.getElementById('mpCliente'); selC.innerHTML = '<option value="">Seleccionar cliente...</option>';
      clientes.forEach(c => { const o = document.createElement('option'); o.value = c.id_cliente; o.textContent = c.nombre_empresa; selC.appendChild(o); });
      const selS = document.getElementById('mpServicio'); selS.innerHTML = '<option value="">Seleccionar servicio...</option>';
      servicios.forEach(s => { const o = document.createElement('option'); o.value = s.id_servicio; o.textContent = s.nombre_servicio; selS.appendChild(o); });
    } catch (error) { console.error('Error cargando selects propuestas:', error); }
  },

  async guardarPropuestaModal() {
    const fecha_propuesta = document.getElementById('mpFecha').value;
    const valor_total = document.getElementById('mpValor').value;
    const id_cliente = document.getElementById('mpCliente').value;
    const id_servicio = document.getElementById('mpServicio').value;
    const estado = document.getElementById('mpEstado').value;
    try {
      const respuesta = await fetch(`${API_BASE}/propuestas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha_propuesta, valor_total, id_cliente, id_servicio, estado })
      });
      const datos = await respuesta.json();
      if (respuesta.ok) {
        mostrarAlerta('Propuesta creada exitosamente');
        bootstrap.Modal.getInstance(document.getElementById('modalPropuesta')).hide();
        document.getElementById('formPropuestaModal').reset();
        this.cargarPropuestas(); this.cargarStats();
      } else { mostrarAlerta(datos.error || 'Error al crear propuesta', 'danger'); }
    } catch (error) { console.error('Error guardando propuesta:', error); mostrarAlerta('Error al guardar propuesta', 'danger'); }
  },

  async cambiarEstadoPropuesta(id, estadoActual) {
    const estados = ['Pendiente', 'Aceptada', 'Rechazada'];
    const idx = estados.indexOf(estadoActual);
    const nuevoEstado = estados[(idx + 1) % estados.length];
    try {
      const respuesta = await fetch(`${API_BASE}/propuestas/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      if (respuesta.ok) {
        mostrarAlerta(`Propuesta cambiada a ${nuevoEstado}`);
        this.cargarPropuestas();
      } else { mostrarAlerta('Error al cambiar estado', 'danger'); }
    } catch (error) { mostrarAlerta('Error al cambiar estado', 'danger'); }
  },

  async eliminarPropuesta(id) {
    if (!confirm('¿Está seguro de eliminar esta propuesta?')) return;
    try {
      const respuesta = await fetch(`${API_BASE}/propuestas/${id}`, { method: 'DELETE' });
      if (respuesta.ok) { mostrarAlerta('Propuesta eliminada'); this.cargarPropuestas(); }
    } catch (error) { mostrarAlerta('Error al eliminar propuesta', 'danger'); }
  },

  // ============================================
  // SEGUIMIENTO CLIENTES
  // ============================================
  async cargarSeguimiento() {
    try {
      const respuesta = await fetch(`${API_BASE}/seguimiento`);
      const datos = await respuesta.json();
      const seguimientos = obtenerDatosRespuesta(datos);
      const tbody = document.getElementById('tbodySeguimiento');
      tbody.innerHTML = '';
      seguimientos.forEach(s => {
        const fila = document.createElement('tr');
        fila.innerHTML = `<td>${s.id_seguimiento}</td><td>${formatearFecha(s.fecha)}</td><td>${s.cliente}</td><td>${s.tipo_contacto}</td><td>${s.descripcion}</td><td>${s.usuario}</td><td><button class="btn btn-danger-custom btn-sm" onclick="app.eliminarSeguimiento(${s.id_seguimiento})"><i class="bi bi-trash"></i></button></td>`;
        tbody.appendChild(fila);
      });
    } catch (error) { console.error('Error cargando seguimiento:', error); mostrarAlerta('Error al cargar seguimiento', 'danger'); }
  },

  async cargarSelectsSeguimiento() {
    try {
      const respuesta = await fetch(`${API_BASE}/clientes`);
      const datos = await respuesta.json();
      const clientes = obtenerDatosRespuesta(datos);
      const sel = document.getElementById('segCliente'); sel.innerHTML = '<option value="">Seleccionar cliente...</option>';
      clientes.forEach(c => { const o = document.createElement('option'); o.value = c.id_cliente; o.textContent = c.nombre_empresa; sel.appendChild(o); });
    } catch (error) { console.error('Error cargando selects seguimiento:', error); }
  },

  async guardarSeguimientoModal() {
    const fecha = document.getElementById('segFecha').value;
    const descripcion = document.getElementById('segDescripcion').value;
    const tipo_contacto = document.getElementById('segTipo').value;
    const id_cliente = document.getElementById('segCliente').value;
    const id_usuario = document.getElementById('segUsuario').value;
    try {
      const respuesta = await fetch(`${API_BASE}/seguimiento`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, descripcion, tipo_contacto, id_cliente, id_usuario })
      });
      const datos = await respuesta.json();
      if (respuesta.ok) {
        mostrarAlerta('Seguimiento registrado exitosamente');
        bootstrap.Modal.getInstance(document.getElementById('modalSeguimiento')).hide();
        document.getElementById('formSeguimientoModal').reset();
        this.cargarSeguimiento();
      } else { mostrarAlerta(datos.error || 'Error al registrar seguimiento', 'danger'); }
    } catch (error) { console.error('Error guardando seguimiento:', error); mostrarAlerta('Error al guardar seguimiento', 'danger'); }
  },

  async eliminarSeguimiento(id) {
    if (!confirm('¿Está seguro de eliminar este seguimiento?')) return;
    try {
      const respuesta = await fetch(`${API_BASE}/seguimiento/${id}`, { method: 'DELETE' });
      if (respuesta.ok) { mostrarAlerta('Seguimiento eliminado'); this.cargarSeguimiento(); }
    } catch (error) { mostrarAlerta('Error al eliminar seguimiento', 'danger'); }
  },

  // ============================================
  // ACTIVIDADES WEB
  // ============================================
  async cargarActividades() {
    try {
      const respuesta = await fetch(`${API_BASE}/actividades-web`);
      const datos = await respuesta.json();
      const actividades = obtenerDatosRespuesta(datos);
      const tbody = document.getElementById('tbodyActividades');
      tbody.innerHTML = '';
      actividades.forEach(a => {
        const fila = document.createElement('tr');
        fila.innerHTML = `<td>${a.id_actividad}</td><td>${formatearFecha(a.fecha)}</td><td>${a.accion}</td><td>${a.usuario}</td><td><button class="btn btn-danger-custom btn-sm" onclick="app.eliminarActividad(${a.id_actividad})"><i class="bi bi-trash"></i></button></td>`;
        tbody.appendChild(fila);
      });
    } catch (error) { console.error('Error cargando actividades:', error); mostrarAlerta('Error al cargar actividades', 'danger'); }
  },

  async guardarActividadModal() {
    const fecha = document.getElementById('actFecha').value;
    const accion = document.getElementById('actAccion').value;
    const id_usuario = document.getElementById('actUsuario').value;
    const id_cliente = document.getElementById('actCliente').value || null;
    try {
      const respuesta = await fetch(`${API_BASE}/actividades-web`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, accion, id_usuario, id_cliente })
      });
      const datos = await respuesta.json();
      if (respuesta.ok) {
        mostrarAlerta('Actividad web registrada exitosamente');
        bootstrap.Modal.getInstance(document.getElementById('modalActividad')).hide();
        document.getElementById('formActividadModal').reset();
        this.cargarActividades();
      } else { mostrarAlerta(datos.error || 'Error al registrar actividad', 'danger'); }
    } catch (error) { console.error('Error guardando actividad:', error); mostrarAlerta('Error al guardar actividad', 'danger'); }
  },

  async cargarSelectsActividades() {
    try {
      const respuesta = await fetch(`${API_BASE}/clientes`);
      const datos = await respuesta.json();
      const clientes = obtenerDatosRespuesta(datos);
      const select = document.getElementById('actCliente');
      select.innerHTML = '<option value="">Sin cliente asociado</option>';
      clientes.forEach((cliente) => {
        const opcion = document.createElement('option');
        opcion.value = cliente.id_cliente;
        opcion.textContent = cliente.nombre_empresa;
        select.appendChild(opcion);
      });
    } catch (error) {
      console.error('Error cargando clientes para actividad web:', error);
      mostrarAlerta('No se pudieron cargar los clientes para la actividad web', 'danger');
    }
  },

  async eliminarActividad(id) {
    if (!confirm('¿Está seguro de eliminar esta actividad?')) return;
    try {
      const respuesta = await fetch(`${API_BASE}/actividades-web/${id}`, { method: 'DELETE' });
      if (respuesta.ok) { mostrarAlerta('Actividad eliminada'); this.cargarActividades(); }
    } catch (error) { mostrarAlerta('Error al eliminar actividad', 'danger'); }
  },

  // ============================================
  // USUARIOS
  // ============================================
  async cargarUsuarios() {
    try {
      const respuesta = await fetch(`${API_BASE}/usuarios`);
      const datos = await respuesta.json();
      const usuarios = obtenerDatosRespuesta(datos);
      const tbody = document.getElementById('tbodyUsuarios');
      tbody.innerHTML = '';
      usuarios.forEach(u => {
        const badgeClass = u.estado === 'Activo' ? 'badge-active' : 'badge-inactive';
        const fila = document.createElement('tr');
        fila.innerHTML = `<td>${u.id_usuario}</td><td>${u.nombre}</td><td>${u.correo}</td><td>${u.rol}</td><td><span class="badge-status ${badgeClass}">${u.estado}</span></td><td><button class="btn btn-outline-custom btn-sm" onclick="app.editarUsuario(${u.id_usuario})"><i class="bi bi-pencil"></i></button><button class="btn btn-danger-custom btn-sm" onclick="app.eliminarUsuario(${u.id_usuario})"><i class="bi bi-trash"></i></button></td>`;
        tbody.appendChild(fila);
      });
    } catch (error) { console.error('Error cargando usuarios:', error); mostrarAlerta('Error al cargar usuarios', 'danger'); }
  },

  async cargarSelectsRoles() {
    try {
      const respuesta = await fetch(`${API_BASE}/roles`);
      const datos = await respuesta.json();
      const roles = obtenerDatosRespuesta(datos);
      const sel = document.getElementById('muRol'); sel.innerHTML = '<option value="">Seleccionar rol...</option>';
      roles.forEach(r => { const o = document.createElement('option'); o.value = r.id_rol; o.textContent = r.nombre_rol; sel.appendChild(o); });
    } catch (error) { console.error('Error cargando roles:', error); }
  },

  async guardarUsuarioModal() {
    const nombre = document.getElementById('muNombre').value;
    const correo = document.getElementById('muCorreo').value;
    const contrasena = document.getElementById('muContrasena').value;
    const id_rol = document.getElementById('muRol').value;
    const estado = document.getElementById('muEstado').value;
    try {
      const respuesta = await fetch(`${API_BASE}/usuarios`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, correo, contrasena, id_rol, estado })
      });
      const datos = await respuesta.json();
      if (respuesta.ok) {
        mostrarAlerta('Usuario creado exitosamente');
        bootstrap.Modal.getInstance(document.getElementById('modalUsuario')).hide();
        document.getElementById('formUsuarioModal').reset();
        this.cargarUsuarios();
      } else { mostrarAlerta(datos.error || 'Error al crear usuario', 'danger'); }
    } catch (error) { console.error('Error guardando usuario:', error); mostrarAlerta('Error al guardar usuario', 'danger'); }
  },

  async editarUsuario(id) {
    mostrarAlerta('Función de edición de usuario en desarrollo', 'warning');
  },

  async eliminarUsuario(id) {
    if (!confirm('¿Está seguro de eliminar este usuario?')) return;
    try {
      const respuesta = await fetch(`${API_BASE}/usuarios/${id}`, { method: 'DELETE' });
      if (respuesta.ok) { mostrarAlerta('Usuario eliminado'); this.cargarUsuarios(); }
    } catch (error) { mostrarAlerta('Error al eliminar usuario', 'danger'); }
  },

  // ============================================
  // ROLES
  // ============================================
  async cargarRoles() {
    try {
      const respuesta = await fetch(`${API_BASE}/roles`);
      const datos = await respuesta.json();
      const roles = obtenerDatosRespuesta(datos);
      const tbody = document.getElementById('tbodyRoles');
      tbody.innerHTML = '';
      roles.forEach(r => {
        const fila = document.createElement('tr');
        fila.innerHTML = `<td>${r.id_rol}</td><td>${r.nombre_rol}</td><td>${r.descripcion || '-'}</td><td><button class="btn btn-outline-custom btn-sm" onclick="app.editarRol(${r.id_rol})"><i class="bi bi-pencil"></i></button><button class="btn btn-danger-custom btn-sm" onclick="app.eliminarRol(${r.id_rol})"><i class="bi bi-trash"></i></button></td>`;
        tbody.appendChild(fila);
      });
    } catch (error) { console.error('Error cargando roles:', error); mostrarAlerta('Error al cargar roles', 'danger'); }
  },

  async guardarRolModal() {
    const nombre_rol = document.getElementById('mrNombre').value;
    const descripcion = document.getElementById('mrDescripcion').value;
    try {
      const respuesta = await fetch(`${API_BASE}/roles`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_rol, descripcion })
      });
      const datos = await respuesta.json();
      if (respuesta.ok) {
        mostrarAlerta('Rol creado exitosamente');
        bootstrap.Modal.getInstance(document.getElementById('modalRol')).hide();
        document.getElementById('formRolModal').reset();
        this.cargarRoles();
      } else { mostrarAlerta(datos.error || 'Error al crear rol', 'danger'); }
    } catch (error) { console.error('Error guardando rol:', error); mostrarAlerta('Error al guardar rol', 'danger'); }
  },

  async editarRol(id) {
    mostrarAlerta('Función de edición de rol en desarrollo', 'warning');
  },

  async eliminarRol(id) {
    if (!confirm('¿Está seguro de eliminar este rol?')) return;
    try {
      const respuesta = await fetch(`${API_BASE}/roles/${id}`, { method: 'DELETE' });
      if (respuesta.ok) { mostrarAlerta('Rol eliminado'); this.cargarRoles(); }
    } catch (error) { mostrarAlerta('Error al eliminar rol', 'danger'); }
  },

  // ============================================
  // REPORTES
  // ============================================
  async cargarTopClientes() {
    try {
      const respuesta = await fetch(`${API_BASE}/reportes/top-clientes`);
      const datos = await respuesta.json();
      const clientes = obtenerDatosRespuesta(datos);
      const tbody = document.getElementById('tbodyTopClientes');
      tbody.innerHTML = '';
      clientes.forEach((c, i) => {
        const fila = document.createElement('tr');
        fila.innerHTML = `<td>${i + 1}</td><td>${c.nombre_empresa}</td><td>${c.total_compras}</td><td class="price-cell">${formatearMoneda(c.monto_total)}</td>`;
        tbody.appendChild(fila);
      });
    } catch (error) { console.error('Error cargando top clientes:', error); }
  },

  async cargarServiciosVendidos() {
    try {
      const respuesta = await fetch(`${API_BASE}/reportes/servicios-vendidos`);
      const datos = await respuesta.json();
      const servicios = obtenerDatosRespuesta(datos);
      const tbody = document.getElementById('tbodyServiciosVendidos');
      tbody.innerHTML = '';
      servicios.forEach((s, i) => {
        const fila = document.createElement('tr');
        fila.innerHTML = `<td>${i + 1}</td><td>${s.nombre_servicio}</td><td>${s.total_vendido}</td><td class="price-cell">${formatearMoneda(s.ingresos_generados)}</td>`;
        tbody.appendChild(fila);
      });
    } catch (error) { console.error('Error cargando servicios vendidos:', error); }
  },

  async cargarRangoFechas(e) {
    e.preventDefault();
    const fecha_inicio = document.getElementById('fechaInicio').value;
    const fecha_fin = document.getElementById('fechaFin').value;
    try {
      const respuesta = await fetch(`${API_BASE}/reportes/ventas-rango-fechas?fecha_inicio=${fecha_inicio}&fecha_fin=${fecha_fin}`);
      const datos = await respuesta.json();
      const ventas = obtenerDatosRespuesta(datos);
      const tbody = document.getElementById('tbodyRangoFechas');
      tbody.innerHTML = '';
      ventas.forEach(v => {
        const fila = document.createElement('tr');
        fila.innerHTML = `<td>${v.id_venta}</td><td>${formatearFecha(v.fecha_venta)}</td><td>${v.cliente}</td><td>${v.vendedor}</td><td class="price-cell">${formatearMoneda(v.valor_total)}</td>`;
        tbody.appendChild(fila);
      });
    } catch (error) { console.error('Error cargando ventas por rango:', error); mostrarAlerta('Error al cargar reporte', 'danger'); }
  },

  async cargarVentasVendedor(e) {
    e.preventDefault();
    const fecha_inicio = document.getElementById('vFechaInicio').value;
    const fecha_fin = document.getElementById('vFechaFin').value;
    try {
      const respuesta = await fetch(`${API_BASE}/reportes/ventas-vendedor?fecha_inicio=${fecha_inicio}&fecha_fin=${fecha_fin}`);
      const datos = await respuesta.json();
      const vendedores = obtenerDatosRespuesta(datos);
      const tbody = document.getElementById('tbodyVendedor');
      tbody.innerHTML = '';
      vendedores.forEach(v => {
        const fila = document.createElement('tr');
        fila.innerHTML = `<td>${v.vendedor}</td><td>${v.total_ventas}</td><td class="price-cell">${formatearMoneda(v.monto_total)}</td>`;
        tbody.appendChild(fila);
      });
    } catch (error) { console.error('Error cargando ventas por vendedor:', error); mostrarAlerta('Error al cargar reporte', 'danger'); }
  },

  async cargarVentasMes(e) {
    e.preventDefault();
    const mes = document.getElementById('repMes').value;
    const anio = document.getElementById('repAnio').value;
    try {
      const respuesta = await fetch(`${API_BASE}/reportes/ventas-mensuales?mes=${mes}&anio=${anio}`);
      const datos = await respuesta.json();
      const ventas = obtenerDatosRespuesta(datos);
      const tbody = document.getElementById('tbodyMes');
      tbody.innerHTML = '';
      ventas.forEach(v => {
        const fila = document.createElement('tr');
        fila.innerHTML = `<td>${v.id_venta}</td><td>${v.cliente}</td><td>${v.vendedor}</td><td>${formatearFecha(v.fecha_venta)}</td><td class="price-cell">${formatearMoneda(v.valor_total)}</td>`;
        tbody.appendChild(fila);
      });
    } catch (error) { console.error('Error cargando ventas mensuales:', error); mostrarAlerta('Error al cargar reporte', 'danger'); }
  },

  async cargarPropuestasEstado() {
    try {
      const respuesta = await fetch(`${API_BASE}/reportes/propuestas-estado`);
      const datos = await respuesta.json();
      const propuestas = obtenerDatosRespuesta(datos);
      const tbody = document.getElementById('tbodyPropuestasEstado');
      tbody.innerHTML = '';
      propuestas.forEach(p => {
        const fila = document.createElement('tr');
        fila.innerHTML = `<td>${p.estado}</td><td>${p.cantidad}</td><td class="price-cell">${formatearMoneda(p.monto_total)}</td>`;
        tbody.appendChild(fila);
      });
    } catch (error) { console.error('Error cargando propuestas estado:', error); }
  },

  async cargarSeguimientoReporte(e) {
    e.preventDefault();
    const id_cliente = document.getElementById('repIdCliente').value;
    try {
      const respuesta = await fetch(`${API_BASE}/reportes/historial-cliente?id_cliente=${id_cliente}`);
      const datos = await respuesta.json();
      const historial = obtenerDatosRespuesta(datos);
      const tbody = document.getElementById('tbodySeguimientoReporte');
      tbody.innerHTML = '';
      historial.forEach(s => {
        const fila = document.createElement('tr');
        fila.innerHTML = `<td>${s.id_registro}</td><td>${formatearFecha(s.Fecha)}</td><td>${s.Tipo_Registro}</td><td>${s.Detalle}</td><td>${s.Responsable || '-'}</td>`;
        tbody.appendChild(fila);
      });
    } catch (error) { console.error('Error cargando seguimiento reporte:', error); mostrarAlerta('Error al cargar reporte', 'danger'); }
  },

  async cargarActividadWeb(e) {
    e.preventDefault();
    const fecha_inicio = document.getElementById('awFechaInicio').value;
    const fecha_fin = document.getElementById('awFechaFin').value;
    try {
      const respuesta = await fetch(`${API_BASE}/reportes/actividad-web?fecha_inicio=${fecha_inicio}&fecha_fin=${fecha_fin}`);
      const datos = await respuesta.json();
      const actividades = obtenerDatosRespuesta(datos);
      const tbody = document.getElementById('tbodyActividadWeb');
      tbody.innerHTML = '';
      actividades.forEach(a => {
        const fila = document.createElement('tr');
        fila.innerHTML = `<td>${a.accion}</td><td>${a.cantidad}</td><td>${formatearFecha(a.fecha)}</td>`;
        tbody.appendChild(fila);
      });
    } catch (error) { console.error('Error cargando actividad web:', error); mostrarAlerta('Error al cargar reporte', 'danger'); }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const usuario = JSON.parse(sessionStorage.getItem('zimbra_usuario'));
  if (!usuario) {
    window.location.href = 'login.html';
    return;
  }

  app.actualizarDatosUsuario();

  const cargarSeccionDesdeHash = () => {
    const hash = window.location.hash.replace('#', '').trim();
    app.cambiarSeccion(null, hash || 'dashboard');
  };

  window.addEventListener('hashchange', cargarSeccionDesdeHash);
  app.inicializar();
  cargarSeccionDesdeHash();

  document.getElementById('formVenta').addEventListener('submit', (e) => app.registrarVenta(e));
  document.getElementById('formRangoFechas').addEventListener('submit', (e) => app.cargarRangoFechas(e));
  document.getElementById('formVendedor').addEventListener('submit', (e) => app.cargarVentasVendedor(e));
  document.getElementById('formMes').addEventListener('submit', (e) => app.cargarVentasMes(e));
  document.getElementById('formSeguimientoReporte').addEventListener('submit', (e) => app.cargarSeguimientoReporte(e));
  document.getElementById('formActividadWeb').addEventListener('submit', (e) => app.cargarActividadWeb(e));
  if (['Administrador', 'Vendedor'].includes(usuario.rol)) {
    app.cargarPropuestasEstado();
    app.cargarServiciosVendidos();
  }
  if (usuario.rol === 'Administrador') app.cargarTopClientes();
});
