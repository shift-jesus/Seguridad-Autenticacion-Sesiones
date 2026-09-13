/**
 * middleware/csrf.js
 * -----------------------------------------------------------------------
 * Proteccion CSRF con el patron "double submit cookie":
 *   - A cada cliente se le entrega una cookie NO httpOnly (csrfToken),
 *     que el frontend puede leer para mandarla en el header X-CSRF-Token.
 *   - En toda mutacion (POST/PUT/DELETE/PATCH) se compara el header
 *     contra la cookie. Sin match => 403.
 *
 * La cookie adicional sobre SameSite=Lax es defensa en profundidad:
 * un atacante cross-site no puede inyectar headers personalizados, y un
 * formulario tradicional no puede rellenar el header X-CSRF-Token.
 * -----------------------------------------------------------------------
 */
const crypto = require("node:crypto");
const env = require("../config/env");

const METODOS_MUTACION = new Set(["POST", "PUT", "DELETE", "PATCH"]);

function nuevaFirma() {
  return crypto.randomBytes(24).toString("hex");
}

function csrf(opciones = {}) {
  const nombre = opciones.nombre || env.csrfCookieName;

  return (req, res, next) => {
    const valorCookie = req.cookies?.[nombre];

    // Todas las mutaciones DEBEN traer header == cookie.
    if (METODOS_MUTACION.has(req.method)) {
      const header = req.headers["x-csrf-token"];
      if (!valorCookie || !header || header !== valorCookie) {
        return res.status(403).json({
          error: "Token CSRF invalido",
          mensaje: "La peticion no tiene un token CSRF valido. Recarga la pagina.",
        });
      }
    }

    // Entrega/renueva la cookie (misma firm adentro de la misma 'unidad').
    if (!valorCookie) {
      res.cookie(nombre, nuevaFirma(), {
        httpOnly: false, // debe poder leerla JS para mandarla en el header
        secure: env.isProd,
        sameSite: "strict",
        maxAge: env.sessionAbsoluteMaxAgeMs,
        path: "/",
      });
    }

    return next();
  };
}

module.exports = csrf;