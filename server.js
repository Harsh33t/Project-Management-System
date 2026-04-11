const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

const allowedExt = new Set([".xlsx", ".xls", ".pdf", ".doc", ".docx", ".rar"]);
const allowedCategory = new Set(["excel", "pdf", "word", "rar"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 50);
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExt.has(ext)) {
      return cb(new Error("Only Excel, PDF, Word, and RAR files are allowed"));
    }
    cb(null, true);
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOADS_DIR));

const defaultUsers = [
  { id: "u1", name: "PLAYER_1", color: "#00ff41" },
  { id: "u2", name: "NOVA", color: "#ff0055" },
  { id: "u3", name: "BYTE", color: "#00d9ff" },
  { id: "u4", name: "PIXEL", color: "#ffd23f" }
];

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    const seed = {
      users: defaultUsers,
      projects: [
        {
          id: "p1",
          title: "Nexus Product Launch",
          description: "Roll out v1 with content, onboarding, and QA.",
          status: "active",
          deadline: "2026-05-10",
          createdAt: new Date().toISOString(),
          tasks: [
            {
              id: "t1",
              title: "Finalize onboarding copy",
              status: "todo",
              priority: "high",
              assignedUsers: ["u1", "u3"],
              dueDate: "2026-05-01",
              notes: "Review CTA line with design team.",
              completed: false,
              comments: [],
              createdAt: new Date().toISOString()
            }
          ],
          attachments: []
        }
      ],
      activity: [
        {
          id: "a1",
          message: "Project Nexus Product Launch created",
          timestamp: new Date().toISOString(),
          action: "created",
          projectId: "p1",
          userName: "PLAYER_1"
        }
      ]
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), "utf-8");
  }
}

function readDb() {
  ensureDb();
  const db = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  if (!Array.isArray(db.users) || !db.users.length) db.users = defaultUsers;
  db.projects = (db.projects || []).map((p) => ({
    createdAt: p.createdAt || new Date().toISOString(),
    attachments: Array.isArray(p.attachments) ? p.attachments : [],
    tasks: Array.isArray(p.tasks)
      ? p.tasks.map((t) => ({
          dueDate: t.dueDate || "",
          notes: t.notes || "",
          completed: typeof t.completed === "boolean" ? t.completed : t.status === "done",
          comments: Array.isArray(t.comments) ? t.comments : [],
          createdAt: t.createdAt || new Date().toISOString(),
          ...t
        }))
      : [],
    ...p
  }));
  db.activity = (db.activity || []).map((a) => ({
    action: a.action || "edited",
    userName: a.userName || "PLAYER_1",
    projectId: a.projectId || "",
    ...a
  }));
  return db;
}

function writeDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");
}

