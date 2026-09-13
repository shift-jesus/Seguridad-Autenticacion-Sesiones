/**
 * database/sessionStore.js
 * -----------------------------------------------------------------------
 * Almacen de sesiones persistente en SQLite.
 *
 * Sustituye al MemoryStore de express-session (que pierde las sesiones al
 * reiniciar y no sirve con varias instancias). Implementa la interfaz
 * Store de express-session sobre la misma base SQLite del proyecto.
 *
 * Buena practica: en produccion con muchas instancias se usaria Redis,
 * pero SQLite compartido ya nos da persistencia real.
 * -----------------------------------------------------------------------
 */
const { Store } = require("express-session");
const db = require("./db");

class SQLiteStore extends Store {
  constructor() {
    super();
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid    TEXT PRIMARY KEY,
        sess   TEXT NOT NULL,
        expire INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
    `);
    // Limpieza periodica de sesiones expiradas
    this._timer = setInterval(() => this._limpiar(), 60 * 1000);
    if (this._timer.unref) this._timer.unref();
  }

  _limpiar() {
    try {
      db.prepare("DELETE FROM sessions WHERE expire < ?").run(Date.now());
    } catch {
      /* noop: limpieza best-effort */
    }
  }

  get(sid, cb) {
    try {
      const fila = db.prepare("SELECT sess FROM sessions WHERE sid = ? AND expire > ?").get(sid, Date.now());
      if (!fila) return cb(null, null);
      cb(null, JSON.parse(fila.sess));
    } catch (err) {
      cb(err);
    }
  }

  set(sid, sesion, cb) {
    try {
      const expira = this._expira(sesion);
      db.prepare(
        `INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire`
      ).run(sid, JSON.stringify(sesion), expira);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  destroy(sid, cb) {
    try {
      db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  touch(sid, sesion, cb) {
    try {
      const expira = this._expira(sesion);
      db.prepare("UPDATE sessions SET expire = ? WHERE sid = ?").run(expira, sid);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  length(cb) {
    try {
      cb(null, db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n);
    } catch (err) {
      cb(err);
    }
  }

  clear(cb) {
    try {
      db.prepare("DELETE FROM sessions").run();
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  all(cb) {
    try {
      const filas = db.prepare("SELECT sid, sess, expire FROM sessions").all();
      cb(null, filas.map((f) => ({ sid: f.sid, sess: JSON.parse(f.sess), expire: f.expire })));
    } catch (err) {
      cb(err);
    }
  }

  _expira(sesion) {
    const cookie = sesion.cookie || {};
    if (cookie.expires) return new Date(cookie.expires).getTime();
    const maxAge = Number(cookie.maxAge) || 1800000;
    return Date.now() + maxAge;
  }
}

// Singleton reutilizado por toda la app
const store = global.__sessionStore || new SQLiteStore();
global.__sessionStore = store;

module.exports = store;