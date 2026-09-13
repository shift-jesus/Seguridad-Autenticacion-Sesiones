/**
 * login.js
 * -----------------------------------------------------------------------
 * Maneja el envio del formulario de login y la redireccion posterior.
 *
 * NOTA sobre "persistencia de sesion": al llamar Api.login(), el backend
 * responde con un header `Set-Cookie` que el navegador guarda automatica-
 * mente (porque la peticion se hizo con credentials: "include"). Esa
 * cookie viaja sola en cada peticion futura, asi que si el usuario
 * recarga la pagina o cierra y abre el navegador, la sesion sigue activa
 * mientras la cookie no haya expirado ni se haya cerrado sesion.
 * -----------------------------------------------------------------------
 */

const form = document.getElementById("form-login");
const btnLogin = document.getElementById("btn-login");
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

// Si ya existe una sesion activa (cookie valida), redirige directo.
(async function verificarSesionExistente() {
  try {
    await Api.me();
    window.location.href = "dashboard.html";
  } catch {
    // No autenticado: se queda en el login. Comportamiento esperado.
  }
})();

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  btnLogin.disabled = true;
  btnLogin.textContent = "Entrando...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const resultado = await Api.login({ email, password });
    mostrarExito(`Bienvenido, ${resultado.usuario.nombre}. Redirigiendo...`);
    setTimeout(() => (window.location.href = "dashboard.html"), 600);
  } catch (error) {
    mostrarError(error.detalles?.error || "No se pudo iniciar sesion");
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = "Entrar";
  }
});