function id(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function getActor(req, db) {
  const byName = String(req.header("x-user") || "PLAYER_1").trim();
  const found = (db.users || []).find((u) => u.name.toLowerCase() === byName.toLowerCase());
  return found ? found.name : "PLAYER_1";
}

function logActivity(db, message, opts = {}) {
  db.activity.unshift({
    id: id("a"),
    message,
    timestamp: new Date().toISOString(),
    action: opts.action || "edited",
    projectId: opts.projectId || "",
    userName: opts.userName || "PLAYER_1"
  });
  db.activity = db.activity.slice(0, 200);
}

function asProjectStatus(input) {
  const s = String(input || "").toLowerCase();
  if (s === "in-progress") return "active";
  if (s === "done") return "completed";
  return s || "planned";
}

function asTaskStatus(input) {
  const s = String(input || "").toLowerCase();
  if (s === "doing") return "in-progress";
  return s || "todo";
}

function projectProgress(project) {
  const tasks = project.tasks || [];
  if (!tasks.length) return 0;
  const done = tasks.filter((t) => t.completed || t.status === "done").length;
  return Math.round((done / tasks.length) * 100);
}

app.get("/api/meta", (req, res) => {
  const db = readDb();
  res.json({ users: db.users });
});

app.get("/api/projects", (req, res) => {
  const db = readDb();
  const q = String(req.query.q || "").toLowerCase();
  const status = String(req.query.status || "").toLowerCase();
  const priority = String(req.query.priority || "").toLowerCase();
  const sort = String(req.query.sort || "createdAt");
  let projects = db.projects.filter((p) => {
    const titleOk = !q || p.title.toLowerCase().includes(q);
    const statusOk = !status || asProjectStatus(p.status) === status;
    const taskPriorityOk =
      !priority || (p.tasks || []).some((t) => String(t.priority || "").toLowerCase() === priority);
    return titleOk && statusOk && taskPriorityOk;
  });
  projects = projects.sort((a, b) => {
    if (sort === "deadline") return String(a.deadline || "9999").localeCompare(String(b.deadline || "9999"));
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
  projects = projects.map((p) => ({
    ...p,
    status: asProjectStatus(p.status),
    progress: projectProgress(p)
  }));
  res.json(projects);
});

app.post("/api/projects", (req, res) => {
  const { title, description, status, deadline } = req.body;
  if (!title || !status) {
    return res.status(400).json({ error: "title and status are required" });
  }
  const db = readDb();
  const userName = getActor(req, db);
  const project = {
    id: id("p"),
    title,
    description: description || "",
    status: asProjectStatus(status),
    deadline: deadline || "",
    createdAt: new Date().toISOString(),
    tasks: [],
    attachments: []
  };
  db.projects.unshift(project);
  logActivity(db, `Project "${project.title}" created`, {
    action: "created",
    projectId: project.id,
    userName
  });
  writeDb(db);
  res.status(201).json(project);
});

app.put("/api/projects/:projectId", (req, res) => {
  const { projectId } = req.params;
  const { title, description, status, deadline } = req.body;
  const db = readDb();
  const userName = getActor(req, db);
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: "project not found" });
  }
  project.title = title ?? project.title;
  project.description = description ?? project.description;
  project.status = status ? asProjectStatus(status) : project.status;
  project.deadline = deadline ?? project.deadline;
  logActivity(db, `Project "${project.title}" edited`, {
    action: "edited",
    projectId: project.id,
    userName
  });
  writeDb(db);
  res.json(project);
});

app.delete("/api/projects/:projectId", (req, res) => {
  const { projectId } = req.params;
  const db = readDb();
  const userName = getActor(req, db);
  const idx = db.projects.findIndex((p) => p.id === projectId);
  if (idx < 0) {
    return res.status(404).json({ error: "project not found" });
  }
  const [removed] = db.projects.splice(idx, 1);
  logActivity(db, `Project "${removed.title}" deleted`, {
    action: "deleted",
    projectId,
    userName
  });
  writeDb(db);
  res.status(204).send();
});

app.post("/api/projects/:projectId/tasks", (req, res) => {
  const { projectId } = req.params;
  const { title, status, priority, assignedUsers, dueDate, notes, completed } = req.body;
  if (!title || !status || !priority) {
    return res.status(400).json({ error: "title, status and priority are required" });
  }
  const db = readDb();
  const userName = getActor(req, db);
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: "project not found" });
  }
  const task = {
    id: id("t"),
    title,
    status: asTaskStatus(status),
    priority,
    assignedUsers: Array.isArray(assignedUsers) ? assignedUsers : []
    ,
    dueDate: dueDate || "",
    notes: notes || "",
    completed: Boolean(completed) || asTaskStatus(status) === "done",
    comments: [],
    createdAt: new Date().toISOString()
  };
  project.tasks.unshift(task);
  logActivity(db, `Task "${task.title}" added to "${project.title}"`, {
    action: "created",
    projectId,
    userName
  });
  writeDb(db);
  res.status(201).json(task);
});

