# Conceptos: Autenticación y Sesiones

Material de apoyo para la clase **"Seguridad: Autenticación y Sesiones"**.

## 1. Autenticación vs. Autorización

| | Autenticación | Autorización |
|---|---|---|
| Pregunta | ¿Quién eres? | ¿Qué puedes hacer? |
| Cuándo ocurre | Primero (login) | Después, en cada acción |
| Ejemplo en el proyecto | `POST /api/auth/login` valida email + contraseña | `requireRole("admin")` protege `/api/admin/usuarios` |
| Falla típica | Credenciales incorrectas → 401 | Usuario válido sin permiso → 403 |

**Regla de oro:** primero se autentica, luego se autoriza. Un usuario autenticado no necesariamente está autorizado para todo.

## 2. Control de sesiones tradicionales

Una sesión es un mecanismo para que el servidor "recuerde" que un usuario ya se identificó, sin pedirle usuario y contraseña en cada petición.

Flujo clásico (el que implementa este proyecto):

1. El usuario envía sus credenciales una vez (`/login`).
2. El servidor las valida y crea un **registro de sesión** en su propio almacén (memoria, Redis, base de datos).
3. El servidor genera un **ID de sesión** aleatorio y lo envía al navegador dentro de una cookie.
4. En cada petición siguiente, el navegador reenvía esa cookie automáticamente.
5. El servidor busca ese ID en su almacén y así sabe quién es el usuario, sin volver a pedir contraseña.

Esto es distinto de otros esquemas como **JWT** (donde el propio token contiene la información y no requiere almacén en el servidor). Vale la pena mencionar ambos enfoques y sus trade-offs:

- **Sesiones en servidor**: fáciles de revocar (basta con borrar el registro), pero requieren estado compartido si hay varios servidores.
- **JWT sin estado**: escalan mejor entre servidores, pero son difíciles de revocar antes de que expiren.

## 3. Cookies HTTP-Only

Una cookie marcada como `HttpOnly` **no puede ser leída ni modificada por JavaScript** en el navegador (`document.cookie` simplemente no la muestra).

¿Por qué importa? Si un atacante logra inyectar código malicioso en la página (un ataque **XSS**), ese código no podrá robar la cookie de sesión, porque el navegador la oculta de JavaScript.

En este proyecto, la cookie se configura en `backend/server.js`:

```js
cookie: {
  httpOnly: true,   // JS no puede leerla -> mitiga robo por XSS
  secure: isProd,   // solo viaja por HTTPS en producción
  sameSite: "lax",  // mitiga CSRF básico
  maxAge: 30 * 60 * 1000,
}
```

Otras banderas relevantes de una cookie de sesión:

- `Secure`: la cookie solo se envía sobre HTTPS.
- `SameSite=Lax/Strict`: limita el envío de la cookie en peticiones iniciadas desde otros sitios (mitiga CSRF).
- `Max-Age` / `Expires`: define cuánto dura la sesión antes de caducar.

## 4. Manejo seguro de credenciales del usuario

Reglas aplicadas en `backend/routes/auth.js` y `backend/utils/seed.js`:

- **Nunca** se guarda la contraseña en texto plano. Se guarda un **hash** con `bcrypt`, que:
  - Incluye un "salt" aleatorio distinto para cada usuario (evita tablas rainbow).
  - Es intencionalmente lento, para dificultar ataques de fuerza bruta.
- El login responde con el **mismo mensaje de error genérico** tanto si el email no existe como si la contraseña es incorrecta, para no revelar qué correos están registrados.
- Los intentos de login están limitados por IP (`express-rate-limit`) para dificultar ataques de fuerza bruta online.
- El ID de sesión se **regenera** en cada login exitoso (mitiga *session fixation*).

## 5. Buenas prácticas y problemas comunes

Buenas prácticas cubiertas en el proyecto:

- Cookies `HttpOnly` + `Secure` + `SameSite`.
- Hash de contraseñas con `bcrypt` y salt automático.
- Rate limiting en endpoints sensibles (login).
- Mensajes de error genéricos para evitar enumeración de usuarios.
- Separación clara entre middleware de autenticación (`requireAuth`) y de autorización (`requireRole`).
- Expiración de sesión (`maxAge`) y renovación en cada request (`rolling: true`).
- Cabeceras de seguridad HTTP vía `helmet`.

Errores comunes que este proyecto evita a propósito (y que vale la pena señalar en clase):

- Guardar contraseñas en texto plano o con hash débil (MD5, SHA1 sin salt).
- Usar `localStorage` para guardar tokens de sesión (vulnerable a robo vía XSS, a diferencia de una cookie `HttpOnly`).
- Dejar la cookie de sesión sin `HttpOnly` ni `Secure`.
- No invalidar la sesión anterior al hacer login (*session fixation*).
- Dar mensajes de error distintos para "usuario no existe" vs "contraseña incorrecta".
- No limitar los intentos de login (fuerza bruta).
- Confundir autenticación con autorización (revisar solo "¿está logueado?" sin revisar "¿tiene permiso para esto?").

## 6. Ideas para extender la mini app en clase

- Agregar verificación de email al registrarse.
- Agregar "recordarme" (sesión de larga duración) vs sesión corta.
- Agregar cierre de sesión en todos los dispositivos (invalidar todas las sesiones de un usuario).
- Migrar el almacén de sesiones en memoria a Redis (`connect-redis`) para producción.
- Comparar esta implementación con un login basado en JWT y discutir diferencias.
