/**
 * database/repositories/usuarios.js
 * -----------------------------------------------------------------------
 * Acceso a la tabla `usuarios`. Nunca expone el password_hash hacia fuera
 * (ver `aPublico`). Todo el codigo usa estas funciones.
 * -----------------------------------------------------------------------
 */
const db = require("../db");

const COLUMNAS_SIN_HASH = ["id", "email", "nombre", "rol", "activo", "email_verificado", "creado_en"];

function aPublico(u) {
  if (!u) return null;
  const salida = {};
  for (const c of COLUMNAS_SIN_HASH) salida[c] = u[c];
  return salida;
}

function crear({ email, nombre, passwordHash, rol = "usuario" }) {
  const emailN = String(email).trim().toLowerCase();
  const creadoEn = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO usuarios (email, nombre, password_hash, rol, creado_en)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(emailN, nombre.trim(), passwordHash, rol, creadoEn);
  return aPublico(buscarPorId(Number(info.lastInsertRowid)));
}

function buscarPorEmail(email) {
  return db.prepare("SELECT * FROM usuarios WHERE email = ?").get(String(email).trim().toLowerCase()) || null;
}

function buscarPorId(id) {
  return db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id) || null;
}

function actualizarPerfil(id, { nombre }) {
  if (nombre && nombre.trim().length >= 2) {
    db.prepare("UPDATE usuarios SET nombre = ? WHERE id = ?").run(nombre.trim(), id);
  }
  return aPublico(buscarPorId(id));
}

function setPasswordHash(id, passwordHash) {
  return db.prepare("UPDATE usuarios SET password_hash = ? WHERE id = ?").run(passwordHash, id).changes > 0;
}

function setActivo(id, activo) {
  return db.prepare("UPDATE usuarios SET activo = ? WHERE id = ?").run(activo ? 1 : 0, id).changes > 0;
}

function setEmailVerificado(id, verificado) {
  return db.prepare("UPDATE usuarios SET email_verificado = ? WHERE id = ?").run(verificado ? 1 : 0, id).changes > 0;
}

/** Lista paginada y filtrable (admin). Total en la misma consulta. */
function listar({ q = "", rol = "", pagina = 1, porPagina = 25 } = {}) {
  const filtros = [];
  const params = [];
  if (q) {
    filtros.push("(email LIKE ? OR nombre LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  if (rol) {
    filtros.push("rol = ?");
    params.push(rol);
  }
  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
  const offset = (pagina - 1) * porPagina;

  const total = db.prepare(`SELECT COUNT(*) AS n FROM usuarios ${where}`).get(...params).n;
  const filas = db
    .prepare(`SELECT * FROM usuarios ${where} ORDER BY id ASC LIMIT ? OFFSET ?`)
    .all(...params, porPagina, offset);
  return {
    total,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
    pagina,
    usuarios: filas.map(aPublico),
  };
}

function stats() {
  const r = db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM usuarios) AS usuarios,
       (SELECT COUNT(*) FROM usuarios WHERE activo = 1) AS usuariosActivos,
       (SELECT COUNT(*) FROM usuarios WHERE email_verificado = 1) AS emailsVerificados,
       (SELECT COUNT(*) FROM notas) AS notas,
       (SELECT COUNT(*) FROM notas WHERE borrada_en IS NULL) AS notasActivas,
       (SELECT COUNT(*) FROM notas WHERE fijada = 1) AS notasFijadas,
       (SELECT COUNT(*) FROM actividad WHERE fecha >= datetime('now','-24 hours')) AS actividad24h,
       (SELECT COUNT(*) FROM mfa WHERE activo = 1) AS usuariosCon2fa,
       (SELECT COUNT(*) FROM notificaciones WHERE leida = 0) AS notificacionesPendientes`
  ).get();
  r.roles = db.prepare("SELECT rol, COUNT(*) AS n FROM usuarios GROUP BY rol").all();
  return r;
}

function eliminar(id) {
  return db.prepare("DELETE FROM usuarios WHERE id = ?").run(id).changes > 0;
}

module.exports = {
  aPublico,
  crear,
  buscarPorEmail,
  buscarPorId,
  actualizarPerfil,
  setPasswordHash,
  setActivo,
  setEmailVerificado,
  listar,
  stats,
  eliminar,
};