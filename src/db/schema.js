import bcrypt from "bcryptjs";

/** @param {import("better-sqlite3").Database} database Create or migrate schema and bootstrap admin. */
export function initializeSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      full_name TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `);

  ensureColumn(database, "users", "full_name", "TEXT");
  ensureColumn(database, "users", "is_active", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(database, "users", "last_login_at", "TEXT");
  ensureColumn(database, "users", "must_change_password", "INTEGER NOT NULL DEFAULT 0");

  const row = /** @type {{count: number} | undefined} */ (database.prepare("SELECT COUNT(*) AS count FROM users").get());
  if (Number(row?.count ?? 0) === 0) {
    database.prepare(`
      INSERT INTO users (
        username, password_hash, role, full_name, is_active, must_change_password, created_at
      ) VALUES (?, ?, 'admin', ?, 1, 1, ?)
    `).run("admin", bcrypt.hashSync("admin1234", 10), "Administrator", new Date().toISOString());
  }
}

/**
 * Add a known schema column when upgrading an older database.
 * @param {import("better-sqlite3").Database} database @param {string} table
 * @param {string} column @param {string} definition
 */
function ensureColumn(database, table, column, definition) {
  const columns = /** @type {Array<{name: string}>} */ (database.prepare(`PRAGMA table_info(${table})`).all());
  if (!columns.some((item) => item.name === column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
