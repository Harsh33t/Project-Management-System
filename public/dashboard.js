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
        return `<div class="status-row" style="margin-bottom:15px;">
          <div style="display:flex; justify-content:space-between; font-family:'Press Start 2P'; font-size:0.6rem; color:var(--g); margin-bottom:5px;">
            <span>${label}</span>
            <span style="font-family:'VT323'; font-size:1.2rem;">${count}</span>
          </div>
          <div class="health-bar-container" style="height:12px;"><div class="health-bar-fill" style="width:${pct}%; filter:hue-rotate(${cls === 'todo-fill' ? '0deg' : cls === 'progress-fill' ? '180deg' : '90deg'});"></div></div>
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
  } catch (err) {
    console.error("Tactical link failure:", err);
  }
})();
