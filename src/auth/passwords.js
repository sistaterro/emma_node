import bcrypt from "bcryptjs";

/** @param {string} password Hash a plaintext password without blocking the event loop. */
export function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

/** @param {string} password Hash a bootstrap password during schema initialization. */
export function hashPasswordSync(password) {
  return bcrypt.hashSync(password, 10);
}

/** @param {string} password @param {string} passwordHash Verify a plaintext password. */
export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}
