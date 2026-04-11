const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("request failed");
  return r.json();
}

(async function init() {
  const [meta, projects] = await Promise.all([getJson("/api/meta"), getJson("/api/projects")]);
  const users = meta.users || [];
  const userSel = document.getElementById("currentUserSelect");
  const storedUser = localStorage.getItem("nexus_user");
  let displayUser = "PLAYER_1";
  if (storedUser) {
    try { 
      const parsed = JSON.parse(storedUser);
      displayUser = (typeof parsed === 'object' ? (parsed.username || parsed.name) : parsed) || storedUser;
    } catch(e) { displayUser = storedUser; }
  }
  userSel.innerHTML = `[ ` + esc(displayUser) + ` ]`;

  const tasks = projects.flatMap((p) => p.tasks || []);
  const totalProjects = projects.length;
  const totalTasks = tasks.length;
  const overdue = projects.filter((p) => p.deadline && new Date(p.deadline) < new Date() && p.status !== "completed").length;
  const completed = tasks.filter((t) => t.completed || t.status === "done").length;

  const stats = [
    ["TOTAL PROJECTS", totalProjects, "◼"],
    ["TOTAL TASKS", totalTasks, "▦"],
    ["OVERDUE", overdue, "⚠"],
    ["COMPLETED", completed, "✓"]
  ];
  document.getElementById("stats").innerHTML = stats
    .map(([label, value, icon]) => `<article class="stat-card"><div class="stat-top"><span>${label}</span><span>${icon}</span></div><div class="stat-value">${value}</div></article>`)
    .join("");

  const todo = tasks.filter((t) => t.status === "todo").length;
  const progress = tasks.filter((t) => t.status === "in-progress").length;
  const done = tasks.filter((t) => t.status === "done" || t.completed).length;
  const total = Math.max(totalTasks, 1);
  const rows = [
    ["TO DO", todo, "todo-fill"],
    ["IN PROGRESS", progress, "progress-fill"],
    ["DONE", done, "done-fill"]
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
})();
