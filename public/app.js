const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const st = { users: [], projects: [], user: "PLAYER_1", q: "", status: "", sort: "createdAt" };
const CODENAMES = {
  p: ["NEBULA", "VOYAGER", "ORION", "TITAN", "APOLLO", "ZENITH", "COSMOS", "SOLAR", "LUNAR", "STELLAR", "OMEGA", "ALPHA", "NOVA", "QUASAR", "VOID", "GALAXY", "PULSAR", "ASTRA", "ECLIPSE", "ORBIT"],
  s: ["STRIKE", "INITIATIVE", "CORE", "PULSE", "GATE", "BRIDGE", "FALL", "RISE", "PROTOCOL", "COMMAND", "SHIELD", "SWORD", "SPEAR", "EYE", "SIGNAL", "NETWORK", "LINK", "DASH", "JUMP", "DRIFT"]
};
function generateCodename() {
  const p = CODENAMES.p[Math.floor(Math.random() * CODENAMES.p.length)];
  const s = CODENAMES.s[Math.floor(Math.random() * CODENAMES.s.length)];
  return `PROJECT_${p}_${s}`;
}
const $ = (q) => document.querySelector(q);

const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" 
  ? "" 
  : "https://your-render-url-here.onrender.com";

async function api(url, options = {}) {
  const res = await fetch(API_BASE + url, {
    headers: { "Content-Type": "application/json", "x-user": st.user, ...(options.headers || {}) },
    ...options
  });
  if (!res.ok && res.status !== 204) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || "request failed");
  }
  return res.status === 204 ? null : res.json();
}
function daysLeft(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
function statusBadge(p) {
  const left = daysLeft(p.deadline);
  if (left !== null && left < 0 && p.status !== "completed") return `<span class="badge badge-overdue">OVERDUE</span>`;
  if (p.status === "planned") return `<span class="badge badge-planned">PLANNED</span>`;
  if (p.status === "completed") return `<span class="badge badge-completed">COMPLETED</span>`;
  return `<span class="badge badge-active">ACTIVE</span>`;
}
function userById(id) {
  return st.users.find((u) => u.id === id);
}
function progress(project) {
  const tasks = project.tasks || [];
  if (!tasks.length) return 0;
  const done = tasks.filter((t) => t.status === "done" || t.completed).length;
  return Math.round((done / tasks.length) * 100);
}
function assigneeToggles(projectId) {
  return `<div class="assignee-grid">${st.users
    .map(
      (u) =>
        `<label class="assignee-toggle"><input type="checkbox" name="assignedUsers" value="${u.id}"/><span class="assignee-pill">[ ] ${esc(
          u.name
        )}</span></label>`
    )
    .join("")}</div>`;
}
function taskCard(projectId, t) {
  const priClass = t.priority === "high" ? "pri-high" : t.priority === "medium" ? "pri-medium" : "pri-low";
  const priLabel = t.priority === "high" ? "CRITICAL" : t.priority === "medium" ? "HIGH" : "STABLE";
  const statusIcon = t.completed || t.status === "done" ? "status-done" : t.status === "in-progress" ? "status-in-progress" : "status-todo";
  
  return `<div class="log-entry" data-task-id="${t.id}" title="MISSION NOTES: ${esc(t.notes || 'None')}">
    <div class="log-status-bullet ${statusIcon}"></div>
    <div style="flex:1; font-family:'VT323'; font-size:1.1rem;">
      <span style="color:rgba(255,255,255,0.9)">${esc(t.title)}</span>
      <span style="color:rgba(255,255,255,0.4); font-size:0.8rem; margin-left:10px;">[ ${t.dueDate || 'NO_DEADLINE'} ]</span>
    </div>
    <div class="log-priority ${priClass}">${priLabel}</div>
    <div class="task-ops" style="display:flex; gap:5px;">
      <button class="task-op" style="padding:2px 8px; border-color:var(--g); color:var(--g); font-size:0.6rem;" data-done-task="${projectId}:${t.id}">✓</button>
      <button class="task-op btn-danger" style="padding:2px 8px; font-size:0.6rem;" data-delete-task="${projectId}:${t.id}">✕</button>
    </div>
  </div>`;
}

async function requestBriefing(projectId) {
  const briefingBox = $(`#briefing_${projectId}`);
  briefingBox.innerHTML = `<b>COMMANDER'S BRIEFING</b> DECIPHERING SIGNAL... <span class="blink">_</span>`;
  briefingBox.style.display = "block";
  try {
    const data = await api(`/api/projects/${projectId}/briefing`);
    briefingBox.innerHTML = `<b>COMMANDER'S BRIEFING</b> ${esc(data.briefing)}`;
  } catch (err) {
    briefingBox.innerHTML = `<b>COMMANDER'S BRIEFING</b> [ ERROR ] COMM LINK FAILURE.`;
  }
}

function renderProjects() {
  let rows = [...st.projects];
  if (st.q) rows = rows.filter((p) => p.title.toLowerCase().includes(st.q.toLowerCase()));
  if (st.status) rows = rows.filter((p) => p.status === st.status);
  rows.sort((a, b) =>
    st.sort === "deadline"
      ? String(a.deadline || "9999").localeCompare(String(b.deadline || "9999"))
      : String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );

  $("#projects").innerHTML = rows
    .map((p) => {
      const pg = progress(p);
      const tasks = p.tasks || [];
      const taskEntries = tasks.map((t) => taskCard(p.id, t)).join("");
      
      return `<article class="project-card">
        <div class="folder-tab">MISSION: ${esc(p.title)}</div>
        <div class="project-header-row">
          <div><span class="project-id-tag">ID_${p.id.slice(-4).toUpperCase()}</span> <span class="project-title" style="font-size:1.2rem; filter:drop-shadow(var(--g-glow));">${esc(p.title)}</span></div>
          <div class="badge-row">${statusBadge(p)} <span class="badge" style="border-color:var(--y); color:var(--y);">${esc(p.deadline || "INF")}</span></div>
        </div>

        <div style="padding: 0 20px;">
          <p class="project-desc" style="font-family:'VT323'; font-size:1.2rem; color:rgba(0,255,65,0.7); margin-top:15px;">${esc(p.description || "NO MISSION OBJECTIVE DEFINED.")}</p>
          
          <div style="margin: 20px 0;">
             <div style="display:flex; justify-content:space-between; font-family:'Press Start 2P'; font-size:0.6rem; color:var(--g);">
               <span>MISSION PROGRESS</span>
               <span>${pg}%</span>
             </div>
             <div class="health-bar-container"><div class="health-bar-fill" style="width:${pg}%"></div></div>
          </div>
        </div>

        <div id="briefing_${p.id}" class="briefing-box" style="display:none"></div>

        <div class="combat-log">
          <div style="font-family:'Press Start 2P'; font-size:0.6rem; color:var(--y); margin-bottom:10px; border-bottom:1px solid var(--y); padding-bottom:4px;">[ COMBAT_LOG ]</div>
          ${taskEntries || `<div class="empty-state" style="font-family:'VT323';">[ NO OPERATIONS LOGGED ]</div>`}
        </div>

        <div style="padding: 10px 20px;">
          <button data-task-toggle="${p.id}" style="width:100%; padding:10px; border:1px dashed var(--g); background:rgba(0,255,65,0.05); color:var(--g); font-family:inherit; cursor:pointer; font-size:0.75rem;">+ INITIALIZE NEW OPERATION</button>
        </div>

        <form id="task_form_${p.id}" class="task-form-body" style="display:none; padding:15px 20px; background:rgba(0,0,0,0.5); border:1px solid var(--g-dim);" data-task-form="${p.id}">
          <div class="task-row-1">
            <input name="title" placeholder="OPERATION CODENAME" required />
            <select name="priority"><option value="low">STABLE</option><option value="medium">HIGH</option><option value="high">CRITICAL</option></select>
          </div>
          <div class="task-row-2">
            <input type="date" name="dueDate" />
            ${assigneeToggles(p.id)}
          </div>
          <div class="task-row-3">
            <textarea name="notes" rows="2" placeholder="SITREP DETAILS"></textarea>
            <button class="right">START OP</button>
          </div>
        </form>

        <div class="action-row" style="padding:15px 20px; border-top:1px solid var(--g-dim); background:rgba(0,0,0,0.2); display:flex; flex-wrap:wrap; gap:10px;">
          <button style="border-color:var(--c); color:var(--c);" onclick="requestBriefing('${p.id}')">REQUEST BRIEFING</button>
          <button data-edit-project="${p.id}">MODIFY</button>
          <button class="btn-danger" data-delete-project="${p.id}">ABORT</button>
          <button style="font-size:0.6rem;" data-export-project="${p.id}:json">EXP_JSON</button>
          <button style="font-size:0.6rem;" data-export-project="${p.id}:csv">EXP_CSV</button>
          
          <form class="file-row" data-upload-form="${p.id}" style="margin-left:auto; display:flex; gap:5px; border:none; padding:0;">
             <input class="file-input-hidden" id="file_${p.id}" name="file" type="file" required />
             <label class="btn" style="padding:4px 8px; font-size:0.6rem;" for="file_${p.id}">FILE</label>
             <button style="padding:4px 8px; font-size:0.6rem;">UPLOAD</button>
          </form>
        </div>

        <div class="tags-wrap" style="padding:0 20px 15px;">${(p.attachments || [])
          .map((f) => `<span class="file-tag" style="font-size:0.7rem;">${esc(f.originalName)} <button style="font-size:0.6rem;" data-preview-file="${p.id}:${f.id}">VIEW</button></span>`)
          .join("")}</div>
      </article>`;
    })
    .join("");

  document.querySelectorAll("[data-status-col]").forEach((col) => {
    const [pid, status] = col.dataset.statusCol.split(":");
    Sortable.create(col, {
      group: pid,
      animation: 110,
      draggable: ".task-card",
      onEnd: async (evt) => {
        const tid = evt.item.dataset.taskId;
        await api(`/api/projects/${pid}/tasks/${tid}`, {
          method: "PUT",
          body: JSON.stringify({ status, completed: status === "done" })
        });
        await load();
      }
    });
  });
}

async function load() {
  const [meta, projects] = await Promise.all([api("/api/meta"), api("/api/projects")]);
  st.users = meta.users || [];
  st.projects = projects || [];
  
  const userSel = $("#currentUserSelect");
  const storedUser = localStorage.getItem("nexus_user");
  let displayUser = st.user || "PLAYER_1";
  if (storedUser) {
    try { 
      const parsed = JSON.parse(storedUser);
      displayUser = (typeof parsed === 'object' ? (parsed.username || parsed.name) : parsed) || storedUser;
    } catch(e) { displayUser = storedUser; }
  }
  userSel.innerHTML = `[ ` + esc(displayUser) + ` ]`;
  renderProjects();
}

async function previewFile(projectId, fileId) {
  const p = st.projects.find((x) => x.id === projectId);
  const f = (p?.attachments || []).find((x) => x.id === fileId);
  if (!f) return;
  $("#previewTitle").textContent = f.originalName;
  if (f.category === "pdf") {
    $("#previewBody").innerHTML = `<iframe src="${f.url}" style="width:100%;height:65vh;border:none"></iframe>`;
  } else if (f.category === "excel") {
    const buf = await fetch(f.url).then((r) => r.arrayBuffer());
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(0, 20);
    $("#previewBody").innerHTML = `<table>${rows
      .map((r) => `<tr>${r.map((c) => `<td style="border:1px solid #00ff41;padding:6px">${esc(c ?? "")}</td>`).join("")}</tr>`)
      .join("")}</table>`;
  } else {
    $("#previewBody").textContent = "PREVIEW NOT AVAILABLE FOR THIS TYPE.";
  }
  $("#previewModal").showModal();
}

document.addEventListener("click", async (e) => {
  const t = e.target;
  const toggle = t.closest("[data-task-toggle]");
  if (toggle) {
    const pid = toggle.dataset.taskToggle;
    const form = document.getElementById(`task_form_${pid}`);
    const open = form.style.display !== "none";
    form.style.display = open ? "none" : "grid";
    toggle.textContent = open ? "+ ADD NEW TASK" : "- CANCEL";
    return;
  }
  if (t.id === "createToggle" || t.closest("#createToggle")) {
    const body = $("#createBody");
    const sym = $("#createToggleSymbol");
    const open = body.style.display !== "none";
    body.style.display = open ? "none" : "grid";
    sym.textContent = open ? "[+]" : "[-]";
    return;
  }
  if (t.dataset.previewFile) {
    const [pid, fid] = t.dataset.previewFile.split(":");
    return previewFile(pid, fid);
  }
  if (t.dataset.exportProject) {
    const [pid, fmt] = t.dataset.exportProject.split(":");
    return window.open(`/api/projects/${pid}/export?format=${fmt}`, "_blank");
  }
  if (t.dataset.editProject) {
    const p = st.projects.find((x) => x.id === t.dataset.editProject);
    if (!p) return;
    const title = prompt("PROJECT TITLE", p.title);
    if (!title) return;
    await api(`/api/projects/${p.id}`, { method: "PUT", body: JSON.stringify({ title }) });
    return load();
  }
  if (t.dataset.deleteProject) {
    await api(`/api/projects/${t.dataset.deleteProject}`, { method: "DELETE" });
    return load();
  }
  if (t.dataset.doneTask) {
    const [pid, tid] = t.dataset.doneTask.split(":");
    await api(`/api/projects/${pid}/tasks/${tid}`, { method: "PUT", body: JSON.stringify({ completed: true, status: "done" }) });
    showToast("OPERATION CLEAR. XP AWARDED.", "success");
    return load();
  }
  if (t.dataset.deleteTask) {
    const [pid, tid] = t.dataset.deleteTask.split(":");
    await api(`/api/projects/${pid}/tasks/${tid}`, { method: "DELETE" });
    return load();
  }
});

document.addEventListener("change", (e) => {
  if (e.target.id === "currentUserSelect") st.user = e.target.value;
  if (e.target.id === "searchProject") st.q = e.target.value.trim();
  if (e.target.id === "filterProjectStatus") st.status = e.target.value;
  if (e.target.id === "sortProjects") st.sort = e.target.value;
  if (e.target.matches(".file-input-hidden")) {
    const id = e.target.id.replace("file_", "");
    const out = document.getElementById(`fname_${id}`);
    out.textContent = e.target.files?.[0]?.name || "NO FILE";
  }
  renderProjects();
});
document.addEventListener("input", (e) => {
  if (e.target.id === "searchProject") {
    st.q = e.target.value.trim();
    renderProjects();
  }
});

document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const t = e.target;
  if (t.matches("[data-upload-form]")) {
    const pid = t.dataset.uploadForm;
    const fd = new FormData(t);
    await fetch(`/api/projects/${pid}/files`, { method: "POST", headers: { "x-user": st.user }, body: fd });
    return load();
  }
  if (t.matches("[data-task-form]")) {
    const pid = t.dataset.taskForm;
    const fd = new FormData(t);
    const assignedUsers = fd.getAll("assignedUsers");
    await api(`/api/projects/${pid}/tasks`, {
      method: "POST",
      body: JSON.stringify({
        title: fd.get("title"),
        status: "todo",
        priority: fd.get("priority"),
        dueDate: fd.get("dueDate"),
        notes: fd.get("notes"),
        assignedUsers
      })
    });
    return load();
  }
});

