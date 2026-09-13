/**
 * registro.js
 * -----------------------------------------------------------------------
 * Valida en vivo con la politica de contrasena, muestra medidor de fuerza
 * y envia el registro. Tras registrarse, indica verificar email en consola.
 * -----------------------------------------------------------------------
 */
const form = document.getElementById("form-registro");
const btnRegistro = document.getElementById("btn-registro");
const alertaError = document.getElementById("alerta-error");
const alertaExito = document.getElementById("alerta-exito");
const inputPass = document.getElementById("password");

const req = {
  len: document.getElementById("req-len"),
  may: document.getElementById("req-may"),
  min: document.getElementById("req-min"),
  num: document.getElementById("req-num"),
  sim: document.getElementById("req-sim"),
};

function cumple(pass) {
  return {
    len: pass.length >= 8,
    may: /[A-Z]/.test(pass),
    min: /[a-z]/.test(pass),
    num: /[0-9]/.test(pass),
    sim: /[^A-Za-z0-9]/.test(pass),
  };
}

inputPass.addEventListener("input", () => {
  const c = cumple(inputPass.value);
  const orden = [["len", req.len], ["may", req.may], ["min", req.min], ["num", req.num], ["sim", req.sim]];
  let cumplidos = 0;
  for (const [k, el] of orden) {
    el.classList.toggle("ok", c[k]);
    if (c[k]) cumplidos++;
  }
  const barra = document.getElementById("fuerza-barra");
  const pct = (cumplidos / 5) * 100;
  barra.style.width = `${pct}%`;
  barra.className = pct === 100 ? "fuerte" : pct >= 60 ? "media" : "deb";
});

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const nombre = document.getElementById("nombre").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = inputPass.value;

  const c = cumple(password);
  if (!Object.values(c).every(Boolean)) {
    alertaExito.style.display = "none";
    alertaError.textContent = "La contrasena no cumple la politica de seguridad.";
    alertaError.style.display = "block";
    return;
  }

  btnRegistro.disabled = true;
  btnRegistro.textContent = "Creando cuenta...";
  try {
    const r = await Api.registro({ nombre, email, password });
    alertaError.style.display = "none";
    alertaExito.textContent = r.mensaje || "Cuenta creada. Revisa la consola del servidor para verificar tu email.";
    alertaExito.style.display = "block";
    setTimeout(() => (window.location.href = "index.html"), 1500);
  } catch (error) {
    alertaExito.style.display = "none";
    alertaError.textContent = error.detalles?.error || error.message || "No se pudo crear la cuenta";
    alertaError.style.display = "block";
  } finally {
    btnRegistro.disabled = false;
    btnRegistro.textContent = "Crear cuenta";
  }
});