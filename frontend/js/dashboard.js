/**
 * dashboard.js
 * -----------------------------------------------------------------------
 * Carga /api/auth/me; si 401, redirige al login. Gestiona notas (CRUD),
 * actividad reciente, banner de email sin verificar, 2FA, tema y logout.
 * -----------------------------------------------------------------------
 */
const elSaludo = document.getElementById("saludo");
const elChipRol = document.getElementById("chip-rol");
const elInfoSesion = document.getElementById("info-sesion");
const elStatVisitas = document.getElementById("stat-visitas");
const elStatNotif = document.getElementById("stat-notif");
const elAlertaError = document.getElementById("alerta-error");
const elAlertaExito = document.getElementById("alerta-exito");
const btnLogout = document.getElementById("btn-logout");
const badgeNotif = document.getElementById("badge-notif");
const bannerVerificar = document.getElementById("banner-verificar");

const elFormNota = document.getElementById("form-nota");
const elInputNota = document.getElementById("input-nota");
const elInputEtiqueta = document.getElementById("input-etiqueta");
const elListaNotas = document.getElementById("lista-notas");
const buscarNotas = document.getElementById("buscar-notas");

const elListaActividad = document.getElementById("lista-actividad");

let usuarioActual = null;
let misNotas = [];

function formatearFecha(iso) {
  if (!iso) return "desconocida";
  return new Date(iso).toLocaleString();
}

function mostrarError(m) {
  elAlertaExito.style.display = "none";
  elAlertaError.textContent = m;
  elAlertaError.style.display = "block";
}
function mostrarExito(m) {
  elAlertaError.style.display = "none";
  elAlertaExito.textContent = m;
  elAlertaExito.style.display = "block";
  setTimeout(() => (elAlertaExito.style.display = "none"), 4000);
}

async function cargarDashboard() {
  try {
    const { usuario, sesion } = await Api.me();
    usuarioActual = usuario;

    elSaludo.textContent = `Hola, ${usuario.nombre} 👋`;
    elChipRol.textContent = usuario.rol;
    elInfoSesion.textContent = `Sesion iniciada: ${formatearFecha(sesion.creadaEn)} · Expira: ${formatearFecha(sesion.expiraEn)}`;

    if (usuario.rol === "admin") document.getElementById("lnk-admin").classList.remove("oculto");

    const datosDashboard = await Api.dashboard();
    elStatVisitas.textContent = datosDashboard.datos.visitas;
    elStatNotif.textContent = datosDashboard.datos.notificaciones;
    if (datosDashboard.datos.notificacionesPendientes > 0) {
      badgeNotif.textContent = datosDashboard.datos.notificacionesPendientes;
      badgeNotif.classList.remove("oculto");
    }

    if (usuario.email_verificado === 0) {
      bannerVerificar.style.display = "block";
      bannerVerificar.classList.remove("oculto");
    }

    await Promise.all([cargarNotas(), cargarActividad()]);
  } catch (error) {
    if (error.status === 401) {
      window.location.href = "index.html";
      return;
    }
    mostrarError("Ocurrio un error cargando el dashboard.");
  }
}

/* ------------------------------- Notas ------------------------------ */
async function cargarNotas() {
  const q = buscarNotas.value.trim();
  const { notas } = await Api.notas(q ? { q } : {});
  misNotas = notas;
  renderNotas(notas);
}