$("#createProjectBtn").addEventListener("click", async () => {
  const payload = {
    title: $("#projectTitle").value.trim(),
    status: $("#projectStatus").value,
    description: $("#projectDescription").value.trim(),
    deadline: $("#projectDeadline").value
  };
  if (!payload.title) return;
  await api("/api/projects", { method: "POST", body: JSON.stringify(payload) });
  $("#projectTitle").value = "";
  $("#projectDescription").value = "";
  $("#projectDeadline").value = "";
  await load();
});
$("#genCodenameBtn").addEventListener("click", () => {
  $("#projectTitle").value = generateCodename();
  SFX.play(1000, 0.05, "sine");
});
$("#closePreview").addEventListener("click", () => $("#previewModal").close());

load();

// ═══════════════════════════════════════════════════════
// TACTICAL KEYBOARD INTERFACE
// ═══════════════════════════════════════════════════════
window.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  const k = e.key.toUpperCase();
  if (k === "N") {
    const body = $("#createBody");
    const sym = $("#createToggleSymbol");
    body.style.display = "grid";
    sym.textContent = "[-]";
    $("#projectTitle").focus();
    SFX.confirm();
  }
  if (k === "S") {
    e.preventDefault();
    $("#searchProject").focus();
    SFX.play(1500, 0.05, "sine");
  }
  if (k === "P") {
    document.getElementById("phyToggle").click();
  }
});

