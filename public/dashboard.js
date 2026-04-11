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
  userSel.innerHTML = users.map((u) => `<option>${esc(u.name)}</option>`).join("");

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
      return `<div class="status-row"><span>${label}</span><div class="bar"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div><span>${count}</span></div>`;
    })
    .join("");
  if (!totalTasks) document.getElementById("dashEmpty").style.display = "block";
})();
