/**
 * perfil.js
 * -----------------------------------------------------------------------
 * Gestiona: datos basicos, 2FA/TOTP (QR + activacion + desactivacion),
 * cambio de contrasena, exportar datos y borrar cuenta.
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
  setTimeout(() => (alertaExito.style.display = "none"), 4000);
}

document.getElementById("btn-volver").addEventListener("click", () => (window.location.href = "dashboard.html"));

/* ------------------------------ Carga ------------------------------- */
Promise.all([Api.me(), Api.mfaEstado()])
  .then(([me, mfa]) => {
    const us = me.usuario;
    document.getElementById("chip-rol").textContent = us.rol;
    document.getElementById("perfil-nombre").value = us.nombre;
    document.getElementById("perfil-email").value = us.email;
    document.getElementById("perfil-creado").textContent = `Miembro desde ${new Date(us.creado_en || us.creadoEn || new Date()).toLocaleDateString()}`;
    pintar2FA(mfa.activo);
  })
  .catch((e) => {
    if (e.status === 401) window.location.href = "index.html";
    else mostrarError("Error cargando el perfil");
  });

function pintar2FA(activo) {
  document.getElementById("estado-2fa").textContent = activo ? "Activo" : "Inactivo";
  document.getElementById("2fa-activo").style.display = activo ? "" : "none";
  document.getElementById("2fa-inactivo").style.display = activo ? "none" : "";
}

/* --------------------------- Actualizar perfil ---------------------- */
document.getElementById("form-perfil").addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = document.getElementById("btn-perfil");
  boton.disabled = true;
  try {
    const r = await Api.actualizarPerfil({ nombre: document.getElementById("perfil-nombre").value.trim() });
    mostrarExito(r.mensaje);
  } catch (err) {
    mostrarError(err.detalles?.error || "No se pudo actualizar");
  } finally {
    boton.disabled = false;
  }
});

/* --------------------------- Configurar 2FA -------------------------- */
document.getElementById("form-configurar-2fa").addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = e.target.querySelector("button");
  boton.disabled = true;
  try {
    const r = await Api.configurar2fa({ password: document.getElementById("pass-2fa").value });
    document.getElementById("2fa-setup").style.display = "";
    document.getElementById("qr-img").src = r.qrCodeUrl;
    document.getElementById("secreto-2fa").textContent = `Secreto: ${r.secreto}`;
  } catch (err) {
    mostrarError(err.detalles?.error || "No se pudo generar el QR");
  } finally {
    boton.disabled = false;
  }
});

document.getElementById("form-activar-2fa").addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = e.target.querySelector("button");
  boton.disabled = true;
  try {
    const r = await Api.activar2fa({ codigo: document.getElementById("codigo-activar").value.trim() });
    document.getElementById("2fa-setup").style.display = "none";
    document.getElementById("backup-codes").style.display = "";
    document.getElementById("lista-backup").textContent = r.backupCodes.join("  ·  ");
    pintar2FA(true);
    mostrarExito("2FA activado. Guarda tus codigos de respaldo.");
  } catch (err) {
    mostrarError(err.detalles?.error || "El codigo no coincide");
  } finally {
    boton.disabled = false;
  }
});

document.getElementById("form-desactivar-2fa").addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = e.target.querySelector("button");
  boton.disabled = true;
  try {
    const r = await Api.desactivar2fa({ codigo: document.getElementById("codigo-desactivar").value.trim() });
    document.getElementById("backup-codes").style.display = "none";
    pintar2FA(false);
    mostrarExito(r.mensaje);
  } catch (err) {
    mostrarError(err.detalles?.error || "Codigo incorrecto");
  } finally {
    boton.disabled = false;
  }
});

/* ------------------------ Cambiar contrasena ------------------------ */
document.getElementById("form-password").addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = e.target.querySelector("button");
  boton.disabled = true;
  try {
    const r = await Api.cambiarPassword({
      passwordActual: document.getElementById("pass-actual").value,
      passwordNueva: document.getElementById("pass-nueva").value,
    });
    mostrarExito(r.mensaje);
    setTimeout(() => (window.location.href = "index.html"), 1200);
  } catch (err) {
    boton.disabled = false;
    mostrarError(err.detalles?.error || "No se pudo cambiar");
  }
});

/* --------------------------- Exportar / borrar ---------------------- */
document.getElementById("btn-exportar").addEventListener("click", async () => {
  try {
    const datos = await Api.exportar();
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mis-datos.json";
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    mostrarError("No se pudo exportar");
  }
});

document.getElementById("btn-eliminar-cuenta").addEventListener("click", async () => {
  const ok = confirm("Esto borrara TU CUENTA y TODOS tus datos. Esta accion no se puede deshacer. Continuar?");
  if (!ok) return;
  const doble = confirm("Ultima chance. Seguro que quieres eliminar tu cuenta?");
  if (!doble) return;
  try {
    await Api.eliminarCuenta();
    window.location.href = "index.html";
  } catch (err) {
    mostrarError(err.detalles?.error || "No se pudo eliminar la cuenta");
  }
});