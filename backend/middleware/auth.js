/**
 * middleware/auth.js
 * -----------------------------------------------------------------------
 * AUTENTICACION  ->  "quien eres?"  (requireAuth)
 * AUTORIZACION   ->  "que puedes hacer?" (requireRole)
 *
 * Son dos pasos distintos y en ese orden: primero se verifica identidad,
 * luego se verifica si esa identidad tiene permiso para la accion.
 * -----------------------------------------------------------------------
 */

/**
 * Verifica que exista una sesion activa y valida (AUTENTICACION).
 * express-session ya se encarga de leer la cookie, verificar la firma
 * y cargar los datos asociados en req.session.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.usuarioId) {
    return res.status(401).json({
      error: "No autenticado",
      mensaje: "Debes iniciar sesion para acceder a este recurso.",
    });
  }
  return next();
}

/**
 * Verifica que el usuario autenticado tenga uno de los roles permitidos
 * (AUTORIZACION). Debe usarse SIEMPRE despues de requireAuth.
 * @param  {...string} rolesPermitidos
 */
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
