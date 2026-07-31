// @ts-nocheck
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "../components/AppShell.jsx";
import { apiJson } from "../lib/api.js";

const emptyForm = { username: "", full_name: "", role: "user", password: "" };

export function AdminPage({ user }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetTarget, setResetTarget] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");

  async function loadUsers() {
    setLoading(true);
    try { setUsers((await apiJson("/admin/users")).users); setError(""); }
    catch (reason) { setError(reason.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadUsers(); }, []);

  const stats = useMemo(() => ({ total: users.length, active: users.filter((item) => item.is_active).length, admins: users.filter((item) => item.role === "admin").length }), [users]);
  function update(event) { const { name, value } = event.target; setForm((current) => ({ ...current, [name]: value })); }

  async function submit(event) {
    event.preventDefault(); setError(""); setMessage("");
    try {
      const body = editing ? { username: form.username, full_name: form.full_name, role: form.role } : form;
      await apiJson(editing ? `/admin/users/${editing.id}` : "/admin/users", { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) });
      setMessage(editing ? "User updated." : "User created with a temporary password.");
      setForm(emptyForm); setEditing(null); await loadUsers();
    } catch (reason) { setError(reason.message); }
  }

  function beginEdit(target) { setEditing(target); setForm({ username: target.username, full_name: target.full_name ?? "", role: target.role, password: "" }); }
  async function toggle(target) {
    try { await apiJson(`/admin/users/${target.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !target.is_active }) }); await loadUsers(); }
    catch (reason) { setError(reason.message); }
  }
  async function resetPassword(event) {
    event.preventDefault();
    if (!resetTarget || temporaryPassword.length < 8) return;
    try { await apiJson(`/admin/users/${resetTarget.id}/reset-password`, { method: "POST", body: JSON.stringify({ password: temporaryPassword }) }); setMessage("Temporary password saved."); setResetTarget(null); setTemporaryPassword(""); await loadUsers(); }
    catch (reason) { setError(reason.message); }
  }
  async function remove(target) {
    if (!window.confirm(`Delete ${target.username}? This cannot be undone.`)) return;
    try { await apiJson(`/admin/users/${target.id}`, { method: "DELETE" }); setMessage("User deleted."); await loadUsers(); }
    catch (reason) { setError(reason.message); }
  }

  return <AppShell user={user} active="/admin">
    <header className="page-header"><div><span className="eyebrow">Administration</span><h1>User management</h1><p>Create accounts and control access to Emma.</p></div><button className="button" onClick={() => { setEditing(null); setForm(emptyForm); document.getElementById("user-form")?.scrollIntoView({ behavior: "smooth" }); }}>+ New user</button></header>
    <section className="stat-grid"><div><span>Total users</span><strong>{stats.total}</strong></div><div><span>Active accounts</span><strong>{stats.active}</strong></div><div><span>Administrators</span><strong>{stats.admins}</strong></div></section>
    {error && <div className="alert alert--error">{error}</div>}{message && <div className="alert alert--success">{message}</div>}
    <section className="panel"><div className="panel__header"><div><h2>Workspace users</h2><p>Roles and account status are enforced by the backend.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last login</th><th>Actions</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="5">Loading users…</td></tr> : users.map((target) => <tr key={target.id}><td><strong>{target.full_name || target.username}</strong><small>@{target.username}</small></td><td><span className="tag">{target.role.replace("_", " ")}</span></td><td><span className={`status ${target.is_active ? "status--active" : "status--off"}`}>{target.is_active ? "Active" : "Disabled"}</span>{target.must_change_password && <small>Temporary password</small>}</td><td>{target.last_login_at ? new Date(target.last_login_at).toLocaleString() : "Never"}</td><td><div className="table-actions"><button onClick={() => beginEdit(target)}>Edit</button><button onClick={() => { setResetTarget(target); setTemporaryPassword(""); }}>Reset</button><button onClick={() => toggle(target)}>{target.is_active ? "Disable" : "Enable"}</button>{target.id !== user.id && <button className="danger" onClick={() => remove(target)}>Delete</button>}</div></td></tr>)}
      </tbody></table></div>
    </section>
    <section className="panel form-panel" id="user-form"><div className="panel__header"><div><h2>{editing ? `Edit ${editing.username}` : "Create a user"}</h2><p>{editing ? "Update identity and permissions." : "The user must replace this temporary password after signing in."}</p></div></div>
      <form className="form-grid" onSubmit={submit}><label>Username<input name="username" value={form.username} onChange={update} required /></label><label>Full name<input name="full_name" value={form.full_name} onChange={update} /></label><label>Role<select name="role" value={form.role} onChange={update}><option value="user">User</option><option value="read_only">Read only</option><option value="admin">Admin</option></select></label>{!editing && <label>Temporary password<input type="password" name="password" minLength="8" value={form.password} onChange={update} required /></label>}<div className="form-actions"><button className="button">{editing ? "Save changes" : "Create user"}</button>{editing && <button type="button" className="button button--secondary" onClick={() => { setEditing(null); setForm(emptyForm); }}>Cancel</button>}</div></form>
    </section>
    {resetTarget && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setResetTarget(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">Reset password</h2><p>Set a temporary password for <strong>{resetTarget.username}</strong>. They must replace it at the next sign-in.</p><form onSubmit={resetPassword}><label>Temporary password<input autoFocus type="password" minLength="8" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} required /></label><div className="form-actions"><button className="button">Save password</button><button type="button" className="button button--secondary" onClick={() => setResetTarget(null)}>Cancel</button></div></form></section></div>}  </AppShell>;
}
