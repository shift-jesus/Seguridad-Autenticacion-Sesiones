/**
 * database/seed.js
 * -----------------------------------------------------------------------
 * Usuarios de prueba (idempotente). Guarda los hashes bcrypt, nunca las
 * contrasenas en claro. Tambien crea algunas notas y actividad de ejemplo
 * para que el dashboard no arranque vacio.
 * -----------------------------------------------------------------------
 */
const bcrypt = require("bcryptjs");
const usuariosRepo = require("./repositories/usuarios");
const notasRepo = require("./repositories/notas");
const actividadRepo = require("./repositories/actividad");
const env = require("../config/env");

const DEMO = [
  {
    email: "estudiante@demo.com",
    nombre: "Estudiante Demo",
    password: "Aprender123!",
    rol: "usuario",
    notas: [
      { texto: "Estudiar autenticacion y sesiones", etiquetas: ["clase", "urgencia"] },
      { texto: "La cookie es HttpOnly: JS no puede leerla", etiquetas: ["apunte"] },
    ],
  },
  {
    email: "admin@demo.com",
    nombre: "Admin Demo",
    password: "AdminSeguro123!",
    rol: "admin",
    notas: [
      { texto: "Revisar usos de /api/admin", etiquetas: ["admin"] },
      { texto: "Preparar clase sobre 2FA/TOTP", etiquetas: ["clase"] },
    ],
  },
];

async function seed() {
  const saltRounds = env.bcryptSaltRounds;

  for (const d of DEMO) {
    if (usuariosRepo.buscarPorEmail(d.email)) continue;

    const passwordHash = await bcrypt.hash(d.password, saltRounds);
    const usuario = usuariosRepo.crear({
      email: d.email,
      nombre: d.nombre,
      passwordHash,
      rol: d.rol,
    });

    // Los usuarios demo ya vienen con email verificado.
    usuariosRepo.setEmailVerificado(usuario.id, true);

    for (const n of d.notas) {
      notasRepo.crear(usuario.id, n.texto, n.etiquetas);
    }
    actividadRepo.registrar(usuario.id, "Cuenta de prueba creada");
  }

  // Salud de datos (solo si hay registros recien creados).
  const total = usuariosRepo.listar({ porPagina: 1 }).total;
  // eslint-disable-next-line no-console
  console.log(`[seed] ${total} usuario(s). Demos: estudiante@demo.com / Aprender123!  y  admin@demo.com / AdminSeguro123!`);
  return { usuarioCon1: true };
}

module.exports = { seed };

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      process.exit(1);
    });
}