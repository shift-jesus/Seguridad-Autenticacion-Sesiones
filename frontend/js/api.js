/**
 * api.js
 * -----------------------------------------------------------------------
 * Wrapper centralizado para hablar con el backend v2.
 *
 * PUNTO CLAVE: `credentials: "include"` le dice al navegador que ENVIE
 * la cookie de sesion en cada peticion (y que acepte la que el servidor
 * le mande). Sin esto, el navegador no adjunta cookies cross-origin.
 *
 * El token CSRF (double-submit cookie) se lee de document.cookie y se
 * envia en el header X-CSRF-Token en toda mutacion.
 * -----------------------------------------------------------------------
 */

const API_BASE =
  ["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.port !== "3000"
    ? "http://localhost:3000/api"
    : "/api";

function getCookie(name) {
  const valor = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return valor ? decodeURIComponent(valor.split("=")[1]) : null;
}

const MUTACIONES = new Set(["POST", "PUT", "DELETE", "PATCH"]);

async function llamarApi(ruta, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (MUTACIONES.has(method)) {
    const csrf = getCookie("csrfToken");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }
  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    method,
    credentials: "include",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(datos.mensaje || datos.error || "Error en la peticion");
    error.status = respuesta.status;
    error.detalles = datos;
    throw error;
  }
  return datos;
}

const Api = {
  registro: (d) => llamarApi("/auth/registro", { method: "POST", body: d }),
  verificar: (token) => llamarApi(`/auth/verificar/${token}`),
  login: (d) => llamarApi("/auth/login", { method: "POST", body: d }),
  verificar2fa: (d) => llamarApi("/auth/verificar-2fa", { method: "POST", body: d }),
  logout: () => llamarApi("/auth/logout", { method: "POST" }),
  me: () => llamarApi("/auth/me"),
  actualizarPerfil: (d) => llamarApi("/auth/perfil", { method: "PUT", body: d }),
  cambiarPassword: (d) => llamarApi("/auth/cambiar-password", { method: "PUT", body: d }),
  recuperar: (d) => llamarApi("/auth/recuperar", { method: "POST", body: d }),
  recuperarReset: (d) => llamarApi("/auth/recuperar-reset", { method: "POST", body: d }),

  notas: (params) => llamarApi("/notas?" + new URLSearchParams(params || {})),
  crearNota: (d) => llamarApi("/notas", { method: "POST", body: d }),
  actualizarNota: (id, d) => llamarApi(`/notas/${id}`, { method: "PUT", body: d }),
  eliminarNota: (id) => llamarApi(`/notas/${id}`, { method: "DELETE" }),
  restaurarNota: (id) => llamarApi(`/notas/${id}/restaurar`, { method: "POST" }),

  dashboard: () => llamarApi("/dashboard"),
  actividad: (params) => llamarApi("/actividad?" + new URLSearchParams(params || {})),

  sesiones: () => llamarApi("/sesiones"),
  revocarSesion: (sid) => llamarApi(`/sesiones/${sid}`, { method: "DELETE" }),
  cerrarTodasSesiones: () => llamarApi("/sesiones/cerrar-todas", { method: "POST" }),

  mfaEstado: () => llamarApi("/mfa/estado"),
  configurar2fa: (d) => llamarApi("/mfa/totp/configurar", { method: "POST", body: d }),
  activar2fa: (d) => llamarApi("/mfa/totp/activar", { method: "POST", body: d }),
  desactivar2fa: (d) => llamarApi("/mfa/totp/desactivar", { method: "POST", body: d }),

  adminStats: () => llamarApi("/admin/stats"),
  adminUsuarios: (p) => llamarApi("/admin/usuarios?" + new URLSearchParams(p || {})),
  adminCambiarEstado: (id, d) => llamarApi(`/admin/usuarios/${id}`, { method: "PATCH", body: d }),
  adminResetPassword: (id) => llamarApi(`/admin/usuarios/${id}/reset-password`, { method: "POST" }),
  adminEliminarUsuario: (id) => llamarApi(`/admin/usuarios/${id}`, { method: "DELETE" }),

  exportar: () => llamarApi("/cuenta/exportar"),
  eliminarCuenta: () => llamarApi("/cuenta", { method: "DELETE" }),
  notificaciones: () => llamarApi("/cuenta/notificaciones"),
  marcarNotifLeida: (id) => llamarApi(`/cuenta/notificaciones/${id}/leer`, { method: "POST" }),
};