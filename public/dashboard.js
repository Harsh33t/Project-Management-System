const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("request failed");
  return r.json();
}

async function api(url) {
  const token = localStorage.getItem("nexus_token");
  const r = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
  if (!r.ok) throw new Error("API failed");
  return r.json();
}

(async function init() {
  try {
    const [meta, projects, me] = await Promise.all([
      getJson("/api/meta"),
      getJson("/api/projects"),
      api("/api/auth/me")
    ]);
    
    // Pilot Profile Update
    document.getElementById("pilotRank").textContent = me.rank || "CADET";
    document.getElementById("pilotLevel").textContent = me.level || "1";
    document.getElementById("xpText").textContent = `${me.xp} / ${me.nextXp} PX`;
    const xpPct = Math.min(100, Math.max(5, Math.round((me.xp / me.nextXp) * 100)));
    document.getElementById("xpBar").style.width = xpPct + "%";

    const users = meta.users || [];
    const userSel = document.getElementById("currentUserSelect");
    userSel.innerHTML = `[ ` + esc(me.username || "PLAYER_1") + ` ]`;

    const tasks = projects.flatMap((p) => p.tasks || []);
    const totalProjects = projects.length;
    const totalTasks = tasks.length;
    const overdue = projects.filter((p) => p.deadline && new Date(p.deadline) < new Date() && p.status !== "completed").length;
    const completed = tasks.filter((t) => t.completed || t.status === "done").length;

    const stats = [
      ["TOTAL MISSIONS", totalProjects, "◼"],
      ["ACTIVE OPERATIONS", totalTasks, "▦"],
      ["HULL DAMAGE", overdue, "⚠"],
      ["OBJECTIVES CLEAR", completed, "✓"]
    ];
    document.getElementById("stats").innerHTML = stats
      .map(([label, value, icon]) => `<article class="stat-card"><div class="stat-top"><span>${label}</span><span>${icon}</span></div><div class="stat-value">${value}</div></article>`)
      .join("");

    const todo = tasks.filter((t) => t.status === "todo").length;
    const progress = tasks.filter((t) => t.status === "in-progress").length;
    const done = tasks.filter((t) => t.status === "done" || t.completed).length;
    const total = Math.max(totalTasks, 1);
    const rows = [
      ["LOGISTICS", todo, "todo-fill"],
      ["FRONTLLINE", progress, "progress-fill"],
      ["COMPLETE", done, "done-fill"]
    ];
    document.getElementById("bars").innerHTML = rows
      .map(([label, count, cls]) => {
        const pct = Math.round((count / total) * 100);
        return `<div class="status-row" style="margin-bottom:24px;">
          <div style="display:flex; justify-content:space-between; font-family:'Press Start 2P'; font-size:0.6rem; color:var(--g); margin-bottom:8px;">
            <span>${label}</span>
            <span style="font-family:'VT323'; font-size:1.2rem; opacity:0.6;">${count}</span>
          </div>
          <div class="health-bar-container"><div class="health-bar-fill" style="width:${pct}%;"></div></div>
        </div>`;
      })
      .join("");
    if (!totalTasks) document.getElementById("dashEmpty").style.display = "block";

    // Hyper-Sleep (Pomodoro) Logic
    let pomoTime = 25 * 60;
    let pomoInterval = null;
    const pomoDisplay = document.getElementById("pomoTimer");
    const updatePomo = () => {
      const m = Math.floor(pomoTime / 60);
      const s = pomoTime % 60;
      pomoDisplay.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    };
    document.getElementById("pomoStart").addEventListener("click", (e) => {
      if (pomoInterval) {
        clearInterval(pomoInterval);
        pomoInterval = null;
        e.target.textContent = "ENGAGE";
        SFX.error();
      } else {
        pomoInterval = setInterval(() => {
          if (pomoTime > 0) {
            pomoTime--;
            updatePomo();
            if (pomoTime % 60 === 0) SFX.play(200, 0.05, "sine"); // Minute pulse
          } else {
            clearInterval(pomoInterval);
            showToast("HYPER-SLEEP CYCLE COMPLETE. PILOT AWAKENED.", "success");
            SFX.success();
          }
        }, 1000);
        e.target.textContent = "ABORT";
        SFX.confirm();
      }
    });
    document.getElementById("pomoReset").addEventListener("click", () => {
      pomoTime = 25 * 60;
      updatePomo();
      SFX.click();
    });

    // ═══════════════════════════════════════════════════════
    // SQUAD COMMS ENGINE
    // ═══════════════════════════════════════════════════════
    const commsBox = document.getElementById("commsBox");
    const commsInput = document.getElementById("commsInput");
    const commsSend = document.getElementById("commsSend");

    let lastMsgId = "";
    const loadMessages = async () => {
      try {
        const msgs = await api("/api/comms");
        if (msgs.length && msgs[msgs.length-1].id !== lastMsgId) {
          commsBox.innerHTML = msgs.map(m => `
            <div style="margin-bottom:8px; border-left:2px solid var(--y); padding-left:8px;">
              <span style="opacity:0.6; font-size:0.7rem;">[${new Date(m.timestamp).toLocaleTimeString()}]</span>
              <span style="color:#fff; margin-right:5px;">&lt;${m.user}&gt;</span>
              <span>${esc(m.text)}</span>
            </div>
          `).join("");
          commsBox.scrollTop = commsBox.scrollHeight;
          lastMsgId = msgs[msgs.length-1].id;
          if (document.visibilityState === 'visible') SFX.play(2000, 0.05, "sine");
        }
      } catch(e) {}
    };

    const sendMsg = async () => {
      const text = commsInput.value.trim();
      if (!text) return;
      commsInput.value = "";
      try {
        await api("/api/comms", { method: "POST", body: JSON.stringify({ text }) });
        loadMessages();
      } catch(e) { showToast("SIGNAL JAMMED. RETRY.", "error"); }
    };

    commsSend.addEventListener("click", sendMsg);
    commsInput.addEventListener("keydown", (e) => { if(e.key === "Enter") sendMsg(); });
    
    loadMessages();
    setInterval(loadMessages, 3000);

  } catch (err) {
    console.error("Tactical link failure:", err);
  }
})();
