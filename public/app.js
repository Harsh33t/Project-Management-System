const projectForm = document.getElementById("projectForm");
const projectsEl = document.getElementById("projects");
const activityEl = document.getElementById("activity");
const taskFormTemplate = document.getElementById("taskFormTemplate");

const esc = (s = "") =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function json(url, options) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function fmtDate(iso) {
  if (!iso) return "No deadline";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "No deadline" : d.toLocaleDateString();
}

function renderProjects(projects) {
  if (!projects.length) {
    projectsEl.innerHTML = "<p>No projects yet. Add your first project.</p>";
    return;
  }
  projectsEl.innerHTML = projects
    .map(
      (project) => `
      <article class="project">
        <div class="project-head">
          <div>
            <h3>${esc(project.title)}</h3>
            <p>${esc(project.description || "No description")}</p>
          </div>
          <div class="chips">
            <span class="chip">${esc(project.status)}</span>
            <span class="chip">${fmtDate(project.deadline)}</span>
          </div>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.5rem 0 .3rem;">
          <button data-edit-project="${project.id}">Edit Project</button>
          <button class="danger" data-delete-project="${project.id}">Delete Project</button>
        </div>
        <div data-task-form="${project.id}"></div>
        <div>
          ${(project.tasks || [])
            .map(
              (task) => `
                <div class="task">
                  <div>
                    <strong>${esc(task.title)}</strong>
                    <div class="task-meta">
                      <span class="chip">${esc(task.status)}</span>
                      <span class="chip">${esc(task.priority)}</span>
                      <span class="chip">${esc((task.assignedUsers || []).join(", ") || "Unassigned")}</span>
                    </div>
                  </div>
                  <div class="task-actions">
                    <button data-edit-task="${project.id}:${task.id}">Edit</button>
                    <button class="danger" data-delete-task="${project.id}:${task.id}">Delete</button>
                  </div>
                </div>`
            )
            .join("")}
        </div>
      </article>`
    )
    .join("");

  projects.forEach((project) => {
    const mount = document.querySelector(`[data-task-form="${project.id}"]`);
    const node = taskFormTemplate.content.cloneNode(true);
    const form = node.querySelector("form");
    form.dataset.projectId = project.id;
    mount.appendChild(node);
  });
}

function renderActivity(items) {
  activityEl.innerHTML = items
    .map((a) => `<li>${esc(a.message)} <small>(${new Date(a.timestamp).toLocaleString()})</small></li>`)
    .join("");
}

async function load() {
  const [projects, activity] = await Promise.all([
    json("/api/projects"),
    json("/api/activity?limit=30")
  ]);
  renderProjects(projects);
  renderActivity(activity);
}

projectForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(projectForm);
  const payload = Object.fromEntries(fd.entries());
  try {
    await json("/api/projects", { method: "POST", body: JSON.stringify(payload) });
    projectForm.reset();
    await load();
  } catch (err) {
    alert(err.message);
  }
});

document.body.addEventListener("submit", async (e) => {
  const form = e.target.closest(".task-form");
  if (!form) return;
  e.preventDefault();
  const projectId = form.dataset.projectId;
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  payload.assignedUsers = String(payload.assignedUsers)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  try {
    await json(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    form.reset();
    await load();
  } catch (err) {
    alert(err.message);
  }
});

document.body.addEventListener("click", async (e) => {
  const delProject = e.target.closest("[data-delete-project]");
  if (delProject) {
    if (!confirm("Delete this project?")) return;
    await json(`/api/projects/${delProject.dataset.deleteProject}`, { method: "DELETE" });
    return load();
  }

  const editProject = e.target.closest("[data-edit-project]");
  if (editProject) {
    const id = editProject.dataset.editProject;
    const title = prompt("New project title:");
    if (!title) return;
    await json(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify({ title }) });
    return load();
  }

  const delTask = e.target.closest("[data-delete-task]");
  if (delTask) {
    if (!confirm("Delete this task?")) return;
    const [projectId, taskId] = delTask.dataset.deleteTask.split(":");
    await json(`/api/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" });
    return load();
  }

  const editTask = e.target.closest("[data-edit-task]");
  if (editTask) {
    const [projectId, taskId] = editTask.dataset.editTask.split(":");
    const title = prompt("New task title:");
    if (!title) return;
    await json(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify({ title })
    });
    return load();
  }
});

load().catch((err) => alert(err.message));
