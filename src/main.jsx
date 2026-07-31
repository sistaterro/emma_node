// @ts-nocheck
import React from "react";
import { createRoot } from "react-dom/client";

import { ProtectedPage } from "./components/ProtectedPage.jsx";
import { AdminPage } from "./pages/AdminPage.jsx";
import { ChatPage } from "./pages/ChatPage.jsx";
import { DocsPage } from "./pages/DocsPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { UploadPage } from "./pages/UploadPage.jsx";
import "./styles.css";

const routes = {
  "/login": <LoginPage />,
  "/": <ProtectedPage>{(user) => <HomePage user={user} />}</ProtectedPage>,
  "/chat": <ProtectedPage>{(user) => <ChatPage user={user} />}</ProtectedPage>,
  "/chat-evil": <ProtectedPage>{(user) => <ChatPage user={user} variant="evil" />}</ProtectedPage>,
  "/chat-white": <ProtectedPage>{(user) => <ChatPage user={user} variant="white" />}</ProtectedPage>,
  "/upload": <ProtectedPage roles={["admin", "user"]}>{(user) => <UploadPage user={user} />}</ProtectedPage>,
  "/admin": <ProtectedPage roles={["admin"]}>{(user) => <AdminPage user={user} />}</ProtectedPage>,
  "/docs": <ProtectedPage>{(user) => <DocsPage user={user} />}</ProtectedPage>,
};

const legacyAliases = {
  "/ui/login.html": "/login", "/ui/index.html": "/", "/ui/chat.html": "/chat",
  "/ui/chat_evil_emma.html": "/chat-evil", "/ui/chat_not_so_evil_emma_white.html": "/chat-white",
  "/ui/upload.html": "/upload", "/ui/admin.html": "/admin", "/ui/Docs.html": "/docs",
};

const path = legacyAliases[window.location.pathname] ?? window.location.pathname;
if (path !== window.location.pathname) window.history.replaceState({}, "", path);
const content = routes[path] ?? <div className="not-found"><h1>404</h1><p>This Emma page does not exist.</p><a className="button" href="/">Return home</a></div>;

createRoot(document.getElementById("root")).render(<React.StrictMode>{content}</React.StrictMode>);
