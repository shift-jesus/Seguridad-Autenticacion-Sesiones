/**
 * middleware/auth.js
 * -----------------------------------------------------------------------
 * AUTENTICACION  ->  "quien eres?"  (requireAuth)
 * AUTORIZACION   ->  "que puedes hacer?" (requireRole)
 *
 * Son dos pasos distintos y en ese orden.
 * -----------------------------------------------------------------------
 */
const sesionesMetadata = require("../database/repositories/sesionesMetadata");
const usuarios = require("../database/repositories/usuarios");

/** Verifica que exista una sesion activa y que el usuario no este baneado. */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.usuarioId) {
    return res.status(401).json({
      error: "No autenticado",
      mensaje: "Debes iniciar sesion para acceder a este recurso.",
    });
  }
  const usuario = usuarios.buscarPorId(req.session.usuarioId);
  if (!usuario) {
    return res.status(401).json({ error: "No autenticado", mensaje: "La cuenta ya no existe." });
  }
  if (!usuario.activo) {
    req.session.destroy(() => {});
    return res.status(403).json({ error: "Cuenta desactivada", mensaje: "Esta cuenta fue desactivada. Contacta al administrador." });
  }

  // Mantiene el registro de ultimo acceso en las "sesiones activas".
  if (req.sessionID) sesionesMetadata.tocar(req.sessionID, usuario.id);
  req.usuarioAutenticado = usuarios.aPublico(usuario);
  return next();
}

/** Verifica (tras requireAuth) que el rol este permitido (AUTORIZACION). */
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    const rolActual = req.session?.rol;
    if (!rolActual || !rolesPermitidos.includes(rolActual)) {
      return res.status(403).json({
        error: "No autorizado",
        mensaje: "Tu cuenta no tiene permisos para realizar esta accion.",
      });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };