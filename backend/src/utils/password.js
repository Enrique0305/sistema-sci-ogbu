// Manejo de contrasenas con scrypt (modulo nativo `crypto`, sin dependencias).
//
// Formato almacenado: scrypt$N$r$p$<salt base64>$<hash base64>
// Los parametros viajan con el hash, de modo que se pueden endurecer en el
// futuro sin invalidar las claves existentes.
const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAX_LEN = 128;
const MIN_LEN = 10;

async function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(plain, salt, KEYLEN, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64'), derived.toString('base64')].join('$');
}

async function verifyPassword(plain, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const partes = stored.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

  const [, n, r, p, saltB64, hashB64] = partes;
  const salt = Buffer.from(saltB64, 'base64');
  const esperado = Buffer.from(hashB64, 'base64');
  const obtenido = await scrypt(plain, salt, esperado.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return obtenido.length === esperado.length && crypto.timingSafeEqual(obtenido, esperado);
}

// Hash "de relleno" para igualar el tiempo de respuesta cuando el correo no
// existe (evita enumerar usuarios midiendo latencias).
let hashRelleno = null;
async function verificarContraRelleno(plain) {
  if (!hashRelleno) hashRelleno = await hashPassword(crypto.randomBytes(16).toString('hex'));
  await verifyPassword(plain, hashRelleno);
}

/** Devuelve un mensaje de error si la clave no cumple la politica, o null. */
function validarPolitica(plain) {
  if (typeof plain !== 'string') return 'La clave es obligatoria';
  if (plain.length < MIN_LEN) return `La clave debe tener al menos ${MIN_LEN} caracteres`;
  if (plain.length > MAX_LEN) return `La clave no puede superar ${MAX_LEN} caracteres`;
  if (!/[A-Za-z]/.test(plain) || !/[0-9]/.test(plain)) {
    return 'La clave debe combinar letras y numeros';
  }
  return null;
}

// Alfabeto sin caracteres ambiguos (0/O, 1/l/I) para claves temporales
// que el administrador comunica a una persona.
const ALFABETO_LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const ALFABETO_DIGITOS = '23456789';

function generarClaveTemporal(longitud = 12) {
  const todo = ALFABETO_LETRAS + ALFABETO_DIGITOS;
  const pick = (set) => set[crypto.randomInt(set.length)];
  // Garantiza al menos una letra y un digito, y mezcla.
  const chars = [pick(ALFABETO_LETRAS), pick(ALFABETO_DIGITOS)];
  while (chars.length < longitud) chars.push(pick(todo));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

module.exports = {
  hashPassword,
  verifyPassword,
  verificarContraRelleno,
  validarPolitica,
  generarClaveTemporal,
  MIN_LEN,
};
