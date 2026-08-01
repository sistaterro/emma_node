// @ts-nocheck
import { Brand } from "./Brand.jsx";
import { api, clearSession } from "../lib/api.js";

const links = [
  ["/", "Home", "⌂"],
  ["/chat", "Chat Emma", "✦"],
  ["/upload", "Knowledge", "⇧"],
  ["/admin", "Admin", "⚙"],
  ["/docs", "Documentation", "?"],
];

export function AppShell({ user, children, active, evil = false }) {
  const visibleLinks = links.filter(([path]) => {
    if (path === "/admin") return user?.role === "admin";
    if (path === "/upload") return user?.role !== "read_only";
    return true;
  });

  async function logout() {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* local logout still applies */ }
    clearSession();
    window.location.replace("/login");
  }

  return (
    <div className={`app-shell ${active === "/chat" ? "app-shell--chat" : ""} ${evil ? "theme-evil" : ""}`}>
      <aside className="sidebar">
        <Brand evil={evil} />
        <nav className="sidebar__nav" aria-label="Main navigation">
          {visibleLinks.map(([path, label, icon]) => (
            <a key={path} href={path} className={active === path ? "active" : ""}>
              <span>{icon}</span>{label}
            </a>
          ))}
        </nav>
        <div className="sidebar__user">
          <div className="avatar">{(user?.full_name ?? user?.username ?? "E")[0].toUpperCase()}</div>
          <div><strong>{user?.full_name ?? user?.username}</strong><small>{user?.role?.replace("_", " ")}</small></div>
          <button className="icon-button" onClick={logout} title="Log out">↪</button>
        </div>
      </aside>
      <main className="app-content">{children}</main>
    </div>
  );
}
