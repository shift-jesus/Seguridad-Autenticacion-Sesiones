/**
 * dashboard.js
 * -----------------------------------------------------------------------
 * Al cargar, pide /api/auth/me. Si el backend responde 401 (sin sesion
 * valida), redirige al login. Esto es lo que "protege" esta pagina:
 * la proteccion real ocurre en el SERVIDOR (middleware requireAuth);
 * esta redireccion es solo una mejora de experiencia de usuario.
 *
 * Ademas gestiona:
 *   - Panel de administrador (solo rol admin)
 *   - Notas personales (CRUD)
 *   - Edicion de perfil y cambio de contrasena
 *   - Historial de actividad
 * -----------------------------------------------------------------------
 */

const elSaludo = document.getElementById("saludo");
const elChipRol = document.getElementById("chip-rol");
const elInfoSesion = document.getElementById("info-sesion");
const elStatVisitas = document.getElementById("stat-visitas");
const elStatNotif = document.getElementById("stat-notif");
const elSeccionAdmin = document.getElementById("seccion-admin");
const elTablaUsuarios = document.getElementById("tabla-usuarios");
const elAlertaError = document.getElementById("alerta-error");
const btnLogout = document.getElementById("btn-logout");

const elFormNota = document.getElementById("form-nota");
const elInputNota = document.getElementById("input-nota");
const elListaNotas = document.getElementById("lista-notas");

const elFormPerfil = document.getElementById("form-perfil");
const elPerfilNombre = document.getElementById("perfil-nombre");

const elFormPassword = document.getElementById("form-password");
const elPassActual = document.getElementById("pass-actual");
const elPassNueva = document.getElementById("pass-nueva");

const elListaActividad = document.getElementById("lista-actividad");

let usuarioActual = null;

function formatearFecha(iso) {
  if (!iso) return "desconocida";
  return new Date(iso).toLocaleString();
}

function mostrarError(mensaje) {
  elAlertaError.textContent = mensaje;
  elAlertaError.style.display = "block";
}

function ocultarError() {
  elAlertaError.style.display = "none";
}

async function cargarDashboard() {
  try {
    const { usuario, sesion } = await Api.me();
    usuarioActual = usuario;

    elSaludo.textContent = `Hola, ${usuario.nombre} 👋`;
    elChipRol.textContent = usuario.rol;
    elPerfilNombre.value = usuario.nombre;
    elInfoSesion.textContent = `Sesion iniciada: ${formatearFecha(sesion.creadaEn)} · Expira: ${formatearFecha(sesion.expiraEn)}`;

    const datosDashboard = await Api.dashboard();
    elStatVisitas.textContent = datosDashboard.datos.visitas;
    elStatNotif.textContent = datosDashboard.datos.notificaciones;

    if (usuario.rol === "admin") {
      elSeccionAdmin.classList.remove("oculto");
      const { usuarios } = await Api.usuariosAdmin();
      elTablaUsuarios.innerHTML = usuarios
        .map(
          (u) => `<tr><td>${u.id}</td><td>${u.nombre}</td><td>${u.email}</td><td>${u.rol}</td></tr>`
        )
        .join("");
    }

    await Promise.all([cargarNotas(), cargarActividad()]);
  } catch (error) {
    if (error.status === 401) {
      window.location.href = "index.html";
      return;
    }
    elAlertaError.textContent = "Ocurrio un error cargando el dashboard.";
    elAlertaError.style.display = "block";
  }
}

/* ------------------------------------------------------------------ */
/* Notas                                                               */
/* ------------------------------------------------------------------ */
async function cargarNotas() {
  const { notas } = await Api.notas();
  renderNotas(notas);
}

function renderNotas(notas) {
  if (!notas.length) {
    elListaNotas.innerHTML = `<li class="vacio">Todavia no tienes notas.</li>`;
    return;
  }
  elListaNotas.innerHTML = notas
    .map(
      (n) => `
        <li>
          <div>
            <p class="nota-texto"></p>
            <span class="nota-fecha">${formatearFecha(n.creadoEn)}</span>
          </div>
          <button class="btn-mini" data-eliminar="${n.id}">Eliminar</button>
        </li>`
    )
    .join("");

  const elementos = elListaNotas.querySelectorAll("li");
  notas.forEach((n, i) => {
    elementos[i].querySelector(".nota-texto").textContent = n.texto;
  });

  elListaNotas.querySelectorAll("[data-eliminar]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await Api.eliminarNota(btn.dataset.eliminar);
        renderNotas(notas.filter((n) => n.id !== btn.dataset.eliminar));
        await cargarActividad();
      } catch (error) {
        mostrarError(error.detalles?.error || "No se pudo eliminar la nota");
      }
    });
  });
}

elFormNota.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const texto = elInputNota.value.trim();
  if (!texto) return;

  elFormNota.firstElementChild.disabled = true;
  try {
    await Api.crearNota({ texto });
    elInputNota.value = "";
    await cargarNotas();
    await cargarActividad();
  } catch (error) {
    mostrarError(error.detalles?.error || "No se pudo crear la nota");
  } finally {
    document.getElementById("btn-crear-nota").disabled = false;
  }
});

/* ------------------------------------------------------------------ */
/* Perfil                                                              */
/* ------------------------------------------------------------------ */
async function cargarActividad() {
  const { actividad } = await Api.actividad();
  elListaActividad.innerHTML = actividad.length
    ? actividad
        .map(
          (a) => `<li><span class="actividad-accion"></span> <span class="nota-fecha">${formatearFecha(a.fecha)}</span></li>`
        )
        .join("")
    : `<li class="vacio">Sin actividad reciente.</li>`;

  actividad.forEach((a, i) => {
    const items = elListaActividad.querySelectorAll("li");
    items[i].querySelector(".actividad-accion").textContent = a.accion;
  });
}

elFormPerfil.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const boton = document.getElementById("btn-perfil");
  boton.disabled = true;

  try {
    const resultado = await Api.actualizarPerfil({ nombre: elPerfilNombre.value.trim() });
    usuarioActual = resultado.usuario;
    elSaludo.textContent = `Hola, ${usuarioActual.nombre} 👋`;
    await cargarActividad();
    ocultarError();
  } catch (error) {
    mostrarError(error.detalles?.error || "No se pudo actualizar el perfil");
  } finally {
    boton.disabled = false;
  }
});

/* ------------------------------------------------------------------ */
/* Cambiar contrasena                                                  */
/* ------------------------------------------------------------------ */
elFormPassword.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const boton = document.getElementById("btn-password");
  boton.disabled = true;

  try {
    await Api.cambiarPassword({
      passwordActual: elPassActual.value,
      passwordNueva: elPassNueva.value,
    });
    // La sesion se destruye en el servidor: se obliga a volver al login.
    elListaActividad.innerHTML = "";
    window.location.href = "index.html";
  } catch (error) {
    boton.disabled = false;
    mostrarError(error.detalles?.error || "No se pudo cambiar la contrasena");
  }
});

btnLogout.addEventListener("click", async () => {
  btnLogout.disabled = true;
  try {
    await Api.logout();
  } finally {
    window.location.href = "index.html";
  }
});

cargarDashboard();