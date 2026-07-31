// @ts-nocheck
import { useEffect, useRef, useState } from "react";

import { AppShell } from "../components/AppShell.jsx";
import { api, apiJson } from "../lib/api.js";

const fallbackModels = [{ id: "llama3.2", name: "Local model", provider: "ollama", source: "local" }];

export function ChatPage({ user, variant = "default" }) {
  const evil = variant === "evil";
  const [models, setModels] = useState(fallbackModels);
  const [model, setModel] = useState(localStorage.getItem("emma_model") ?? fallbackModels[0].id);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(localStorage.getItem("emma_active") || null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    Promise.allSettled([apiJson("/health"), apiJson("/conversations")]).then(([health, list]) => {
      if (health.status === "fulfilled" && health.value.models?.length) {
        setModels(health.value.models); if (!health.value.models.some((item) => item.id === model)) setModel(health.value.models[0].id);
      }
      if (list.status === "fulfilled") {
        const items = list.value.conversations ?? []; setConversations(items);
        const chosen = items.some((item) => item.id === activeId) ? activeId : items[0]?.id;
        if (chosen) openConversation(chosen);
      }
    });
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { localStorage.setItem("emma_model", model); }, [model]);

  async function refreshConversations() { const data = await apiJson("/conversations"); setConversations(data.conversations ?? []); }
  async function openConversation(id) {
    try { const data = await apiJson(`/conversations/${id}`); setActiveId(id); localStorage.setItem("emma_active", id); setMessages(data.messages ?? []); if (data.model) setModel(data.model); setSidebarOpen(false); }
    catch (reason) { setError(reason.message); }
  }
  async function createConversation(initialText = "") {
    const data = await apiJson("/conversations", { method: "POST", body: JSON.stringify({ title: initialText.slice(0, 48) || "New chat", model }) });
    setActiveId(data.id); localStorage.setItem("emma_active", data.id); setMessages([]); await refreshConversations(); return data.id;
  }
  async function removeConversation(event, id) {
    event.stopPropagation(); if (!window.confirm("Delete this conversation?")) return;
    try { await api(`/conversations/${id}`, { method: "DELETE" }); const remaining = conversations.filter((item) => item.id !== id); setConversations(remaining); if (activeId === id) { setActiveId(null); setMessages([]); localStorage.removeItem("emma_active"); if (remaining[0]) openConversation(remaining[0].id); } }
    catch (reason) { setError(reason.message); }
  }

  async function send(event) {
    event.preventDefault(); const text = draft.trim(); if (!text || streaming) return;
    setDraft(""); setError(""); setStreaming(true);
    const history = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    try {
      const conversationId = activeId ?? await createConversation(text);
      const response = await api("/chat", { method: "POST", body: JSON.stringify({ model, messages: history.map(({ role, content }) => ({ role, content })), stream: true, conversation_id: conversationId }) });
      if (!response.body) throw new Error("Streaming is not available.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let answer = "";
      while (true) {
        const { value, done } = await reader.read(); buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n"); buffer = done ? "" : lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try { const eventData = JSON.parse(line); const piece = eventData.text ?? eventData.content ?? eventData.delta ?? eventData.message?.content ?? ""; answer += piece; setMessages([...history, { role: "assistant", content: answer }]); }
          catch { /* Wait for a complete NDJSON line. */ }
        }
        if (done) break;
      }
      await refreshConversations();
    } catch (reason) { setMessages(history); setError(reason.message); }
    finally { setStreaming(false); }
  }

  const title = evil ? "Chat Evil Emma" : variant === "white" ? "Chat Emma · Light" : "Chat Emma";
  return <AppShell user={user} active="/chat" evil={evil}>
    <div className={`chat-page chat-page--${variant}`}>
      <aside className={`conversation-panel ${sidebarOpen ? "open" : ""}`}><div className="conversation-panel__header"><h2>Conversations</h2><button className="icon-button" onClick={() => setSidebarOpen(false)}>×</button></div><button className="button button--wide" onClick={() => createConversation()}>+ New conversation</button><div className="conversation-list">{conversations.map((conversation) => <button className={activeId === conversation.id ? "active" : ""} key={conversation.id} onClick={() => openConversation(conversation.id)}><span><strong>{conversation.title}</strong><small>{conversation.model}</small></span><i onClick={(event) => removeConversation(event, conversation.id)}>×</i></button>)}</div></aside>
      <section className="chat-workspace"><header className="chat-header"><button className="icon-button mobile-only" onClick={() => setSidebarOpen(true)}>☰</button><div><span className="eyebrow">{evil ? "Unrestricted aesthetic · standard safety" : "Secure assistant"}</span><h1>{title}</h1></div><label className="model-picker"><span>Model</span><select value={model} onChange={(event) => setModel(event.target.value)}>{models.map((item) => <option value={item.id} key={item.id}>{item.name ?? item.id} · {item.provider}</option>)}</select></label></header>
        <div className="message-list">{messages.length === 0 ? <div className="chat-empty"><span className="chat-empty__orb">✦</span><h2>{evil ? "What truth are we dissecting?" : "How can I help you today?"}</h2><p>Start a conversation with the selected model. Safe RAG context will be included automatically.</p><div className="suggestions">{["Summarize my knowledge base", "Find inconsistencies", "Explain the available sources"].map((text) => <button key={text} onClick={() => setDraft(text)}>{text}<span>→</span></button>)}</div></div> : messages.map((message, index) => <article className={`message message--${message.role}`} key={message.id ?? index}><div className="message__avatar">{message.role === "user" ? (user.full_name ?? user.username)[0].toUpperCase() : evil ? "E" : "✦"}</div><div><strong>{message.role === "user" ? "You" : evil ? "Evil Emma" : "Emma"}</strong><p>{message.content || (streaming && index === messages.length - 1 ? "Thinking…" : "")}</p></div></article>)}<div ref={endRef} /></div>
        <div className="composer-wrap">{error && <div className="alert alert--error">{error}</div>}<form className="composer" onSubmit={send}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Message Emma…" rows="1" /><button disabled={!draft.trim() || streaming}>{streaming ? "…" : "↑"}</button></form><small>Emma can make mistakes. Verify important information.</small></div>
      </section>
    </div>
  </AppShell>;
}
