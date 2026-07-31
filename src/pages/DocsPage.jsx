// @ts-nocheck
import { AppShell } from "../components/AppShell.jsx";

const sections = [
  ["Overview", "Emma is a local-first AI workspace that combines authenticated conversations, managed knowledge files and multiple model providers."],
  ["Models", "Use discovered Ollama-compatible local models or configured Gemini, OpenAI and Anthropic APIs. API keys remain on the backend."],
  ["Knowledge and RAG", "Text files are split into ordered JSON chunks. Safe visible chunks are admitted whole until the configured context budget is reached."],
  ["Security", "Every uploaded RAG is screened for multilingual prompt injection. High-risk sources are excluded from chat context and suspicious events are audited."],
  ["Grounded answers", "With active knowledge context, answers begin with [RAG], [DRIFT] or [NO INFO]. General chat without safe RAG context uses no grounding tag."],
  ["Roles", "Admins manage users and all RAGs. Users manage their own knowledge. Read-only users can chat but cannot upload."],
  ["Streaming", "Chat responses use newline-delimited JSON and render incrementally while the selected model generates tokens."],
  ["Privacy", "Users, sessions, conversations and metadata are stored in local SQLite. Runtime files, keys and audit logs are excluded from Git."],
];

export function DocsPage({ user }) {
  return <AppShell user={user} active="/docs">
    <header className="page-header"><div><span className="eyebrow">Emma 2.0</span><h1>Documentation</h1><p>How the Hybrid Emma workspace behaves.</p></div></header>
    <div className="docs-layout">
      <aside className="docs-toc"><strong>On this page</strong>{sections.map(([title], index) => <a href={`#doc-${index}`} key={title}>{title}</a>)}</aside>
      <article className="docs-content">
        {sections.map(([title, text], index) => <section id={`doc-${index}`} key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{title}</h2><p>{text}</p></div></section>)}
      </article>
    </div>
  </AppShell>;
}
