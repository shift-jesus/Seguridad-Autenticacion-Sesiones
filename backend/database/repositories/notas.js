/**
 * database/repositories/notas.js
 * -----------------------------------------------------------------------
 * Notas personales: cada fila pertenece a un usuario. La autorizacion se
 * hace SIEMPRE con el usuario_id de la sesion, nunca con datos del body.
 * -----------------------------------------------------------------------
 */
const db = require("../db");

function aPublico(n) {
  if (!n) return null;
  let etiquetas = [];
  try {
    etiquetas = JSON.parse(n.etiquetas || "[]");
  } catch {
    etiquetas = [];
  }
  return {
    id: n.id,
    texto: n.texto,
    etiquetas: etiquetas.filter((t) => typeof t === "string"),
    fijada: Boolean(n.fijada),
    creadoEn: n.creado_en,
    actualizadoEn: n.actualizado_en || null,
    borradaEn: n.borrada_en || null,
  };
}

function crear(usuarioId, texto, etiquetas = []) {
  const ahora = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO notas (usuario_id, texto, etiquetas, fijada, creado_en)
       VALUES (?, ?, ?, 0, ?)`
    )
    .run(usuarioId, texto, JSON.stringify(etiquetas), ahora);
  return aPublico(db.prepare("SELECT * FROM notas WHERE id = ?").get(Number(info.lastInsertRowid)));
}

/** Lista notas del usuario con filtros opcionales. Excluye borradas salvo pedido. */
function listar(usuarioId, { q = "", tag = "", soloFijadas = false, incluirBorradas = false } = {}) {
  const filtros = ["usuario_id = ?"];
  const params = [usuarioId];
  if (!incluirBorradas) filtros.push("borrada_en IS NULL");
  if (soloFijadas) filtros.push("fijada = 1");
  if (q) {
    filtros.push("texto LIKE ?");
    params.push(`%${q}%`);
  }
  if (tag) {
    filtros.push("etiquetas LIKE ?");
    params.push(`%"${tag}"%`);
  }
  const filas = db
    .prepare(`SELECT * FROM notas WHERE ${filtros.join(" AND ")} ORDER BY fijada DESC, id DESC`)
    .all(...params);
  return filas.map(aPublico);
}

function buscar(usuarioId, notaId) {
  return db.prepare("SELECT * FROM notas WHERE id = ? AND usuario_id = ?").get(notaId, usuarioId) || null;
}

function actualizar(usuarioId, notaId, { texto, etiquetas, fijada }) {
  const nota = buscar(usuarioId, notaId);
  if (!nota) return null;
  const cambios = [];
  const params = [];
  if (texto !== undefined) {
    cambios.push("texto = ?");
    params.push(texto);
  }
  if (etiquetas !== undefined) {
    cambios.push("etiquetas = ?");
    params.push(JSON.stringify(etiquetas));
  }
  if (fijada !== undefined) {
    cambios.push("fijada = ?");
    params.push(fijada ? 1 : 0);
  }
  cambios.push("actualizado_en = ?");
  params.push(new Date().toISOString());
  params.push(notaId, usuarioId);
  db.prepare(`UPDATE notas SET ${cambios.join(", ")} WHERE id = ? AND usuario_id = ?`).run(...params);
  return aPublico(buscar(usuarioId, notaId));
}

/** Borrado logico (una nota eliminada puede restaurarse / "deshacer"). */
function eliminarSuave(usuarioId, notaId) {
  const nota = buscar(usuarioId, notaId);
  if (!nota || nota.borrada_en) return null;
  db.prepare("UPDATE notas SET borrada_en = ?, actualizado_en = ? WHERE id = ?")
    .run(new Date().toISOString(), new Date().toISOString(), notaId);
  return aPublico(buscar(usuarioId, notaId));
}

function restaurar(usuarioId, notaId) {
  const nota = buscar(usuarioId, notaId);
  if (!nota || !nota.borrada_en) return null;
  db.prepare("UPDATE notas SET borrada_en = NULL WHERE id = ?").run(notaId);
  return aPublico(buscar(usuarioId, notaId));
}

module.exports = { crear, listar, actualizar, eliminarSuave, restaurar };