app.put("/api/projects/:projectId/tasks/:taskId", (req, res) => {
  const { projectId, taskId } = req.params;
  const { title, status, priority, assignedUsers, dueDate, notes, completed } = req.body;
  const db = readDb();
  const userName = getActor(req, db);
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: "project not found" });
  }
  const task = project.tasks.find((t) => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: "task not found" });
  }
  task.title = title ?? task.title;
  task.status = status ? asTaskStatus(status) : task.status;
  task.priority = priority ?? task.priority;
  task.assignedUsers = Array.isArray(assignedUsers) ? assignedUsers : task.assignedUsers;
  task.dueDate = dueDate ?? task.dueDate;
  task.notes = notes ?? task.notes;
  if (typeof completed === "boolean") {
    task.completed = completed;
    if (completed) task.status = "done";
  }
  logActivity(db, `Task "${task.title}" edited in "${project.title}"`, {
    action: "edited",
    projectId,
    userName
  });
  writeDb(db);
  res.json(task);
});

app.delete("/api/projects/:projectId/tasks/:taskId", (req, res) => {
  const { projectId, taskId } = req.params;
  const db = readDb();
  const userName = getActor(req, db);
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: "project not found" });
  }
  const idx = project.tasks.findIndex((t) => t.id === taskId);
  if (idx < 0) {
    return res.status(404).json({ error: "task not found" });
  }
  const [removed] = project.tasks.splice(idx, 1);
  logActivity(db, `Task "${removed.title}" deleted from "${project.title}"`, {
    action: "deleted",
    projectId,
    userName
  });
  writeDb(db);
  res.status(204).send();
});

app.get("/api/activity", (req, res) => {
  const db = readDb();
  const limit = Number(req.query.limit || 25);
  const projectId = String(req.query.projectId || "");
  const rows = (db.activity || []).filter((a) => !projectId || a.projectId === projectId);
  res.json(rows.slice(0, Math.min(200, limit)));
});

app.post("/api/projects/:projectId/tasks/:taskId/comments", (req, res) => {
  const { projectId, taskId } = req.params;
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });
  const db = readDb();
  const userName = getActor(req, db);
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return res.status(404).json({ error: "project not found" });
  const task = (project.tasks || []).find((t) => t.id === taskId);
  if (!task) return res.status(404).json({ error: "task not found" });
  task.comments.unshift({
    id: id("c"),
    text: String(text),
    userName,
    timestamp: new Date().toISOString()
  });
  logActivity(db, `Comment added on "${task.title}"`, {
    action: "edited",
    projectId,
    userName
  });
  writeDb(db);
  res.status(201).json(task.comments[0]);
});

app.post("/api/projects/:projectId/files", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload failed" });
    }
    const { projectId } = req.params;
    const category = String(req.body.category || "").toLowerCase();
    if (!allowedCategory.has(category)) {
      return res.status(400).json({ error: "Invalid file category" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "file is required" });
    }
    const db = readDb();
    const userName = getActor(req, db);
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) {
      return res.status(404).json({ error: "project not found" });
    }
    if (!Array.isArray(project.attachments)) {
      project.attachments = [];
    }
    const fileMeta = {
      id: id("f"),
      filename: req.file.filename,
      originalName: req.file.originalname,
      category,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
      url: `/uploads/${req.file.filename}`
    };
    project.attachments.unshift(fileMeta);
    logActivity(db, `File "${fileMeta.originalName}" uploaded to "${project.title}"`, {
      action: "created",
      projectId,
      userName
    });
    writeDb(db);
    res.status(201).json(fileMeta);
  });
});

app.get("/api/projects/:projectId/export", (req, res) => {
  const { projectId } = req.params;
  const format = String(req.query.format || "json").toLowerCase();
  const db = readDb();
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return res.status(404).json({ error: "project not found" });
  if (format === "csv") {
    const rows = [["Task Title", "Status", "Priority", "Due Date", "Completed", "Assignees", "Notes"]];
    for (const t of project.tasks || []) {
      rows.push([
        t.title || "",
        t.status || "",
        t.priority || "",
        t.dueDate || "",
        t.completed ? "yes" : "no",
        (t.assignedUsers || []).join("|"),
        (t.notes || "").replace(/\n/g, " ")
      ]);
    }
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${project.title.replace(/\s+/g, "_")}.csv"`);
    return res.send(csv);
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${project.title.replace(/\s+/g, "_")}.json"`);
  res.send(JSON.stringify(project, null, 2));
});

app.listen(PORT, () => {
  ensureDb();
  console.log(`Server running on http://localhost:${PORT}`);
});
