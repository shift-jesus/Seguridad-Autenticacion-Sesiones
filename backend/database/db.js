/**
 * database/db.js
 * -----------------------------------------------------------------------
 * Conexion a SQLite (modulo nativo de Node 24+). Perdona la "base de
 * datos en memoria" original: ahora los datos y las sesiones persisten
 * entre reinicios.
 *
 * IMPORTANTE (seguridad): la contrasena jamás se guarda en texto plano;
 * solo se almacena su hash bcrypt.
 * -----------------------------------------------------------------------
 */
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const env = require("../config/env");

const dbDir = path.dirname(env.dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new DatabaseSync(env.dbPath);

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

/* ------------------------------------------------------------------ */
/* Esquema                                                             */
/* ------------------------------------------------------------------ */
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    email            TEXT    NOT NULL UNIQUE,
    nombre           TEXT    NOT NULL,
    password_hash    TEXT    NOT NULL,
    rol              TEXT    NOT NULL DEFAULT 'usuario',
    activo           INTEGER NOT NULL DEFAULT 1,
    email_verificado INTEGER NOT NULL DEFAULT 0,
    creado_en        TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notas (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    texto         TEXT    NOT NULL,
    etiquetas     TEXT    NOT NULL DEFAULT '[]',
    fijada        INTEGER NOT NULL DEFAULT 0,
    creado_en     TEXT    NOT NULL,
    actualizado_en TEXT,
    borrada_en    TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_notas_usuario ON notas(usuario_id);
  CREATE INDEX IF NOT EXISTS idx_notas_borrada ON notas(borrada_en);

  CREATE TABLE IF NOT EXISTS actividad (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    accion     TEXT NOT NULL,
    fecha      TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_actividad_usuario ON actividad(usuario_id, id DESC);

  CREATE TABLE IF NOT EXISTS tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo       TEXT NOT NULL,               -- 'verificar_email' | 'reset_password'
    token_hash TEXT NOT NULL,
    expira_en  TEXT NOT NULL,
    usado      INTEGER NOT NULL DEFAULT 0,
    creado_en  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tokens_tipo ON tokens(token_hash);

  CREATE TABLE IF NOT EXISTS mfa (
    usuario_id   INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    secreto      TEXT NOT NULL,
    backup_codes TEXT NOT NULL DEFAULT '[]',
    activo       INTEGER NOT NULL DEFAULT 0,
    creado_en    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sesiones_metadata (
    sid            TEXT PRIMARY KEY,
    usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    ip             TEXT,
    user_agent     TEXT,
    creada_en      TEXT NOT NULL,
    ultimo_acceso  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contrasenas_historial (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    hash       TEXT NOT NULL,
    creado_en  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notificaciones (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    texto      TEXT NOT NULL,
    leida      INTEGER NOT NULL DEFAULT 0,
    creado_en  TEXT NOT NULL
  );
`);

module.exports = db;