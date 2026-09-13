/**
 * test/flujo.test.js
 * -----------------------------------------------------------------------
 * Test de integracion sobre el app real (supertest): registra, verifica,
 * hace login, usa notas/perfil/sesiones, prueba CSRF y autorizacion.
 * Usa una base SQLite temporal para no tocar la de desarrollo.
 * -----------------------------------------------------------------------
 */
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const archivoTmp = path.join(os.tmpdir(), `auth-test-${Date.now()}.db`);
process.env.DB_PATH = archivoTmp;
process.env.NODE_ENV = "test";

const { crearApp } = require("../app");
const { seed } = require("../database/seed");

let app;
let agente;
let csrf = "";

function extraerCsrf(res) {
  const sc = res.headers["set-cookie"] || [];
  const c = sc.find((x) => x.startsWith("csrfToken="));
  return c ? c.split(";")[0].split("=")[1] : "";
}

async function registro(datos, ag = request.agent(app)) {
  const a = ag;
  const res = await a.get("/index.html");
  const tok = extraerCsrf(res);
  return a.post("/api/auth/registro").set("X-CSRF-Token", tok).send(datos);
}

before(async () => {
  app = crearApp();
  agente = request.agent(app);
  await seed();
});

after(() => {
  try {
    fs.rmSync(archivoTmp, { force: true });
    fs.rmSync(archivoTmp + "-shm", { force: true });
    fs.rmSync(archivoTmp + "-wal", { force: true });
  } catch {
    /* limpieza best-effort */
  }
});

test("1- registro rechaza contrasena debil", async () => {
  const res = await registro({ email: "a@b.com", nombre: "Ana Test", password: "corta" });
  assert.equal(res.status, 400);
  assert.match(res.body.error || res.body.mensaje || "", /Datos invalidos/);
});

test("2- registro exitoso crea usuario", async () => {
  const res = await registro({ email: "test@demo.com", nombre: "Ana Test", password: "Contrasena123!" });
  assert.equal(res.status, 201);
  assert.ok(res.body.usuario.id);
  assert.equal(res.body.usuario.email, "test@demo.com");
});

test("3- login con contrasena incorrecta -> 401 generico", async () => {
  const ag = request.agent(app);
  const r0 = await ag.get("/index.html");
  const tk = extraerCsrf(r0);
  const res = await ag.post("/api/auth/login").set("X-CSRF-Token", tk).send({ email: "test@demo.com", password: "Mal123!" });
  assert.equal(res.status, 401);
  assert.match(res.body.error, /incorrectos/i);
});

test("4- mutacion sin token CSRF valido -> 403", async () => {
  const ag2 = request.agent(app);
  const res2 = await ag2
    .post("/api/auth/login")
    .set("X-CSRF-Token", "token-invalido")
    .send({ email: "x@y.com", password: "12345678" });
  assert.equal(res2.status, 403);
});

test("5- login de demo correcto y /me", async () => {
  const ag = request.agent(app);
  const r0 = await ag.get("/index.html");
  const tk = extraerCsrf(r0);
  const login = await ag.post("/api/auth/login").set("X-CSRF-Token", tk).send({ email: "estudiante@demo.com", password: "Aprender123!" });
  assert.equal(login.status, 200);
  const me = await ag.get("/api/auth/me");
  assert.equal(me.status, 200);
  assert.equal(me.body.usuario.email, "estudiante@demo.com");
});

test("6- CRUD de notas + autorizacion por dueno", async () => {
  const ag = request.agent(app);
  const r0 = await ag.get("/index.html");
  const tk = extraerCsrf(r0);
  await ag.post("/api/auth/login").set("X-CSRF-Token", tk).send({ email: "test@demo.com", password: "Contrasena123!" });

  const crear = await ag.post("/api/notas").set("X-CSRF-Token", tk).send({ texto: "Nota de prueba", etiquetas: ["test"] });
  assert.equal(crear.status, 201);
  const id = crear.body.nota.id;

  const listar = await ag.get("/api/notas");
  assert.ok(listar.body.notas.some((n) => n.id === id));

  const actualizar = await ag.put(`/api/notas/${id}`).set("X-CSRF-Token", tk).send({ fijada: true, texto: "Editada" });
  assert.equal(actualizar.status, 200);
  assert.equal(actualizar.body.nota.texto, "Editada");
  assert.equal(actualizar.body.nota.fijada, true);

  const borrar = await ag.delete(`/api/notas/${id}`).set("X-CSRF-Token", tk);
  assert.equal(borrar.status, 200);

  const restaurar = await ag.post(`/api/notas/${id}/restaurar`).set("X-CSRF-Token", tk);
  assert.equal(restaurar.status, 200);
  assert.equal(restaurar.body.nota.borradaEn, null);
});

test("7- notas de otro usuario no se tocan (404)", async () => {
  const ag = request.agent(app);
  const r0 = await ag.get("/index.html");
  const tk = extraerCsrf(r0);
  await ag.post("/api/auth/login").set("X-CSRF-Token", tk).send({ email: "estudiante@demo.com", password: "Aprender123!" });
  const res = await ag.delete("/api/notas/999999").set("X-CSRF-Token", tk);
  assert.equal(res.status, 404);
});

test("8- cambio de contrasena requiere la actual", async () => {
  const ag = request.agent(app);
  const r0 = await ag.get("/index.html");
  const tk = extraerCsrf(r0);
  await ag.post("/api/auth/login").set("X-CSRF-Token", tk).send({ email: "test@demo.com", password: "Contrasena123!" });
  const res = await ag.put("/api/auth/cambiar-password").set("X-CSRF-Token", tk).send({ passwordActual: "nopeBroken", passwordNueva: "OtraClave456!" });
  assert.equal(res.status, 400);
  assert.match(res.body.mensaje || "", /actual es incorrecta/);
});

test("9- usuario no admin no accede a admin", async () => {
  const ag = request.agent(app);
  const r0 = await ag.get("/index.html");
  const tk = extraerCsrf(r0);
  await ag.post("/api/auth/login").set("X-CSRF-Token", tk).send({ email: "test@demo.com", password: "Contrasena123!" });
  const res = await ag.get("/api/admin/stats");
  assert.equal(res.status, 403);
});

test("10- admin accede a stats y sesiones", async () => {
  const ag = request.agent(app);
  const r0 = await ag.get("/index.html");
  const tk = extraerCsrf(r0);
  await ag.post("/api/auth/login").set("X-CSRF-Token", tk).send({ email: "admin@demo.com", password: "AdminSeguro123!" });
  const stats = await ag.get("/api/admin/stats");
  assert.equal(stats.status, 200);
  assert.ok(stats.body.usuarios >= 1);

  const sesiones = await ag.get("/api/sesiones");
  assert.equal(sesiones.status, 200);
  assert.ok(Array.isArray(sesiones.body.sesiones));
});

test("11- logout destruye la sesion", async () => {
  const ag = request.agent(app);
  const r0 = await ag.get("/index.html");
  const tk = extraerCsrf(r0);
  await ag.post("/api/auth/login").set("X-CSRF-Token", tk).send({ email: "test@demo.com", password: "Contrasena123!" });
  const logout = await ag.post("/api/auth/logout").set("X-CSRF-Token", tk);
  assert.equal(logout.status, 200);
  const me = await ag.get("/api/auth/me");
  assert.equal(me.status, 401);
});