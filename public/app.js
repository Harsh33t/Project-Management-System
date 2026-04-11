const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const st = { users: [], projects: [], user: "PLAYER_1", q: "", status: "", sort: "createdAt" };
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
  const pcls = t.priority === "high" ? "priority-high" : t.priority === "medium" ? "priority-medium" : "priority-low";
  return `<article class="task-card" data-task-id="${t.id}">
    <div class="heading-row">
      <div class="task-title">${esc(t.title)}</div>
      <span class="priority-badge ${pcls}">[${esc((t.priority || "low").toUpperCase())}]</span>
    </div>
    <div class="avatars">${(t.assignedUsers || [])
      .map((uid) => {
        const u = userById(uid);
        if (!u) return "";
        return `<span class="avatar" style="border-color:${u.color};color:${u.color}">${esc(u.name.slice(0, 2))}</span>`;
      })
      .join("")}</div>
    <div class="task-meta">
      <span>${t.dueDate ? esc(t.dueDate) : "NO DATE"}</span>
      <div class="task-ops">
        <button class="task-op" data-done-task="${projectId}:${t.id}">✓ DONE</button>
        <button class="task-op btn-danger" data-delete-task="${projectId}:${t.id}">✕ DELETE</button>
      </div>
    </div>
  </article>`;
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
      const todo = tasks.filter((t) => t.status === "todo").map((t) => taskCard(p.id, t)).join("");
      const doing = tasks.filter((t) => t.status === "in-progress").map((t) => taskCard(p.id, t)).join("");
      const done = tasks.filter((t) => t.status === "done" || t.completed).map((t) => taskCard(p.id, t)).join("");
      return `<article class="project-card">
        <div class="project-top">
          <h3 class="project-title">${esc(p.title)}</h3>
          <div class="badge-row">${statusBadge(p)}<span class="badge">${esc(p.deadline || "NO DATE")}</span></div>
        </div>
        <p class="project-desc">${esc(p.description || "")}</p>
        <div>
          <div class="project-progress-wrap"><div class="project-progress-fill" style="width:${pg}%"></div></div>
          <div class="section-label">${pg}% COMPLETE</div>
        </div>
        <hr class="divider"/>

        <form class="file-row" data-upload-form="${p.id}">
          <select name="category"><option value="excel">EXCEL</option><option value="pdf">PDF</option><option value="word">WORD</option><option value="rar">RAR</option></select>
          <div>
            <input class="file-input-hidden" id="file_${p.id}" name="file" type="file" accept=".xlsx,.xls,.pdf,.doc,.docx,.rar" required />
            <label class="btn" for="file_${p.id}">CHOOSE FILE</label>
            <span class="file-display" id="fname_${p.id}">NO FILE</span>
          </div>
          <button>UPLOAD</button>
        </form>
        <div class="tags-wrap">${(p.attachments || [])
          .map((f) => `<span class="file-tag">${esc(f.originalName)} <button data-preview-file="${p.id}:${f.id}">PREVIEW</button></span>`)
          .join("")}</div>

        <div class="action-row">
          <button data-edit-project="${p.id}">EDIT</button>
          <button class="btn-danger" data-delete-project="${p.id}">DELETE</button>
          <button data-export-project="${p.id}:json">EXPORT JSON</button>
          <button data-export-project="${p.id}:csv">EXPORT CSV</button>
        </div>
        <hr class="divider"/>

        <div style="margin: 10px 0;">
          <button data-task-toggle="${p.id}" style="width:100%; padding:10px; border:1px dashed #00ff41; background:rgba(0,255,65,0.05); color:#00ff41; font-family:inherit; cursor:pointer; font-size:0.75rem;">+ ADD NEW TASK</button>
        </div>
        <form id="task_form_${p.id}" class="task-form-body" style="display:none" data-task-form="${p.id}">
          <div class="task-row-1">
            <input name="title" placeholder="TASK TITLE" required />
            <select name="priority"><option value="low">LOW</option><option value="medium">MEDIUM</option><option value="high">HIGH</option></select>
          </div>
          <div class="task-row-2">
            <input type="date" name="dueDate" />
            ${assigneeToggles(p.id)}
          </div>
          <div class="task-row-3">
            <textarea name="notes" rows="3" placeholder="TASK NOTES"></textarea>
            <button class="right">ADD TASK</button>
          </div>
        </form>

        <div class="kanban">
          <section class="kan-col" data-status-col="${p.id}:todo"><div class="kan-head kan-todo">TODO</div>${todo || `<div class="empty-state">[ NO TASKS ]</div>`}</section>
          <section class="kan-col" data-status-col="${p.id}:in-progress"><div class="kan-head kan-progress">IN PROGRESS</div>${doing || `<div class="empty-state">[ NO TASKS ]</div>`}</section>
          <section class="kan-col" data-status-col="${p.id}:done"><div class="kan-head kan-done">DONE</div>${done || `<div class="empty-state">[ NO TASKS ]</div>`}</section>
        </div>
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
  userSel.innerHTML = st.users.map((u) => `<option value="${u.name}">${esc(u.name)}</option>`).join("");
  userSel.value = st.user;
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
$("#closePreview").addEventListener("click", () => $("#previewModal").close());

load();