function renderNotas(notas) {
  if (!notas.length) {
    elListaNotas.innerHTML = `<li class="vacio">Sin notas. Agrega la primera en el campo de arriba.</li>`;
    return;
  }
  elListaNotas.innerHTML = notas
    .map(
      (n) => `
        <li data-id="${n.id}">
          <div class="nota-cuerpo">
            ${n.fijada ? '<span class="nota-pin">&#128204;</span>' : ""}
            <div>
              <p class="nota-texto"></p>
              <div class="nota-meta">
                <span class="nota-fecha">${formatearFecha(n.creadoEn)}</span>
                ${(n.etiquetas || []).map((t) => `<span class="chip-tag">#${t}</span>`).join("")}
              </div>
            </div>
          </div>
          <div class="nota-acciones">
            <button class="btn-mini" data-pin="${n.id}">${n.fijada ? "Desfijar" : "Fijar"}</button>
            <button class="btn-mini" data-editar="${n.id}">Editar</button>
            <button class="btn-mini btn-peligro" data-eliminar="${n.id}">Eliminar</button>
          </div>
        </li>`
    )
    .join("");

  // Texto via textContent para evitar XSS.
  notas.forEach((n) => {
    const li = elListaNotas.querySelector(`li[data-id="${n.id}"]`);
    if (li) li.querySelector(".nota-texto").textContent = n.texto;
  });

  elListaNotas.querySelectorAll("[data-pin]").forEach((b) => {
    b.addEventListener("click", () => togglePin(b.dataset.pin));
  });
  elListaNotas.querySelectorAll("[data-editar]").forEach((b) => {
    b.addEventListener("click", () => editarNota(b.dataset.editar));
  });
  elListaNotas.querySelectorAll("[data-eliminar]").forEach((b) => {
    b.addEventListener("click", () => eliminarNota(b.dataset.eliminar));
  });
}

async function togglePin(id) {
  const nota = misNotas.find((n) => n.id === id);
  if (!nota) return;
  try {
    await Api.actualizarNota(id, { fijada: !nota.fijada });
    await cargarNotas();
  } catch (e) {
    mostrarError(e.detalles?.error || "Error al fijar la nota");
  }
}

async function editarNota(id) {
  const nota = misNotas.find((n) => n.id === id);
  if (!nota) return;
  const nuevoTexto = prompt("Editar nota", nota.texto);
  if (nuevoTexto === null) return;
  try {
    await Api.actualizarNota(id, { texto: nuevoTexto.trim() });
    await cargarNotas();
    mostrarExito("Nota editada.");
  } catch (e) {
    mostrarError(e.detalles?.error || "Error al editar la nota");
  }
}

async function eliminarNota(id) {
  if (!confirm("Eliminar esta nota? Puedes deshacer desde la consola.")) return;
  try {
    const r = await Api.eliminarNota(id);
    await cargarNotas();
    mostrarExito(r.mensaje || "Nota eliminada.");
  } catch (e) {
    mostrarError(e.detalles?.error || "Error al eliminar");
  }
}

buscarNotas.addEventListener("input", () => {
  clearTimeout(buscarNotas._t);
  buscarNotas._t = setTimeout(cargarNotas, 350);
});

elFormNota.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const texto = elInputNota.value.trim();
  if (!texto) return;
  const etiqueta = elInputEtiqueta.value.trim();
  document.getElementById("btn-crear-nota").disabled = true;
  try {
    await Api.crearNota({ texto, etiquetas: etiqueta ? [etiqueta] : [] });
    elInputNota.value = "";
    elInputEtiqueta.value = "";
    await cargarNotas();
    await cargarActividad();
  } catch (error) {
    mostrarError(error.detalles?.error || "No se pudo crear la nota");
  } finally {
    document.getElementById("btn-crear-nota").disabled = false;
  }
});

/* ------------------------------ Actividad --------------------------- */
async function cargarActividad() {
  const { actividad } = await Api.actividad({ limite: 15 });
  elListaActividad.innerHTML = actividad.length
    ? actividad
        .map(
          (a) =>
            `<li><span class="actividad-accion">${a.accion.replace(/</g, "&lt;")}</span> <span class="nota-fecha">${formatearFecha(a.fecha)}</span></li>`
        )
        .join("")
    : `<li class="vacio">Sin actividad reciente.</li>`;
}

btnLogout.addEventListener("click", async () => {
  btnLogout.disabled = true;
  try {
    await Api.logout();
  } finally {
    window.location.href = "index.html";
  }
});

cargarDashboard();