// ═══════════════════════════════════════════════════════
// TACTICAL STARMAP ENGINE
// ═══════════════════════════════════════════════════════
let viewMode = "LIST";
function renderStarmap() {
  const canvas = $("#starmapCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  const projects = [...st.projects];
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw orbits
  ctx.strokeStyle = "rgba(0, 217, 255, 0.1)";
  for(let i=1; i<=5; i++) {
    ctx.beginPath(); ctx.arc(centerX, centerY, i * 60, 0, Math.PI * 2); ctx.stroke();
  }

  projects.forEach((p, i) => {
    const angle = (i / projects.length) * Math.PI * 2 + (Date.now() * 0.0002);
    const dist = 60 + (i % 5) * 60;
    const x = centerX + Math.cos(angle) * dist;
    const y = centerY + Math.sin(angle) * dist;
    p._starmap_pos = { x, y };

    ctx.fillStyle = p.status === 'completed' ? "var(--g)" : p.status === 'active' ? "var(--c)" : "var(--y)";
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.font = "10px 'Press Start 2P'";
    ctx.fillText(p.title.substring(0, 10), x + 10, y + 5);
  });

  if (viewMode === "STARMAP") requestAnimationFrame(renderStarmap);
}

$("#viewModeToggle")?.addEventListener("click", (e) => {
  viewMode = viewMode === "LIST" ? "STARMAP" : "LIST";
  e.target.textContent = `MODE: ${viewMode}`;
  const list = $("#projects");
  const map = $("#starmapPanel");
  if (viewMode === "STARMAP") {
    list.style.display = "none";
    map.style.display = "block";
    renderStarmap();
    SFX.confirm();
  } else {
    list.style.display = "block";
    map.style.display = "none";
    SFX.click();
  }
});

$("#starmapCanvas")?.addEventListener("click", (e) => {
  const rect = e.target.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const hit = st.projects.find(p => p._starmap_pos && Math.hypot(p._starmap_pos.x - mx, p._starmap_pos.y - my) < 15);
  if (hit) {
    showToast(`LOCKING ON: ${hit.title}`, "info");
    const el = document.querySelector(`.project-card[data-id="${hit.id}"]`) || document.getElementById(`briefing_${hit.id}`)?.parentElement;
    if (el) {
       viewMode = "LIST";
       $("#viewModeToggle").textContent = "MODE: LIST";
       $("#projects").style.display = "block";
       $("#starmapPanel").style.display = "none";
       el.scrollIntoView({ behavior: 'smooth' });
    }
  }
});
