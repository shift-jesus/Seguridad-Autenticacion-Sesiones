/**
 * sesiones.js
 * -----------------------------------------------------------------------
 * Lista, revoca y cierra sesiones activas ("mis dispositivos").
 * ----------------------------------------------------------------------- */
const alertaError = document.getElementById("alerta-error");
const alertaExito = document.getElementById("alerta-exito");
const lista = document.getElementById("lista-sesiones");
function mostrarError(m) {
  alertaExito.style.display = "none";
  alertaError.textContent = m;
  alertaError.style.display = "block";
}
function mostrarExito(m) {
  alertaError.style.display = "none";
  alertaExito.textContent = m;
  alertaExito.style.display = "block";
  setTimeout(() => (alertaExito.style.display = "none"), 4000);
}

document.getElementById("btn-volver").addEventListener("click", () => (window.location.href = "dashboard.html"));

function uaLegible(ua) {
  if (!ua) return "Dispositivo desconocido";
  let d = "Navegador";
  if (/iPhone/i.test(ua)) d = "iPhone";
  else if (/Android/i.test(ua)) d = "Android";
  else if (/iPad/i.test(ua)) d = "iPad";
  else if (/Windows/i.test(ua)) d = "PC Windows";
  else if (/Macintosh|Mac OS/i.test(ua)) d = "Mac";
  else if (/Linux/i.test(ua)) d = "Linux";
  return d;
}

async function cargar() {
  try {
    const { sesiones } = await Api.sesiones();
    lista.innerHTML = sesiones.length
      ? sesiones
          .map(
            (s) => `
            <li>
              <div>
                <strong>${uaLegible(s.userAgent)}</strong> ${s.actual ? '<span class="chip-rol">esta</span>' : ""}
                <div class="nota-fecha">IP: ${s.ip || "?"} · Creada: ${new Date(s.creadaEn).toLocaleString()} · Ultimo acceso: ${new Date(s.ultimoAcceso).toLocaleString()}</div>
              </div>
              ${s.actual ? "" : `<button class="btn-mini btn-peligro" data-sid="${s.sid}">Revocar</button>`}
            </li>`
          )
          .join("")
      : `<li class="vacio">Sin sesiones activas.</li>`;

    lista.querySelectorAll("[data-sid]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await Api.revocarSesion(btn.dataset.sid);
          mostrarExito("Sesion revocada.");
          cargar();
        } catch (e) {
          mostrarError(e.detalles?.error || "No se pudo revocar");
        }
      });
    });
  } catch (e) {
    if (e.status === 401) window.location.href = "index.html";
    else mostrarError("Error cargando las sesiones");
  }
}

document.getElementById("btn-cerrar-todas").addEventListener("click", async () => {
  if (!confirm("Cerrar sesion en todos los demas dispositivos?")) return;
  try {
    const r = await Api.cerrarTodasSesiones();
    mostrarExito(r.mensaje);
    cargar();
  } catch (e) {
    mostrarError(e.detalles?.error || "Error");
  }
});

cargar();