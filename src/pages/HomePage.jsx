// @ts-nocheck
import { AppShell } from "../components/AppShell.jsx";

const cards = [
  { href: "/chat", icon: "✦", title: "Chat Emma", text: "Ask questions across your secure knowledge workspace.", roles: ["admin", "user", "read_only"] },
  { href: "/upload", icon: "⇧", title: "Upload files", text: "Manage global and private RAG knowledge sources.", roles: ["admin", "user"] },
  { href: "/admin", icon: "⚙", title: "Admin panel", text: "Manage users, roles and workspace access.", roles: ["admin"] },
  { href: "/docs", icon: "?", title: "Documentation", text: "Understand Emma's models, safety and workflows.", roles: ["admin", "user", "read_only"] },
];

export function HomePage({ user }) {
  return <AppShell user={user} active="/">
    <header className="page-header hero-header">
      <div><span className="eyebrow">Workspace overview</span><h1>Hello, {user.full_name ?? user.username}</h1><p>Choose where you want to continue.</p></div>
      <div className="status-pill"><span /> Emma is ready</div>
    </header>
    <section className="feature-grid">
      {cards.filter((card) => card.roles.includes(user.role)).map((card) => <a className="feature-card" href={card.href} key={card.href}>
        <span className="feature-card__icon">{card.icon}</span><div><h2>{card.title}</h2><p>{card.text}</p></div><span className="feature-card__arrow">→</span>
      </a>)}
    </section>
    <section className="home-banner"><div><span className="eyebrow">Three provider families</span><h2>Local when possible. External when useful.</h2></div><p>Emma connects to Ollama-compatible local models and configured OpenAI, Gemini, and Anthropic APIs while keeping keys on the server.</p></section>
  </AppShell>;
}
