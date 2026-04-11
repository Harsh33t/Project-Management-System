/* ═══════════════════════════════════════════════════════
   NEXUS PAM — AUTH JS (Login / Register / Effects)
   ═══════════════════════════════════════════════════════ */

const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? ""
  : (localStorage.getItem("nexus_api_base") || "");

/* ── Starfield ─────────────────────────────────────── */
(function initStarfield() {
  const canvas = document.getElementById("starfield");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let w, h, stars = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function createStars() {
    stars = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.5 + 0.3,
        speed: Math.random() * 0.4 + 0.1,
        opacity: Math.random() * 0.7 + 0.3
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      ctx.globalAlpha = s.opacity;
      ctx.fillStyle = "#fff";
      ctx.fillRect(s.x, s.y, s.r, s.r);
      s.y += s.speed;
      if (s.y > h) { s.y = 0; s.x = Math.random() * w; }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", () => { resize(); createStars(); });
  resize();
  createStars();
  draw();
})();

/* ── Matrix Rain ───────────────────────────────────── */
function playMatrixRain(durationMs, callback) {
  const canvas = document.getElementById("matrixCanvas");
  if (!canvas) { if (callback) callback(); return; }
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.classList.add("active");

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*=+<>{}[]";
  const fontSize = 14;
  const cols = Math.floor(canvas.width / fontSize);
  const drops = Array(cols).fill(1);

  const interval = setInterval(() => {
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#00ff41";
    ctx.font = `${fontSize}px "Press Start 2P", monospace`;
    for (let i = 0; i < drops.length; i++) {
      const char = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(char, i * fontSize, drops[i] * fontSize);
      if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
  }, 35);

  setTimeout(() => {
    clearInterval(interval);
    canvas.classList.remove("active");
    if (callback) callback();
  }, durationMs);
}

/* ── Red Flash ─────────────────────────────────────── */
function showRedFlash() {
  const el = document.getElementById("redFlash");
  if (!el) return;
  el.classList.remove("active");
  void el.offsetWidth;
  el.classList.add("active");
  setTimeout(() => el.classList.remove("active"), 500);
}

/* ── Shake Box ─────────────────────────────────────── */
function shakeBox(boxId) {
  const box = document.getElementById(boxId);
  if (!box) return;
  box.classList.remove("shake");
  void box.offsetWidth;
  box.classList.add("shake");
  setTimeout(() => box.classList.remove("shake"), 600);
}

/* ── Status Message ────────────────────────────────── */
function showStatus(msg, type) {
  const el = document.getElementById("statusMsg");
  if (!el) return;
  el.textContent = msg;
  el.className = "status-msg " + type;
  if (type === "error") {
    setTimeout(() => { el.textContent = ""; el.className = "status-msg"; }, 4000);
  }
}

/* ── Access Denied ─────────────────────────────────── */
function showAccessDenied(boxId) {
  showRedFlash();
  shakeBox(boxId);
  showStatus("ACCESS DENIED", "error");
}

/* ── Success Transition ────────────────────────────── */
function showSuccess(username, redirectUrl) {
  const name = (username || "COMMANDER").toUpperCase();
  showStatus("IDENTITY CONFIRMED", "success");

  setTimeout(() => {
    playMatrixRain(800, () => {
      const overlay = document.getElementById("successOverlay");
      const text = document.getElementById("successText");
      if (overlay && text) {
        text.innerHTML = `IDENTITY CONFIRMED.<br>WELCOME COMMANDER ${name}`;
        overlay.classList.add("active");

        setTimeout(() => {
          document.body.classList.add("crt-transition");
          setTimeout(() => {
            window.location.href = redirectUrl || "/dashboard.html";
          }, 500);
        }, 1200);
      }
    });
  }, 300);
}

/* ── API Helper ────────────────────────────────────── */
async function authApi(url, body) {
  const res = await fetch(API_BASE + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/* ── Login Form ────────────────────────────────────── */
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!username || !password) {
      showAccessDenied("loginBox");
      return;
    }

    try {
      const data = await authApi("/api/auth/login", { username, password });
      localStorage.setItem("nexus_token", data.token);
      localStorage.setItem("nexus_user", JSON.stringify(data.user));
      showSuccess(data.user.username, "/dashboard.html");
    } catch (err) {
      showAccessDenied("loginBox");
    }
  });
}

/* ── Register Form ─────────────────────────────────── */
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("regUsername").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const confirm = document.getElementById("regConfirm").value;

    if (password !== confirm) {
      showAccessDenied("registerBox");
      showStatus("PASSWORDS DO NOT MATCH", "error");
      return;
    }

    if (password.length < 6) {
      showAccessDenied("registerBox");
      showStatus("PASSWORD TOO SHORT (MIN 6)", "error");
      return;
    }

    try {
      await authApi("/api/auth/register", { username, email, password });
      showStatus("RECRUIT REGISTERED. PROCEED TO LOGIN", "success");
      setTimeout(() => {
        window.location.href = "/login.html";
      }, 2000);
    } catch (err) {
      showAccessDenied("registerBox");
      showStatus(err.message.toUpperCase(), "error");
    }
  });
}

/* ── Google OAuth ──────────────────────────────────── */
const googleLoginBtn = document.getElementById("googleLoginBtn");
const googleRegisterBtn = document.getElementById("googleRegisterBtn");

function startGoogleAuth() {
  window.location.href = API_BASE + "/api/auth/google";
}

if (googleLoginBtn) googleLoginBtn.addEventListener("click", startGoogleAuth);
if (googleRegisterBtn) googleRegisterBtn.addEventListener("click", startGoogleAuth);

/* ── Handle Google OAuth Callback ──────────────────── */
(function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const username = params.get("username");
  if (token) {
    localStorage.setItem("nexus_token", token);
    if (username) {
      localStorage.setItem("nexus_user", JSON.stringify({ username }));
    }
    window.history.replaceState({}, "", window.location.pathname);
    showSuccess(username || "OPERATIVE", "/dashboard.html");
  }
})();

/* ── Redirect if already logged in ─────────────────── */
(function checkAuth() {
  const token = localStorage.getItem("nexus_token");
  const isAuthPage = window.location.pathname.includes("login") || window.location.pathname.includes("register");
  if (token && isAuthPage) {
    window.location.href = "/dashboard.html";
  }
})();
