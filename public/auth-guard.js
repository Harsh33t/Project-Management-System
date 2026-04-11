/* ═══════════════════════════════════════════════════════
   NEXUS PAM — AUTH GUARD
   Redirects to login if no valid JWT token exists
   Include this script BEFORE page-specific scripts
   ═══════════════════════════════════════════════════════ */

(function authGuard() {
  const token = localStorage.getItem("nexus_token");
  const publicPages = ["/login.html", "/register.html", "/"];
  const currentPath = window.location.pathname;

  // Allow public pages
  if (publicPages.some(p => currentPath === p || currentPath.endsWith(p))) {
    return;
  }

  // No token? Go to login
  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  // Basic JWT expiry check (client-side)
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("bad token");
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && payload.exp < Date.now()) {
      localStorage.removeItem("nexus_token");
      localStorage.removeItem("nexus_user");
      window.location.href = "/login.html";
      return;
    }
  } catch {
    localStorage.removeItem("nexus_token");
    localStorage.removeItem("nexus_user");
    window.location.href = "/login.html";
  }
})();
