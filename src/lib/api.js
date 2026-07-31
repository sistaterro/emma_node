const TOKEN_KEY = "emma_token";
const USER_KEY = "emma_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? "null");
  } catch {
    return null;
  }
}

/** @param {string} token @param {unknown} user */
export function storeSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("emma_active");
}

/** @param {string} path @param {RequestInit} [options] */
export async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  const token = getToken();

  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...options, headers });
  if (response.status === 401) clearSession();
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = /** @type {{detail?: string, message?: string}} */ (await response.json());
      message = payload.detail ?? payload.message ?? message;
    } catch {
      // Keep the status-based fallback for non-JSON responses.
    }
    throw new Error(message);
  }
  return response;
}

/** @param {string} path @param {RequestInit} [options] */
export async function apiJson(path, options = {}) {
  const response = await api(path, options);
  return response.json();
}
