// @ts-nocheck
import { useState } from "react";

import { Brand } from "../components/Brand.jsx";
import { apiJson, getStoredUser, getToken, storeSession } from "../lib/api.js";

export function LoginPage() {
  const [mode, setMode] = useState(getToken() && getStoredUser()?.must_change_password ? "password" : "login");
  const [form, setForm] = useState({ username: "", password: "", newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(event) { setForm({ ...form, [event.target.name]: event.target.value }); }

  async function login(event) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const data = await apiJson("/auth/login", { method: "POST", body: JSON.stringify({ username: form.username, password: form.password }) });
      storeSession(data.token, data.user);
      if (data.user.must_change_password) setMode("password");
      else window.location.replace("/");
    } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }

  async function changePassword(event) {
    event.preventDefault(); setError("");
    if (form.newPassword !== form.confirmPassword) return setError("New passwords do not match.");
    if (form.newPassword.length < 8) return setError("New password must be at least 8 characters.");
    setBusy(true);
    try {
      await apiJson("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: form.password, new_password: form.newPassword }) });
      const user = { ...getStoredUser(), must_change_password: false };
      storeSession(getToken(), user);
      window.location.replace("/");
    } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }

  return (
    <div className="login-page">
      <div className="login-glow login-glow--one" /><div className="login-glow login-glow--two" />
      <section className="login-card">
        <Brand />
        <div className="login-card__intro">
          <span className="eyebrow">Emma 3.0</span>
          <h1>{mode === "login" ? "Welcome back" : "Set a new password"}</h1>
          <p>{mode === "login" ? "Sign in to your secure AI workspace." : "Your administrator issued a temporary password."}</p>
        </div>
        <form onSubmit={mode === "login" ? login : changePassword}>
          {mode === "login" && <label>Username<input autoFocus name="username" value={form.username} onChange={update} autoComplete="username" required /></label>}
          <label>{mode === "login" ? "Password" : "Current password"}<input name="password" type="password" value={form.password} onChange={update} autoComplete="current-password" required /></label>
          {mode === "password" && <>
            <label>New password<input name="newPassword" type="password" value={form.newPassword} onChange={update} autoComplete="new-password" required /></label>
            <label>Confirm password<input name="confirmPassword" type="password" value={form.confirmPassword} onChange={update} autoComplete="new-password" required /></label>
          </>}
          {error && <div className="alert alert--error">{error}</div>}
          <button className="button button--wide" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Change password"}</button>
        </form>
        <footer>Local-first knowledge. Secure model access.</footer>
      </section>
    </div>
  );
}
