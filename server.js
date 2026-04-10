const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    const seed = {
      projects: [
        {
          id: "p1",
          title: "Nexus Product Launch",
          description: "Roll out v1 with content, onboarding, and QA.",
          status: "in-progress",
          deadline: "2026-05-10",
          tasks: [
            {
              id: "t1",
              title: "Finalize onboarding copy",
              status: "todo",
              priority: "high",
              assignedUsers: ["Pratham", "Riya"]
            }
          ]
        }
      ],
      activity: [
        {
          id: "a1",
          message: "Project Nexus Product Launch created",
          timestamp: new Date().toISOString()
        }
      ]
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), "utf-8");
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

function writeDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf-8");
}

function id(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function logActivity(db, message) {
  db.activity.unshift({
    id: id("a"),
    message,
    timestamp: new Date().toISOString()
  });
  db.activity = db.activity.slice(0, 200);
}

app.get("/api/projects", (req, res) => {
  const db = readDb();
  res.json(db.projects);
});

app.post("/api/projects", (req, res) => {
  const { title, description, status, deadline } = req.body;
  if (!title || !status) {
    return res.status(400).json({ error: "title and status are required" });
  }
  const db = readDb();
  const project = {
    id: id("p"),
    title,
    description: description || "",
    status,
    deadline: deadline || "",
    tasks: []
  };
  db.projects.unshift(project);
  logActivity(db, `Project "${project.title}" created`);
  writeDb(db);
  res.status(201).json(project);
});

app.put("/api/projects/:projectId", (req, res) => {
  const { projectId } = req.params;
  const { title, description, status, deadline } = req.body;
  const db = readDb();
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: "project not found" });
  }
  project.title = title ?? project.title;
  project.description = description ?? project.description;
  project.status = status ?? project.status;
  project.deadline = deadline ?? project.deadline;
  logActivity(db, `Project "${project.title}" edited`);
  writeDb(db);
  res.json(project);
});

app.delete("/api/projects/:projectId", (req, res) => {
  const { projectId } = req.params;
  const db = readDb();
  const idx = db.projects.findIndex((p) => p.id === projectId);
  if (idx < 0) {
    return res.status(404).json({ error: "project not found" });
  }
  const [removed] = db.projects.splice(idx, 1);
  logActivity(db, `Project "${removed.title}" deleted`);
  writeDb(db);
  res.status(204).send();
});

app.post("/api/projects/:projectId/tasks", (req, res) => {
  const { projectId } = req.params;
  const { title, status, priority, assignedUsers } = req.body;
  if (!title || !status || !priority) {
    return res.status(400).json({ error: "title, status and priority are required" });
  }
  const db = readDb();
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: "project not found" });
  }
  const task = {
    id: id("t"),
    title,
    status,
    priority,
    assignedUsers: Array.isArray(assignedUsers) ? assignedUsers : []
  };
  project.tasks.unshift(task);
  logActivity(db, `Task "${task.title}" added to "${project.title}"`);
  writeDb(db);
  res.status(201).json(task);
});

app.put("/api/projects/:projectId/tasks/:taskId", (req, res) => {
  const { projectId, taskId } = req.params;
  const { title, status, priority, assignedUsers } = req.body;
  const db = readDb();
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: "project not found" });
  }
  const task = project.tasks.find((t) => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: "task not found" });
  }
  task.title = title ?? task.title;
  task.status = status ?? task.status;
  task.priority = priority ?? task.priority;
  task.assignedUsers = Array.isArray(assignedUsers) ? assignedUsers : task.assignedUsers;
  logActivity(db, `Task "${task.title}" edited in "${project.title}"`);
  writeDb(db);
  res.json(task);
});

app.delete("/api/projects/:projectId/tasks/:taskId", (req, res) => {
  const { projectId, taskId } = req.params;
  const db = readDb();
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: "project not found" });
  }
  const idx = project.tasks.findIndex((t) => t.id === taskId);
  if (idx < 0) {
    return res.status(404).json({ error: "task not found" });
  }
  const [removed] = project.tasks.splice(idx, 1);
  logActivity(db, `Task "${removed.title}" deleted from "${project.title}"`);
  writeDb(db);
  res.status(204).send();
});

app.get("/api/activity", (req, res) => {
  const db = readDb();
  const limit = Number(req.query.limit || 25);
  res.json(db.activity.slice(0, Math.min(200, limit)));
});

app.listen(PORT, () => {
  ensureDb();
  console.log(`Server running on http://localhost:${PORT}`);
});
