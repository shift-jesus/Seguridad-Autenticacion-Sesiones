/**
 * seed.js
 * -----------------------------------------------------------------------
 * Crea usuarios de prueba con contrasenas correctamente hasheadas.
 * Se ejecuta automaticamente al iniciar el servidor (ver server.js)
 * para que la demo funcione sin pasos manuales.
 * -----------------------------------------------------------------------
 */
const bcrypt = require("bcryptjs");
const { crearUsuario, buscarPorEmail } = require("./db");

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

async function seed() {
  const usuariosDemo = [
    { email: "estudiante@demo.com", nombre: "Estudiante Demo", password: "Aprender123!", rol: "usuario" },
    { email: "admin@demo.com", nombre: "Admin Demo", password: "AdminSeguro123!", rol: "admin" },
  ];

  for (const u of usuariosDemo) {
    if (buscarPorEmail(u.email)) continue; // evita duplicados si se llama dos veces

    // bcrypt.hash aplica un "salt" aleatorio automaticamente y produce
    // un hash distinto cada vez, incluso para la misma contrasena.
    const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);

    crearUsuario({
      email: u.email,
      nombre: u.nombre,
      passwordHash,
      rol: u.rol,
    });
  }

  console.log("Usuarios de prueba listos:");
  console.log("   usuario -> estudiante@demo.com / Aprender123!");
  console.log("   admin   -> admin@demo.com / AdminSeguro123!");
}

module.exports = { seed };

// Permite ejecutar "npm run seed" de forma independiente
if (require.main === module) {
  seed().then(() => process.exit(0));
}
