// @ts-nocheck
import { useEffect, useRef, useState } from "react";

import { AppShell } from "../components/AppShell.jsx";
import { api, apiJson } from "../lib/api.js";

export function UploadPage({ user }) {
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [scope, setScope] = useState(user.role === "admin" ? "global" : "user");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inputRef = useRef(null);

  async function loadFiles() {
    try { setFiles((await apiJson("/files")).files ?? []); setError(""); }
    catch (reason) { setError(reason.message); }
  }
  useEffect(() => { loadFiles(); }, []);
  useEffect(() => {
    if (!files.some((file) => file.status === "indexing" || file.conflicts?.status === "checking")) return;
    const timer = setInterval(loadFiles, 2500); return () => clearInterval(timer);
  }, [files]);

  function choose(list) {
    const file = list?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".txt")) { setError("Only .txt files are accepted."); return; }
    setSelected(file); setError("");
  }
  async function upload(event) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError(""); setMessage("");
    const body = new FormData(); body.append("file", selected);
    try {
      const result = await apiJson(`/upload?scope=${scope}`, { method: "POST", body });
      setMessage(result.message ?? "File uploaded and queued for indexing."); setSelected(null); if (inputRef.current) inputRef.current.value = ""; await loadFiles();
    } catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  async function remove(file) {
    if (!window.confirm(`Delete ${file.name ?? file.filename}?`)) return;
    try { const owner = file.owner_id ? `?owner_id=${file.owner_id}` : ""; await api(`/files/${file.scope}/${encodeURIComponent(file.stem)}${owner}`, { method: "DELETE" }); await loadFiles(); }
    catch (reason) { setError(reason.message); }
  }
  async function download(file, name) {
    try {
      const owner = file.owner_id ? `?owner_id=${file.owner_id}` : "";
      const response = await api(`/files/${file.scope}/${encodeURIComponent(file.stem)}/download${owner}`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = name; link.click();
      URL.revokeObjectURL(url);
    } catch (reason) { setError(reason.message); }
  }
  async function clearScope(targetScope) {
    if (!window.confirm(`Delete every ${targetScope} knowledge file?`)) return;
    try { await api(`/files/${targetScope}`, { method: "DELETE" }); await loadFiles(); }
    catch (reason) { setError(reason.message); }
  }

  return <AppShell user={user} active="/upload">
    <header className="page-header"><div><span className="eyebrow">Knowledge management</span><h1>Upload RAG sources</h1><p>Add plain-text knowledge for secure, grounded conversations.</p></div></header>
    {error && <div className="alert alert--error">{error}</div>}{message && <div className="alert alert--success">{message}</div>}
    <div className="upload-layout">
      <section className="panel upload-panel"><div className="panel__header"><div><h2>New knowledge file</h2><p>Emma accepts UTF-8 `.txt` documents.</p></div></div>
        <form onSubmit={upload}>
          {user.role === "admin" && <div className="scope-switch"><button type="button" className={scope === "global" ? "active" : ""} onClick={() => setScope("global")}>Global knowledge</button><button type="button" className={scope === "user" ? "active" : ""} onClick={() => setScope("user")}>My knowledge</button></div>}
          <button type="button" className={`drop-zone ${dragging ? "dragging" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files); }}>
            <span>⇧</span><strong>{selected ? selected.name : "Drop a text file here"}</strong><small>{selected ? `${(selected.size / 1024).toFixed(1)} KB` : "or click to browse"}</small>
          </button>
          <input ref={inputRef} hidden type="file" accept=".txt,text/plain" onChange={(event) => choose(event.target.files)} />
          <button className="button button--wide" disabled={!selected || busy}>{busy ? "Uploading and screening…" : "Upload file"}</button>
        </form>
      </section>
      <aside className="security-card"><span className="security-card__icon">◇</span><h2>Security screening</h2><p>Every source is inspected for multilingual prompt injection before it can enter chat context.</p><ul><li>High risk is automatically blocked</li><li>Medium risk is marked for review</li><li>All findings are persisted</li></ul></aside>
    </div>
    <section className="panel"><div className="panel__header"><div><h2>Indexed sources</h2><p>{files.length} visible file{files.length === 1 ? "" : "s"}</p></div>{files.length > 0 && <button className="text-button danger" onClick={() => clearScope(user.role === "admin" ? "global" : "user")}>Clear scope</button>}</div>
      <div className="file-grid">{files.length === 0 ? <div className="empty-state"><span>◇</span><h3>No knowledge files yet</h3><p>Upload a text document to begin.</p></div> : files.map((file) => {
        const risk = file.security?.risk ?? "none"; const name = file.name ?? file.filename ?? `${file.stem}.txt`; const conflicts = file.inconsistencies ?? file.conflicts;
        return <article className="file-card" key={`${file.scope}-${file.owner_id ?? "global"}-${file.stem}`}><div className="file-card__top"><span className="file-icon">TXT</span><div><h3>{name}</h3><small>{file.scope === "global" ? "Global" : file.owner_username ? `Owner: ${file.owner_username}` : "Private"}</small></div><button className="icon-button danger" onClick={() => remove(file)}>×</button></div><div className="file-card__meta"><span className={`risk risk--${risk}`}>{risk === "none" ? "Safe" : `${risk} risk`}</span><span>{file.status ?? (file.indexed ? "indexed" : "indexing")}</span><span>{file.chunk_count ?? file.chunks ?? 0} chunks</span></div>{conflicts?.has_any && <div className="conflict-note">Potential inconsistencies detected with another source.</div>}<div className="file-card__actions"><button className="text-button" onClick={() => download(file, name)}>Download</button></div></article>;
      })}</div>
    </section>
  </AppShell>;
}
