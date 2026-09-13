/**
 * admin.js
 * -----------------------------------------------------------------------
 * Panel admin: estadisticas, listado paginado con busqueda/filtro, y
 * acciones (activar/desactivar, reset de contrasena, eliminar).
 * ----------------------------------------------------------------------- */
const alertaError = document.getElementById("alerta-error");
const alertaExito = document.getElementById("alerta-exito");
function mostrarError(m) {
  alertaExito.style.display = "none";
  alertaError.textContent = m;
  alertaError.style.display = "block";
}
function mostrarExito(m) {
  alertaError.style.display = "none";
  alertaExito.textContent = m;
  alertaExito.style.display = "block";
  setTimeout(() => (alertaExito.style.display = "none"), 6000);
}

document.getElementById("btn-volver").addEventListener("click", () => (window.location.href = "dashboard.html"));

const buscarInput = document.getElementById("buscar-users");
const filtroRol = document.getElementById("filtro-rol");
let pagina = 1;
const porPagina = 10;

async function cargarStats() {
  try {
    const s = await Api.adminStats();
    document.getElementById("st-usuarios").textContent = s.usuarios;
    document.getElementById("st-notas").textContent = s.notasActivas;
    document.getElementById("st-2fa").textContent = s.usuariosCon2fa;
    document.getElementById("st-act24").textContent = s.actividad24h;
  } catch {
    /* stats opcionales */
  }
}

async function cargarUsuarios() {
  try {
    const params = {
      pagina,
      porPagina,
      q: buscarInput.value.trim(),
      rol: filtroRol.value,
    };
    const r = await Api.adminUsuarios(params);
    const tbody = document.getElementById("tabla-usuarios");
    tbody.innerHTML = r.usuarios
      .map(
        (u) => `
        <tr>
          <td>${u.id}</td>
          <td>${u.nombre.replace(/</g, "&lt;")}</td>
          <td>${u.email.replace(/</g, "&lt;")}</td>
          <td>${u.rol}</td>
          <td>${u.activo ? '<span class="chip-rol">activo</span>' : '<span class="chip-rol chip-rojo">inactivo</span>'}${u.email_verificado === 0 ? " <span class=\"chip-rol\">email?</span>" : ""}</td>
          <td class="acciones-tabla">
            <button class="btn-mini" data-toggle="${u.id}" data-activo="${u.activo}">${u.activo ? "Desactivar" : "Activar"}</button>
            <button class="btn-mini" data-reset="${u.id}">Reset pass</button>
            <button class="btn-mini btn-peligro" data-elim="${u.id}">Borrar</button>
          </td>
        </tr>`
      )
      .join("");

    // Paginacion
    const pag = document.getElementById("paginacion");
    pag.innerHTML = "";
    const desde = Math.max(1, pagina - 2);
    const hasta = Math.min(r.paginas, pagina + 2);
    for (let i = desde; i <= hasta; i++) {
      const b = document.createElement("button");
      b.textContent = i;
      b.className = "btn-mini" + (i === pagina ? " activo-pag" : "");
      b.addEventListener("click", () => {
        pagina = i;
        cargarUsuarios();
      });
      pag.appendChild(b);
    }

    tbody.querySelectorAll("[data-toggle]").forEach((b) => {
      b.addEventListener("click", () => toggleEstado(b.dataset.toggle, b.dataset.activo));
    });
    tbody.querySelectorAll("[data-reset]").forEach((b) => {
      b.addEventListener("click", () => resetPass(b.dataset.reset));
    });
    tbody.querySelectorAll("[data-elim]").forEach((b) => {
      b.addEventListener("click", () => eliminar(b.dataset.elim));
    });
  } catch (e) {
    if (e.status === 403 || e.status === 401) {
      alertaError.textContent = "No autorizado";
      alertaError.style.display = "block";
    } else mostrarError("Error cargando usuarios");
  }
}

async function toggleEstado(id, activo) {
  try {
    const r = await Api.adminCambiarEstado(id, { activo: activo !== "true" });
    mostrarExito(r.mensaje);
    cargarUsuarios();
  } catch (e) {
    mostrarError(e.detalles?.error || "Error");
  }
}

async function resetPass(id) {
  try {
    const r = await Api.adminResetPassword(id);
    mostrarExito(`Nueva contrasena temporal: ${r.nuevaContrasena} — compartela de forma segura.`);
  } catch (e) {
    mostrarError(e.detalles?.error || "Error");
  }
}

async function eliminar(id) {
  if (!confirm("Eliminar este usuario y todos sus datos? (requiere reconfirmar)")) return;
  if (!confirm("De verdad eliminar al usuario #" + id + "?")) return;
  try {
    const r = await Api.adminEliminarUsuario(id);
    mostrarExito(r.mensaje);
    cargarUsuarios();
    cargarStats();
  } catch (e) {
    mostrarError(e.detalles?.error || "Error");
  }
}

buscarInput.addEventListener("input", () => {
  clearTimeout(buscarInput._t);
  buscarInput._t = setTimeout(() => {
    pagina = 1;
    cargarUsuarios();
  }, 350);
});
filtroRol.addEventListener("change", () => {
  pagina = 1;
  cargarUsuarios();
});

cargarStats();
cargarUsuarios();