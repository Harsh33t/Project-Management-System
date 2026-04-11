const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const st = { users: [], projects: [], rows: [], limit: 10, filter: "" };
function rel(iso) {
  const sec = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
async function j(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("request failed");
  return r.json();
}
function rowClass(a) {
  if (a.action === "created") return "act-create";
  if (a.action === "deleted") return "act-delete";
  if (String(a.message || "").toLowerCase().includes("upload")) return "act-upload";
  return "act-edit";
}
function render() {
  const filtered = st.rows.filter((r) => !st.filter || r.projectId === st.filter);
  const view = filtered.slice(0, st.limit);
  const root = document.getElementById("activity");
  if (!view.length) {
    root.innerHTML = `<div class="empty-state">[ NO ACTIVITY RECORDED ] <span class="blink">_</span></div>`;
    document.getElementById("loadMoreBtn").style.display = "none";
    return;
  }
  root.innerHTML = view
    .map((a) => {
      const action = a.action || "edited";
      const msg = esc(a.message || "");
      const user = esc(a.userName || "PLAYER_1");
      return `<article class="activity-row ${rowClass(a)}"><div class="activity-main"><span class="act-dot"></span><div><span style="opacity:.7">${action.toUpperCase()}:</span> <span style="color:#8dffad">"${msg}"</span> <span style="opacity:.7">BY</span> <span style="color:#ffd700">${user}</span></div></div><div class="activity-time">${rel(a.timestamp)}</div></article>`;
    })
    .join("");
  document.getElementById("loadMoreBtn").style.display = filtered.length > st.limit ? "inline-block" : "none";
}

(async function init() {
  const [meta, projects, activity] = await Promise.all([j("/api/meta"), j("/api/projects"), j("/api/activity?limit=200")]);
  st.users = meta.users || [];
  st.projects = projects || [];
  st.rows = activity || [];
  document.getElementById("currentUserSelect").innerHTML = st.users.map((u) => `<option>${esc(u.name)}</option>`).join("");
  const f = document.getElementById("projectFilter");
  f.innerHTML = [`<option value="">ALL PROJECTS</option>`].concat(st.projects.map((p) => `<option value="${p.id}">${esc(p.title)}</option>`)).join("");
  f.addEventListener("change", () => {
    st.filter = f.value;
    st.limit = 10;
    render();
  });
  document.getElementById("loadMoreBtn").addEventListener("click", () => {
    st.limit += 10;
    render();
  });
  render();
})();
