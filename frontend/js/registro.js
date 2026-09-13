const form = document.getElementById("form-registro");
const btnRegistro = document.getElementById("btn-registro");
const alertaError = document.getElementById("alerta-error");
const alertaExito = document.getElementById("alerta-exito");

function mostrarError(mensaje) {
  alertaExito.style.display = "none";
  alertaError.textContent = mensaje;
  alertaError.style.display = "block";
}

function mostrarExito(mensaje) {
  alertaError.style.display = "none";
  alertaExito.textContent = mensaje;
  alertaExito.style.display = "block";
}

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  btnRegistro.disabled = true;
  btnRegistro.textContent = "Creando cuenta...";

  const nombre = document.getElementById("nombre").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await Api.registro({ nombre, email, password });
    mostrarExito("Cuenta creada. Redirigiendo al login...");
    setTimeout(() => (window.location.href = "index.html"), 800);
  } catch (error) {
    mostrarError(error.detalles?.error || "No se pudo crear la cuenta");
  } finally {
    btnRegistro.disabled = false;
    btnRegistro.textContent = "Crear cuenta";
  }
});
