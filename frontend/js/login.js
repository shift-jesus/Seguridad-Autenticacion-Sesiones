/**
 * login.js
 * -----------------------------------------------------------------------
 * Maneja login, 2FA pendiente, y toggle de visibilidad de contrasena.
 * Si ya hay sesion activa, redirige al dashboard.
 * -----------------------------------------------------------------------
 */
const form = document.getElementById("form-login");
const btnLogin = document.getElementById("btn-login");
const alertaError = document.getElementById("alerta-error");
const alertaExito = document.getElementById("alerta-exito");
const togglePass = document.getElementById("toggle-pass");
const inputPass = document.getElementById("password");

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

togglePass.addEventListener("click", () => {
  const tipo = inputPass.type === "password" ? "text" : "password";
  inputPass.type = tipo;
  togglePass.innerHTML = tipo === "password" ? "&#128065;" : "&#128064;";
});

(async function verificarSesionExistente() {
  try {
    await Api.me();
    window.location.href = "dashboard.html";
  } catch {
    /* no autenticado: se queda */
  }
})();

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  btnLogin.disabled = true;
  btnLogin.textContent = "Entrando...";

  const email = document.getElementById("email").value.trim();
  const password = inputPass.value;

  try {
    const resultado = await Api.login({ email, password });

    if (resultado.requiere2FA) {
      mostrarExito("Ingresa tu codigo de autenticacion (o codigo de respaldo).");
      form.style.display = "none";
      mostrarForm2FA();
      return;
    }

    mostrarExito(`Bienvenido, ${resultado.usuario.nombre}. Redirigiendo...`);
    setTimeout(() => (window.location.href = "dashboard.html"), 500);
  } catch (error) {
    mostrarError(error.detalles?.error || error.message || "No se pudo iniciar sesion");
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = "Entrar";
  }
});

function mostrarForm2FA() {
  const card = form.parentElement;
  const h2 = document.createElement("h1");
  h2.textContent = "Verificacion 2FA";
  h2.style.marginTop = "20px";

  const f = document.createElement("form");
  f.id = "form-2fa";
  f.innerHTML = `
    <label for="codigo2fa">Codigo TOTP o de respaldo</label>
    <input type="text" id="codigo2fa" required placeholder="123456 o ABCD-EFGH" autocomplete="one-time-code" />
    <button type="submit" class="btn-primario" id="btn-2fa">Verificar</button>
  `;

  card.appendChild(h2);
  card.appendChild(f);

  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btn-2fa");
    btn.disabled = true;
    btn.textContent = "Verificando...";
    try {
      const r = await Api.verificar2fa({
        codigo: document.getElementById("codigo2fa").value.trim(),
      });
      mostrarExito(`${r.usuario.nombre}. Redirigiendo...`);
      setTimeout(() => (window.location.href = "dashboard.html"), 500);
    } catch (err) {
      mostrarError(err.detalles?.error || err.message || "Codigo incorrecto");
      btn.disabled = false;
      btn.textContent = "Verificar";
    }
  });
}
