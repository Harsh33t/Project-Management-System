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

/* ═══════════════════════════════════════════════════════
   NEXUS TACTICAL AUDIO SYSTEM
   Synthesizes 8-bit sound effects on-the-fly
   ═══════════════════════════════════════════════════════ */
const SFX = {
  ctx: null,
  init() { if(!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
  play(freq = 440, duration = 0.1, type = "square", vol = 0.05) {
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },
  click() { this.play(800, 0.05, "sine"); },
  success() { this.play(400, 0.1); setTimeout(() => this.play(600, 0.2), 100); },
  error() { this.play(150, 0.3, "sawtooth", 0.1); },
  confirm() { this.play(1200, 0.05, "square"); }
};

document.addEventListener("mousedown", () => SFX.click());

function showToast(msg, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const t = document.createElement("div");
  t.className = "toast";
  if (type === "success") { t.style.borderColor = "var(--g)"; t.style.color = "var(--g)"; SFX.success(); }
  if (type === "error") { t.style.borderColor = "var(--r)"; t.style.color = "var(--r)"; SFX.error(); }
  t.innerHTML = `[ MISSION ALERT ]<br>${msg}`;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "0.5s"; setTimeout(() => t.remove(), 500); }, 4000);
}

// ═══════════════════════════════════════════════════════
// PROCEDURAL STARFIELD ENGINE
// ═══════════════════════════════════════════════════════
(function initStars() {
  const canvas = document.createElement("canvas");
  canvas.id = "starfield";
  // Apply fixed positioning inline so it works even without styles.css (e.g. index.html)
  canvas.style.cssText = "position:fixed;inset:0;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;";
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");
  let w, h, stars = [];
  const resize = () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    stars = Array.from({ length: 150 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      s: Math.random() * 2, v: Math.random() * 0.5 + 0.1
    }));
  };
  window.addEventListener("resize", resize);
  resize();
  const anim = () => {
    ctx.fillStyle = "#000"; ctx.fillRect(0,0,w,h);
    stars.forEach(s => {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.4})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
      s.y += s.v; if(s.y > h) s.y = -10;
    });
    requestAnimationFrame(anim);
  };
  anim();
})();
