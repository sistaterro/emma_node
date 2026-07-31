// @ts-nocheck
import { useEffect, useState } from "react";

import { apiJson, clearSession, getStoredUser, getToken } from "../lib/api.js";

export function ProtectedPage({ children, roles }) {
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      window.location.replace("/login");
      return;
    }
    apiJson("/auth/me")
      .then((profile) => {
        if (profile.must_change_password) {
          window.location.replace("/login");
          return;
        }
        if (roles && !roles.includes(profile.role)) {
          window.location.replace("/");
          return;
        }
        setUser(profile);
      })
      .catch(() => {
        clearSession();
        window.location.replace("/login");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loader"><span className="spinner" />Loading Emma…</div>;
  return children(user);
}
