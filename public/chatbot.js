/* ═══════════════════════════════════════════════════════
   NEXUS PAM — CHATBOT ENGINE
   AI-powered retro military assistant (Groq/Llama)
   ═══════════════════════════════════════════════════════ */

(function NexusBot() {
  "use strict";

  const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? ""
    : (localStorage.getItem("nexus_api_base") || "");

  const MAX_HISTORY = 50;
  const STORAGE_KEY = "nexus_chat_history";
  const REMINDERS_KEY = "nexus_reminders";

  const motivations = [
    "EXCELLENT WORK, OPERATIVE.",
    "MISSION ACCOMPLISHED. THE NEXUS IS PROUD.",
    "OUTSTANDING PERFORMANCE, COMMANDER.",
    "TARGET NEUTRALIZED. WELL DONE.",
    "+100 SCORE. KEEP FIGHTING, SOLDIER."
  ];

  let chatOpen = false;
  let isProcessing = false;
  let idleTimer = null;

  /* ── Pink Space Invader SVG ──────────────────────── */
  const BOT_ICON_URL = "/bot_logo.png";
  const INVADER_SVG = `<img src="${BOT_ICON_URL}" style="width:100%;height:100%;filter:drop-shadow(0 0 8px #ff0055);object-fit:contain;">`;

  const INVADER_ICON_SMALL = `<img src="${BOT_ICON_URL}" style="width:20px;height:auto;filter:drop-shadow(0 0 5px #ff0055);transform:translateY(2px)">`;

  /* ── Inject HTML ─────────────────────────────────── */
  function injectChatHTML() {
    // Toast
    const toast = document.createElement("div");
    toast.id = "nexusToast";
    toast.className = "nexus-toast";
    document.body.appendChild(toast);

    // Bot toggle — pink space invader
    const toggle = document.createElement("button");
    toggle.id = "nexusBotToggle";
    toggle.className = "nexus-bot-toggle";
    toggle.innerHTML = INVADER_SVG;
    toggle.title = "NEXUS BOT";
    toggle.setAttribute("aria-label", "Toggle NEXUS BOT chat");
    document.body.appendChild(toggle);

    // Chat window
    const win = document.createElement("div");
    win.id = "nexusChatWindow";
    win.className = "nexus-chat-window";
    win.innerHTML = `
      <div class="nexus-chat-header">
        <div class="nexus-chat-header-left">
          <span class="nexus-chat-header-icon">${INVADER_ICON_SMALL}</span>
          <span class="nexus-chat-header-title">NEXUS BOT</span>
        </div>
        <div class="nexus-chat-header-btns">
          <button id="chatClearBtn" title="CLEAR HISTORY">CLR</button>
          <button id="chatMinBtn" title="MINIMIZE">─</button>
          <button id="chatCloseBtn" title="CLOSE">✕</button>
        </div>
      </div>
      <div class="nexus-chat-messages" id="chatMessages"></div>
      <div class="nexus-chat-quick" id="chatQuickBtns">
        <button class="nexus-quick-btn" data-quick="What's due today?">WHAT'S DUE TODAY?</button>
        <button class="nexus-quick-btn" data-quick="Show overdue tasks">SHOW OVERDUE</button>
        <button class="nexus-quick-btn" data-quick="How many tasks do I have?">MY TASKS</button>
      </div>
      <div class="nexus-chat-input-row">
        <input type="text" class="nexus-chat-input" id="chatInput" placeholder="> TYPE COMMAND..." autocomplete="off" />
        <button class="nexus-chat-send" id="chatSendBtn">SEND ▶</button>
      </div>
    `;
    document.body.appendChild(win);
  }

  /* ── DOM Shortcuts ───────────────────────────────── */
  function $(id) { return document.getElementById(id); }

  /* ── Chat History (localStorage) ─────────────────── */
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  }
  function saveHistory(msgs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY)));
  }
  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    const msgs = [botMessage("TRANSMISSION LOG CLEARED. STANDING BY, COMMANDER.")];
    saveHistory(msgs);
    renderMessages(msgs);
  }

  /* ── Render Messages ─────────────────────────────── */
  function renderMessages(msgs) {
    const container = $("chatMessages");
    if (!container) return;
    container.innerHTML = msgs.map(m => {
      if (m.role === "bot") {
        return `<div class="nexus-msg nexus-msg-bot">
          <div class="nexus-msg-label-bot">[BOT]:</div>
          <div class="nexus-msg-text">${escHtml(m.text)}</div>
          ${m.actionDone ? `<div class="nexus-msg-action">✓ ACTION EXECUTED</div>` : ""}
          <div class="nexus-msg-time">${m.time || ""}</div>
        </div>`;
      } else {
        return `<div class="nexus-msg nexus-msg-user">
          <div class="nexus-msg-label-user">[${escHtml(getUsername())}]:</div>
          <div class="nexus-msg-text">${escHtml(m.text)}</div>
          <div class="nexus-msg-time">${m.time || ""} <span class="nexus-msg-check">✓</span></div>
        </div>`;
      }
    }).join("");
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const container = $("chatMessages");
    if (!container) return;
    const el = document.createElement("div");
    el.className = "nexus-typing";
    el.id = "typingIndicator";
    el.innerHTML = '[BOT IS PROCESSING<span class="nexus-typing-dots"></span>]';
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    const el = $("typingIndicator");
    if (el) el.remove();
  }

  /* ── Helpers ─────────────────────────────────────── */
  function escHtml(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g, "<br>"); }
  function timeNow() {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function getUsername() {
    try {
      const u = JSON.parse(localStorage.getItem("nexus_user") || "{}");
      return (u.username || "COMMANDER").toUpperCase();
    } catch { return "COMMANDER"; }
  }
  function botMessage(text, actionDone) { return { role: "bot", text, time: timeNow(), actionDone: !!actionDone }; }
  function userMessage(text) { return { role: "user", text, time: timeNow() }; }

  /* ── Toast ───────────────────────────────────────── */
  function showToast(msg) {
    const t = $("nexusToast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 4000);
  }

  /* ── API calls to server ─────────────────────────── */
  async function apiGet(url) {
    const token = localStorage.getItem("nexus_token");
    const headers = {};
    if (token) headers["Authorization"] = "Bearer " + token;
    const res = await fetch(API_BASE + url, { headers });
    if (!res.ok) throw new Error("API error");
    return res.json();
  }

  async function apiPost(url, body) {
    const token = localStorage.getItem("nexus_token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    const res = await fetch(API_BASE + url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error("API error");
    return res.json();
  }

  /* ── Browser Notifications ───────────────────────── */
  function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  function scheduleReminder(taskName, timestamp) {
    const delay = timestamp - Date.now();
    if (delay <= 0) return;

    const reminders = JSON.parse(localStorage.getItem(REMINDERS_KEY) || "[]");
    reminders.push({ task: taskName, time: timestamp });
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));

    setTimeout(() => {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("NEXUS PAM MISSION ALERT", { body: `Time for: ${taskName}` });
      }
      showToast(`⚠ MISSION TIME: ${taskName}`);
      const stored = JSON.parse(localStorage.getItem(REMINDERS_KEY) || "[]");
      const updated = stored.filter(r => r.time !== timestamp || r.task !== taskName);
      localStorage.setItem(REMINDERS_KEY, JSON.stringify(updated));
    }, delay);
  }

  function restoreReminders() {
    const reminders = JSON.parse(localStorage.getItem(REMINDERS_KEY) || "[]");
    const now = Date.now();
    const active = reminders.filter(r => r.time > now);
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(active));
    active.forEach(r => scheduleReminder(r.task, r.time));
  }

  /* ── Process message through AI (server-side) ────── */
  async function processWithAI(userText) {
    try {
      const res = await apiPost("/api/chat", { message: userText });

      if (res.reply) {
        let responseText = res.reply;
        let actionDone = false;

        if (res.actionResult && res.actionResult.success) {
          actionDone = true;
          const typeLabel = res.actionResult.type === "create_task" ? "TASK" : "PROJECT";
          showToast(`✓ ${typeLabel} CREATED SUCCESSFULLY.`);
          
          setTimeout(() => {
            if (typeof load === "function") load();
            else window.location.reload();
          }, 800);
        }

        return { text: responseText, actionDone };
      }
    } catch (err) {
      console.error("Chat API error:", err);
      showToast("⚠ SIGNAL INTERRUPTED. FALLING BACK TO LOCAL PROTOCOL.");
    }

    // Fallback: local processing if AI is unavailable or fails
    return { text: await processLocally(userText), actionDone: false };
  }

  /* ── Local fallback processing ───────────────────── */
  async function processLocally(text) {
    const input = text.toLowerCase().trim();
    let projects = [];
    try { projects = await apiGet("/api/projects"); } catch {}

    const allTasks = projects.flatMap(p => (p.tasks || []).map(t => ({ ...t, projectTitle: p.title, projectId: p.id })));
    const today = new Date().toISOString().split("T")[0];

    // Ultra-Robust Task Detection
    let parsedTitle = "";
    let parsedDate = "";

    // Look for date patterns (DD/MM, DD Month, tomorrow, etc)
    const datePattern = /(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{1,2}(?:st|nd|rd|th)?\s+[a-z]+(?:\s+\d{2,4})?|tomorrow|next week|today)/i;
    const dateMatch = input.match(datePattern);
    
    if (dateMatch && (input.includes("due") || input.includes("have") || input.includes("add") || input.includes("create"))) {
      parsedDate = dateMatch[0];
      // Strip intent keywords and the date to get the title
      parsedTitle = input
        .replace(datePattern, "")
        .replace(/(?:i have|create|add|new|project|task|due for|due on|due|for|on|a |of )/gi, " ")
        .trim()
        .toUpperCase();

      if (parsedTitle && parsedTitle.length > 2) {
        let dueDate = "";
        if (parsedDate.toLowerCase().includes("tomorrow")) {
          const d = new Date(); d.setDate(d.getDate() + 1);
          dueDate = d.toISOString().split("T")[0];
        } else { dueDate = parsedDate.toUpperCase(); }

        try {
          // If no projects exist, CREATE one first
          let targetProjectId = projects[0] ? projects[0].id : null;
          if (!targetProjectId) {
            const newP = await apiPost("/api/projects", { title: "GENERAL MISSIONS", status: "active", description: "AUTO-INITIALIZED" });
            targetProjectId = newP.id;
          }

          await apiPost(`/api/projects/${targetProjectId}/tasks`, { 
            title: parsedTitle, 
            status: "todo", 
            priority: "medium", 
            dueDate, 
            notes: "LOGGED VIA LOCAL PROTOCOL." 
          });
          
          showToast(`✓ MISSION LOGGED: ${parsedTitle}`);
          setTimeout(() => typeof load === "function" ? load() : window.location.reload(), 800);
          return `MISSION RECOGNIZED: "${parsedTitle}"\nCOORDINATES SET FOR: ${dueDate}\nOBJECTIVE LOGGED IN [${(projects[0]||{title:"MISSIONS"}).title.toUpperCase()}].\n\nSTAY SHARP, COMMANDER.`;
        } catch (e) {
          console.error(e);
          return "MISSION LOGGING FAILED. DATABASE UNAVAILABLE.";
        }
      }
    }

    if (/how many (tasks?|missions?)/.test(input) || /task count|my tasks/i.test(input)) {
        const total = allTasks.length;
        const overdue = allTasks.filter(t => t.dueDate && t.dueDate < today && t.status !== "done" && !t.completed).length;
        return `SCANNING DATABASES...\n${total} MISSIONS DETECTED.\n${overdue} OVERDUE.`;
    }

    if (/due today|today.?s (tasks?|missions?)|what.?s due/.test(input)) {
        const dueTasks = allTasks.filter(t => t.dueDate === today && t.status !== "done" && !t.completed);
        if (dueTasks.length === 0) return "NO MISSIONS DUE TODAY.";
        let reply = `${dueTasks.length} MISSION(S) DUE TODAY:\n`;
        dueTasks.forEach(t => { reply += `▸ "${t.title}"\n`; });
        return reply.trim();
    }

    if (input.includes("hello") || input.includes("hi ") || input === "hi") {
        return `SYSTEM ONLINE. WELCOME BACK, ${getUsername()}.`;
    }

    return `COMMAND NOT RECOGNIZED.\n\nCOMM LINK WEAK. PLEASE USE EXPLICIT DIRECTIVES:\n▸ "CREATE MISSION [NAME] DUE [DATE]"\n▸ "HOW MANY TASKS?"\n▸ "WHAT'S DUE TODAY?"`;
  }

  /* ── Send Message ────────────────────────────────── */
  async function sendMessage(text) {
    if (!text.trim() || isProcessing) return;
    isProcessing = true;
    resetIdleTimer();

    const msgs = loadHistory();
    msgs.push(userMessage(text));
    saveHistory(msgs);
    renderMessages(msgs);

    showTyping();

    try {
      const result = await processWithAI(text);
      hideTyping();
      msgs.push(botMessage(result.text, result.actionDone));
      saveHistory(msgs);
      renderMessages(msgs);
    } catch (err) {
      hideTyping();
      msgs.push(botMessage("SYSTEM ERROR. UNABLE TO PROCESS COMMAND."));
      saveHistory(msgs);
      renderMessages(msgs);
    }

    isProcessing = false;
  }

  /* ── Welcome Message ─────────────────────────────── */
  async function showWelcome() {
    let welcomeText = `WELCOME BACK, ${getUsername()}.\n`;
    try {
      const projects = await apiGet("/api/projects");
      const allTasks = projects.flatMap(p => (p.tasks || []).map(t => ({ ...t, projectTitle: p.title })));
      const today = new Date().toISOString().split("T")[0];
      const dueToday = allTasks.filter(t => t.dueDate === today && t.status !== "done" && !t.completed).length;
      const overdue = allTasks.filter(t => t.dueDate && t.dueDate < today && t.status !== "done" && !t.completed).length;
      welcomeText += `YOU HAVE ${dueToday} TASK(S) DUE TODAY.\nOVERDUE MISSIONS: ${overdue}`;
    } catch {
      welcomeText += "SYSTEMS ONLINE. HOW CAN I ASSIST?";
    }
    return welcomeText;
  }

  /* ── Idle Timer (30 min) ─────────────────────────── */
  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(async () => {
      if (!chatOpen) return;
      try {
        const projects = await apiGet("/api/projects");
        const allTasks = projects.flatMap(p => p.tasks || []);
        const pending = allTasks.filter(t => t.status !== "done" && !t.completed).length;
        if (pending > 0) {
          const msgs = loadHistory();
          msgs.push(botMessage(`COMMANDER, ${pending} MISSION(S) STILL PENDING.`));
          saveHistory(msgs);
          renderMessages(msgs);
        }
      } catch {}
    }, 30 * 60 * 1000);
  }

  /* ── Initialize ──────────────────────────────────── */
  async function init() {
    injectChatHTML();
    requestNotificationPermission();
    restoreReminders();

    const toggle = $("nexusBotToggle");
    const win = $("nexusChatWindow");
    const input = $("chatInput");
    const sendBtn = $("chatSendBtn");
    const closeBtn = $("chatCloseBtn");
    const minBtn = $("chatMinBtn");
    const clearBtn = $("chatClearBtn");

    toggle.addEventListener("click", async () => {
      chatOpen = !chatOpen;
      if (chatOpen) {
        win.classList.add("open");
        let msgs = loadHistory();
        if (msgs.length === 0) {
          const welcome = await showWelcome();
          msgs = [botMessage(welcome)];
          saveHistory(msgs);
        }
        renderMessages(msgs);
        input.focus();
        resetIdleTimer();
      } else {
        win.classList.remove("open");
      }
    });

    closeBtn.addEventListener("click", () => { chatOpen = false; win.classList.remove("open"); });
    minBtn.addEventListener("click", () => { chatOpen = false; win.classList.remove("open"); });
    clearBtn.addEventListener("click", clearHistory);

    sendBtn.addEventListener("click", () => {
      const text = input.value.trim();
      if (text) { input.value = ""; sendMessage(text); }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const text = input.value.trim();
        if (text) { input.value = ""; sendMessage(text); }
      }
    });

    $("chatQuickBtns").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-quick]");
      if (btn) {
        const text = btn.dataset.quick;
        input.value = "";
        sendMessage(text);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
