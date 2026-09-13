/**
 * services/validadores.js
 * -----------------------------------------------------------------------
 * Validacion centralizada (con express-validator) y politica de
 * contrasenas. Separa "que es válido" de la logica de negocio.
 * -----------------------------------------------------------------------
 */
const { body, query, param } = require("express-validator");
const env = require("../config/env");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarEmailValor(v) {
  return typeof v === "string" && EMAIL_RE.test(v.trim());
}

/**
 * Politica de contrasena: longitud + complejidad minima.
 * Devuelve { valida, errores }.
 */
function checkPassword(pass) {
  const errores = [];
  if (typeof pass !== "string") return { valida: false, errores: ["Contrasena requerida"] };
  if (pass.length < env.passwordMinLength) {
    errores.push(`Minimo ${env.passwordMinLength} caracteres`);
  }
  if (pass.length > env.passwordMaxLength) errores.push(`Maximo ${env.passwordMaxLength} caracteres`);
  if (!/[A-Z]/.test(pass)) errores.push("Al menos una mayuscula");
  if (!/[a-z]/.test(pass)) errores.push("Al menos una minuscula");
  if (!/[0-9]/.test(pass)) errores.push("Al menos un numero");
  if (!/[^A-Za-z0-9]/.test(pass)) errores.push("Al menos un simbolo");
  return { valida: errores.length === 0, errores };
}

const validarEmail = body("email").trim().toLowerCase().isEmail().withMessage("Email invalido").normalizeEmail({ gmail_remove_dots: false });

const validarNombre = body("nombre").trim().isLength({ min: 2, max: 80 }).withMessage("Nombre entre 2 y 80 caracteres");

/** Para login solo comprobamos que exista y no este vacio. */
const validarPasswordLogin = body("password").isString().isLength({ min: 1 }).withMessage("Contrasena requerida");

/** Registro / cambio de contrasena: exige la politica completa. */
function validarPasswordNueva(campo = "password") {
  return body(campo)
    .isString()
    .custom((v) => checkPassword(v).valida)
    .withMessage(
      () =>
        `Politica de contrasena: minimo ${env.passwordMinLength} caracteres, mayuscula, minuscula, numero y simbolo`
    )
    .bail();
}

const validarQueryPagina = [
  query("q").optional().trim().isLength({ max: 80 }).withMessage("Busqueda demasiado larga"),
  query("pagina").optional().isInt({ min: 1 }).withMessage("Pagina invalida"),
  query("porPagina").optional().isInt({ min: 1, max: 100 }).withMessage("Tamano de pagina invalido"),
];

const validarNotaTexto = body("texto").trim().isLength({ min: 1, max: 500 }).withMessage("La nota debe tener entre 1 y 500 caracteres");

const validarNotaEtiquetas = body("etiquetas").optional().custom((v) => {
  if (!Array.isArray(v)) return false;
  return v.every((e) => typeof e === "string" && e.length >= 1 && e.length <= 30 && /^[a-zA-Z0-9 _-]+$/.test(e));
}).withMessage("Etiquetas invalidas (max 30 caracteres, sin simbolos raros)");

module.exports = {
  EMAIL_RE,
  validarEmailValor,
  checkPassword,
  validarEmail,
  validarNombre,
  validarPasswordLogin,
  validarPasswordNueva,
  validarQueryPagina,
  validarNotaTexto,
  validarNotaEtiquetas,
};