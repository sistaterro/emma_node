import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { initializeSchema } from "./schema.js";

/** @param {string} databasePath Open and initialize an Emma SQLite database. */
export function openDatabase(databasePath) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  initializeSchema(database);
  return database;
}
