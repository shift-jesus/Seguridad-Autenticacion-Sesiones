/**
 * api.js
 * -----------------------------------------------------------------------
 * Wrapper centralizado para hablar con el backend.
 *
 * PUNTO CLAVE: `credentials: "include"` le dice al navegador que
 * ENVIE la cookie de sesion en cada peticion (y que acepte la que
 * el servidor le mande en el login). Sin esta opcion, el navegador
 * no adjunta cookies en peticiones cross-origin.
 *
 * Como la cookie es HTTP-Only, este archivo JAMAS puede leerla ni
 * manipularla directamente -- eso es intencional y es justamente
 * la proteccion que da HTTP-Only contra robo de sesion via XSS.
 * -----------------------------------------------------------------------
 */

const API_BASE = "http://localhost:3000/api";

async function llamarApi(ruta, { method = "GET", body } = {}) {
  const respuesta = await fetch(`${API_BASE}${ruta}`, {
    method,
    credentials: "include", // <-- envia/recibe la cookie httpOnly de sesion
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    const error = new Error(datos.error || "Error en la peticion");
    error.status = respuesta.status;
    error.detalles = datos;
    throw error;
  }

  return datos;
}

const Api = {
  registro: (datos) => llamarApi("/auth/registro", { method: "POST", body: datos }),
  login: (datos) => llamarApi("/auth/login", { method: "POST", body: datos }),
  logout: () => llamarApi("/auth/logout", { method: "POST" }),
  me: () => llamarApi("/auth/me"),
  actualizarPerfil: (datos) => llamarApi("/auth/perfil", { method: "PUT", body: datos }),
  cambiarPassword: (datos) => llamarApi("/auth/cambiar-password", { method: "PUT", body: datos }),
  dashboard: () => llamarApi("/dashboard"),
  actividad: () => llamarApi("/actividad"),
  usuariosAdmin: () => llamarApi("/admin/usuarios"),
  notas: () => llamarApi("/notas"),
  crearNota: (datos) => llamarApi("/notas", { method: "POST", body: datos }),
  eliminarNota: (id) => llamarApi(`/notas/${id}`, { method: "DELETE" }),
};
