const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

/* ═══════════════════════════════════════════════════════
   AUTH CONFIG
   ═══════════════════════════════════════════════════════ */

// JWT secret – set via env var in production
const JWT_SECRET = process.env.JWT_SECRET || "nexus-pam-secret-" + crypto.randomBytes(8).toString("hex");
const JWT_EXPIRY_DAYS = 7;

// Google OAuth (set these env vars on Render)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";

// Optional: Groq API for chatbot AI
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

/* ═══════════════════════════════════════════════════════
   SIMPLE JWT IMPLEMENTATION (no dependency needed)
   ═══════════════════════════════════════════════════════ */

function base64url(str) {
  return Buffer.from(str).toString("base64url");
}

function createJWT(payload) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Date.now() + JWT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const body = base64url(JSON.stringify({ ...payload, exp }));
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(header + "." + body).digest("base64url");
  return header + "." + body + "." + sig;
}

function verifyJWT(token) {
  try {
    const [header, body, sig] = token.split(".");
    const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(header + "." + body).digest("base64url");
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════
   SIMPLE PASSWORD HASHING (using crypto, no bcrypt needed)
   ═══════════════════════════════════════════════════════ */

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return salt + ":" + hash;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === testHash;
}

/* ═══════════════════════════════════════════════════════
   MULTER SETUP
   ═══════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════
   MIDDLEWARE
   ═══════════════════════════════════════════════════════ */

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOADS_DIR));

/* ═══════════════════════════════════════════════════════
   DATABASE
   ═══════════════════════════════════════════════════════ */

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
      accounts: [],
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
  if (!Array.isArray(db.accounts)) db.accounts = [];
  
  // Ensure XP, teams, messages
  db.accounts.forEach(a => { if (a.xp === undefined) a.xp = 0; });
  if (!db.messages) db.messages = [];
  if (!db.teams) db.teams = [];
  // Ensure projects have tags and pinned fields
  (db.projects || []).forEach(p => {
    if (!p.tags) p.tags = [];
    if (p.pinned === undefined) p.pinned = false;
    if (!p.color) p.color = '#00ff41';
    (p.tasks || []).forEach(t => {
      if (!t.tags) t.tags = [];
      if (!t.comments) t.comments = [];
    });
  });
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

const RANKS = ["CADET", "PILOT", "OPERATIVE", "SERGEANT", "LIEUTENANT", "COMMANDER", "CAPTAIN", "MAJOR", "COLONEL", "GENERAL", "FLEET ADMIRAL"];
function getRank(xp = 0) {
  const lvl = Math.floor(Math.sqrt(xp / 10));
  return {
    rank: RANKS[Math.min(lvl, RANKS.length - 1)],
    level: lvl + 1,
    nextXp: Math.pow(lvl + 1, 2) * 10
  };
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

function randomGreenShade() {
  const greens = ["#00ff41", "#00e639", "#00cc31", "#33ff66", "#1aff5c", "#00b33c", "#4dff88"];
  return greens[Math.floor(Math.random() * greens.length)];
}

/* ═══════════════════════════════════════════════════════
   AUTH ROUTES
   ═══════════════════════════════════════════════════════ */

// Register
app.post("/api/auth/register", (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: "Username must be 3-20 characters" });
  }

  const db = readDb();
  const existing = db.accounts.find(
    (a) => a.username.toLowerCase() === username.toLowerCase() || a.email.toLowerCase() === email.toLowerCase()
  );
  if (existing) {
    return res.status(409).json({ error: "Username or email already exists" });
  }

  const account = {
    id: id("acc"),
    username: username.toUpperCase(),
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    avatarColor: randomGreenShade(),
    role: "OPERATIVE",
    createdAt: new Date().toISOString(),
    provider: "local"
  };

  db.accounts.push(account);

  // Also add to users list for project assignment
  const userId = id("u");
  db.users.push({ id: userId, name: account.username, color: account.avatarColor });

  logActivity(db, `New operative "${account.username}" enlisted`, {
    action: "created",
    userName: account.username
  });

  writeDb(db);
  res.status(201).json({ message: "Recruit registered successfully" });
});

// Login
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const db = readDb();
  const account = db.accounts.find(
    (a) => a.username.toLowerCase() === username.toLowerCase() || a.email.toLowerCase() === username.toLowerCase()
  );

  if (!account || !account.passwordHash) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (!verifyPassword(password, account.passwordHash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = createJWT({
    id: account.id,
    username: account.username,
    email: account.email,
    role: account.role
  });

  res.json({
    token,
    user: {
      id: account.id,
      username: account.username,
      email: account.email,
      avatarColor: account.avatarColor,
      role: account.role
    }
  });
});

// Google OAuth - initiate
app.get("/api/auth/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(501).json({ error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables." });
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent"
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// Google OAuth - callback
app.get("/api/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect("/login.html?error=no_code");

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code"
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("No access token");

    // Get user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const googleUser = await userRes.json();
    if (!googleUser.email) throw new Error("No email from Google");

    const db = readDb();
    let account = db.accounts.find((a) => a.email.toLowerCase() === googleUser.email.toLowerCase());

    if (!account) {
      // Auto-register
      const username = (googleUser.name || googleUser.email.split("@")[0])
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, "_")
        .slice(0, 20);

      account = {
        id: id("acc"),
        username,
        email: googleUser.email.toLowerCase(),
        passwordHash: "",
        avatarColor: randomGreenShade(),
        role: "OPERATIVE",
        createdAt: new Date().toISOString(),
        provider: "google",
        googleId: googleUser.id
      };
      db.accounts.push(account);

      const userId = id("u");
      db.users.push({ id: userId, name: account.username, color: account.avatarColor });

      logActivity(db, `Operative "${account.username}" enlisted via GOOGLE`, {
        action: "created",
        userName: account.username
      });

      writeDb(db);
    }

    const token = createJWT({
      id: account.id,
      username: account.username,
      email: account.email,
      role: account.role
    });

    res.redirect(`/login.html?token=${token}&username=${encodeURIComponent(account.username)}`);
  } catch (err) {
    console.error("Google OAuth error:", err);
    res.redirect("/login.html?error=google_failed");
  }
});

// Verify token endpoint
app.get("/api/auth/me", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const payload = verifyJWT(authHeader.slice(7));
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  const pilotInfo = getRank(payload.xp || 0);
  res.json({
    id: payload.id,
    username: payload.username,
    email: payload.email,
    role: payload.role,
    xp: payload.xp || 0,
    ...pilotInfo
  });
});

/* ═══════════════════════════════════════════════════════
   CHATBOT AI ENDPOINT
   ═══════════════════════════════════════════════════════ */

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });

  const db = readDb();
  const userName = getActor(req, db);
  const today = new Date().toISOString().split("T")[0];

  // Build context of current user's projects & tasks
  const projectSummary = db.projects
    .filter(p => !p.owner || p.owner === userName)
    .map(p => {
      const tasks = (p.tasks || []).map(t => `  - "${t.title}" (status: ${t.status}, priority: ${t.priority || "medium"}, due: ${t.dueDate || "none"}, completed: ${t.completed})`).join("\n");
      return `PROJECT: "${p.title}" [id: ${p.id}, status: ${p.status}, deadline: ${p.deadline || "none"}]\n${tasks || "  - (no tasks)"}`;
    }).join("\n\n");

  if (!GROQ_API_KEY) {
    return res.status(200).json({ reply: null });
  }

  try {
    const systemPrompt = `You are NEXUS BOT, a retro military-style AI assistant for NEXUS PAM project management system.

PERSONALITY:
- Speak in short, punchy military-style sentences
- Use ALL CAPS for important info (project names, task names, dates)
- Keep responses to 2-3 lines max
- Be helpful and proactive

CURRENT DATE: ${today}
CURRENT YEAR: ${new Date().getFullYear()}

EXISTING PROJECTS & TASKS:
${projectSummary || "(no projects yet)"}

CRITICAL RULES FOR ACTIONS:
When the user wants to CREATE or ADD something, determine if they mean a PROJECT or a TASK.

PROJECT CREATION triggers:
- "create project [name]"
- "new project [name]"
- "start project [name]"
ACTION FORMAT:
{"action":{"type":"create_project","title":"PROJECT NAME","status":"active","deadline":"YYYY-MM-DD"}}

TASK CREATION triggers:
- "I have exam on 26/4"
- "add meeting tomorrow"
- "remind me to..."
- "create task [name]"
ACTION FORMAT: 
{"action":{"type":"create_task","title":"TASK NAME","projectId":"ID_OF_EXISTING_PROJECT","priority":"medium","dueDate":"YYYY-MM-DD"}}
* NOTE: If the user asks to create a task, you MUST pick an existing projectId from the list above. If NO projects exist, use action type "create_project" instead to initialize the system.

For dates:
- "26/4" or "26/04" means day/month, convert to YYYY-MM-DD format using current year (${new Date().getFullYear()})
- "tomorrow" means the day after ${today}
- "next week" means 7 days from ${today}
- If no date given, leave dueDate empty

Or to mark a task done:
{"action":{"type":"complete_task","taskId":"TASK_ID","projectId":"PROJECT_ID"}}

Or to delete a project:
{"action":{"type":"delete_project","projectId":"PROJECT_ID"}}

IMPORTANT: Always include the action JSON when the user wants to create/modify something. The JSON MUST BE VALID. Only ONE action per response.`;

    const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        max_tokens: 300,
        temperature: 0.6
      })
    });

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Extract JSON action from response
    let action = null;
    let actionResult = null;
    const jsonMatch = content.match(/\{\s*"action"\s*:\s*\{[^}]*\}\s*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        action = parsed.action;
      } catch {
        // Try a more lenient parse
        const lenientMatch = content.match(/\{[\s\S]*?"action"[\s\S]*?\}\s*\}/);
        if (lenientMatch) {
          try { action = JSON.parse(lenientMatch[0]).action; } catch {}
        }
      }
    }

    // AUTO-EXECUTE the action on the server
    if (action) {
      try {
        if (action.type === "create_task") {
          // Find the target project, or auto-create one if none exist
          let targetProjectId = action.projectId || (db.projects[0] && db.projects[0].id);
          
          // If no project found by the given ID, try first project
          if (targetProjectId && !db.projects.find(p => p.id === targetProjectId)) {
            targetProjectId = db.projects[0] && db.projects[0].id;
          }

          if (!targetProjectId || db.projects.filter(p => (!p.owner || p.owner === userName)).length === 0) {
            const autoProject = {
              id: id("p"),
              owner: userName,
              title: "MISSIONS",
              description: "Auto-created by NEXUS BOT",
              status: "active",
              deadline: "",
              createdAt: new Date().toISOString(),
              tasks: [],
              attachments: []
            };
            db.projects.unshift(autoProject);
            logActivity(db, `Project "MISSIONS" auto-created by NEXUS BOT`, {
              action: "created",
              projectId: autoProject.id,
              userName: "NEXUS BOT"
            });
            targetProjectId = autoProject.id;
          }

          const project = db.projects.find(p => p.id === targetProjectId);
          if (project) {
            const newTask = {
              id: id("t"),
              title: action.title || "Untitled Task",
              status: "todo",
              priority: action.priority || "medium",
              assignedUsers: [],
              dueDate: action.dueDate || "",
              notes: "Created by NEXUS BOT",
              completed: false,
              comments: [],
              createdAt: new Date().toISOString()
            };
            project.tasks.unshift(newTask);
            logActivity(db, `Task "${newTask.title}" added to "${project.title}" via NEXUS BOT`, {
              action: "created",
              projectId: targetProjectId,
              userName: "NEXUS BOT"
            });
            writeDb(db);
            actionResult = { success: true, type: "create_task", taskId: newTask.id, projectTitle: project.title };
          }
        } else if (action.type === "create_project") {
          const newProject = {
            id: id("p"),
            owner: userName,
            title: action.title || "Untitled Project",
            description: "",
            status: asProjectStatus(action.status || "active"),
            deadline: action.deadline || "",
            createdAt: new Date().toISOString(),
            tasks: [],
            attachments: []
          };
          db.projects.unshift(newProject);
          logActivity(db, `Project "${newProject.title}" created via NEXUS BOT`, {
            action: "created",
            projectId: newProject.id,
            userName: "NEXUS BOT"
          });
          writeDb(db);
          actionResult = { success: true, type: "create_project", projectId: newProject.id };
        } else if (action.type === "complete_task" && action.taskId && action.projectId) {
          const project = db.projects.find(p => p.id === action.projectId);
          if (project) {
            const task = (project.tasks || []).find(t => t.id === action.taskId);
            if (task) {
              task.completed = true;
              task.status = "done";
              logActivity(db, `Task "${task.title}" completed via NEXUS BOT`, {
                action: "edited",
                projectId: action.projectId,
                userName: "NEXUS BOT"
              });
              writeDb(db);
              actionResult = { success: true, type: "complete_task" };
            }
          }
        } else if (action.type === "delete_project" && action.projectId) {
          const idx = db.projects.findIndex(p => p.id === action.projectId);
          if (idx >= 0) {
            const [removed] = db.projects.splice(idx, 1);
            logActivity(db, `Project "${removed.title}" deleted via NEXUS BOT`, {
              action: "deleted",
              projectId: action.projectId,
              userName: "NEXUS BOT"
            });
            writeDb(db);
            actionResult = { success: true, type: "delete_project" };
          }
        }
      } catch (execErr) {
        console.error("Action execution error:", execErr);
        actionResult = { success: false, error: execErr.message };
      }
    }

    // Clean the reply text (remove JSON block)
    const reply = content.replace(/\{\s*"action"[\s\S]*?\}\s*\}/g, "").trim();
    return res.json({ reply: reply || content, action, actionResult });
  } catch (err) {
    console.error("Groq API error:", err);
    return res.status(200).json({ reply: "SYSTEM ERROR. AI CORE OFFLINE. USE MANUAL COMMANDS." });
  }
});

/* ═══════════════════════════════════════════════════════
   EXISTING API ROUTES (unchanged logic)
   ═══════════════════════════════════════════════════════ */

app.get("/api/meta", (req, res) => {
  const db = readDb();
  res.json({ users: db.users });
});

app.get("/api/projects", (req, res) => {
  const db = readDb();
  const userName = getActor(req, db);
  const q = String(req.query.q || "").toLowerCase();
  const status = String(req.query.status || "").toLowerCase();
  const priority = String(req.query.priority || "").toLowerCase();
  const sort = String(req.query.sort || "createdAt");
  
  // Filter by ownership and query params
  let projects = db.projects.filter((p) => {
    // If project is legacy (no owner), assign temporarily to logic
    if (p.owner && p.owner !== userName) return false;
    
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
    owner: userName,
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
    assignedUsers: Array.isArray(assignedUsers) ? assignedUsers : [],
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

app.get("/api/projects/:projectId/briefing", async (req, res) => {
  const { projectId } = req.params;
  const db = readDb();
  const userName = getActor(req, db);
  const project = db.projects.find((p) => p.id === projectId && (!p.owner || p.owner === userName));
  
  if (!project) return res.status(404).json({ error: "project not found" });

  if (!GROQ_API_KEY) {
    return res.json({ briefing: "[ COMMS OFFLINE ] Missing GROQ_API_KEY to connect to Command." });
  }

  const taskList = (project.tasks || []).map(t => `- [${(t.priority || "Normal").toUpperCase()}] ${t.title} (${t.status})`).join("\n");
  const prompt = `You are an onboard military AI generating a 'Commander's Briefing' for a space mission.
MISSION ALIAS: ${project.title}
OBJECTIVE: ${project.description || "Classified operations"}
STATUS: ${project.status}
CURRENT DEPLOYMENTS (TASKS):
${taskList || "No active deployments."}

Generate a 2-3 sentence intense, immersive Briefing summarizing the state of the mission. Do not use Markdown formatting or lists. Keep it entirely in raw text. Speak like a tactical officer giving a quick sitrep.`;

  try {
    const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150, temperature: 0.7
      })
    });
    const aiData = await aiRes.json();
    const briefing = aiData.choices?.[0]?.message?.content || "[ COMMS OFFLINE ] Unable to decrypt signal.";
    res.json({ briefing });
  } catch (err) {
    res.status(500).json({ error: "Internal Comm failure." });
  }
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
    const wasAlreadyDone = !!task.completed;
    task.completed = completed;
    if (completed) task.status = "done";
    
    // XP Reward for completing a new operation
    if (completed && !wasAlreadyDone) {
       const account = db.accounts.find(a => a.username === userName || a.id === userName);
       if (account) {
          const award = task.priority === "high" ? 50 : task.priority === "medium" ? 25 : 10;
          account.xp = (account.xp || 0) + award;
          logActivity(db, `Operative "${userName || 'Unknown'}" earned ${award} PX for MISSION "${task.title}"`, { action: "edited", projectId, userName: "SYSTEM" });
       }
    }
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

/* ═══════════════════════════════════════════════════════
   CATCH-ALL: Redirect unauthenticated to login
   ═══════════════════════════════════════════════════════ */

// Serve login as the landing page for root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// ════════════════════════════════════════════════════════
// TEAMS API
// ════════════════════════════════════════════════════════

app.get("/api/teams", (req, res) => {
  const db = readDb();
  const userName = getActor(req, db);
  // Return teams where user is member or owner
  const myTeams = db.teams.filter(t => t.owner === userName || (t.members || []).includes(userName));
  res.json(myTeams);
});

app.post("/api/teams", (req, res) => {
  const { name, description, color } = req.body;
  if (!name) return res.status(400).json({ error: "Team name required" });
  const db = readDb();
  const userName = getActor(req, db);
  const team = {
    id: id("team"),
    name, description: description || "",
    color: color || "#00ff41",
    owner: userName,
    members: [userName],
    projectIds: [],
    createdAt: new Date().toISOString()
  };
  db.teams.push(team);
  logActivity(db, `Team "${name}" created`, { action: "created", projectId: null, userName });
  writeDb(db);
  res.json(team);
});

app.put("/api/teams/:teamId", (req, res) => {
  const db = readDb();
  const userName = getActor(req, db);
  const team = db.teams.find(t => t.id === req.params.teamId);
  if (!team) return res.status(404).json({ error: "Team not found" });
  if (team.owner !== userName) return res.status(403).json({ error: "Not team owner" });
  const { name, description, color } = req.body;
  if (name) team.name = name;
  if (description !== undefined) team.description = description;
  if (color) team.color = color;
  writeDb(db);
  res.json(team);
});

app.delete("/api/teams/:teamId", (req, res) => {
  const db = readDb();
  const userName = getActor(req, db);
  const idx = db.teams.findIndex(t => t.id === req.params.teamId);
  if (idx === -1) return res.status(404).json({ error: "Team not found" });
  if (db.teams[idx].owner !== userName) return res.status(403).json({ error: "Not team owner" });
  db.teams.splice(idx, 1);
  writeDb(db);
  res.json({ ok: true });
});

app.post("/api/teams/:teamId/members", (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username required" });
  const db = readDb();
  const team = db.teams.find(t => t.id === req.params.teamId);
  if (!team) return res.status(404).json({ error: "Team not found" });
  if (!team.members.includes(username)) team.members.push(username);
  writeDb(db);
  res.json(team);
});

app.delete("/api/teams/:teamId/members/:username", (req, res) => {
  const db = readDb();
  const team = db.teams.find(t => t.id === req.params.teamId);
  if (!team) return res.status(404).json({ error: "Team not found" });
  team.members = team.members.filter(m => m !== req.params.username);
  writeDb(db);
  res.json(team);
});

app.post("/api/teams/:teamId/projects/:projectId", (req, res) => {
  const db = readDb();
  const team = db.teams.find(t => t.id === req.params.teamId);
  if (!team) return res.status(404).json({ error: "Team not found" });
  if (!team.projectIds.includes(req.params.projectId)) team.projectIds.push(req.params.projectId);
  writeDb(db);
  res.json(team);
});

// Project PIN endpoint
app.put("/api/projects/:projectId/pin", (req, res) => {
  const db = readDb();
  const project = db.projects.find(p => p.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Not found" });
  project.pinned = !project.pinned;
  writeDb(db);
  res.json({ pinned: project.pinned });
});

// Project COLOR endpoint
app.put("/api/projects/:projectId/color", (req, res) => {
  const { color } = req.body;
  const db = readDb();
  const project = db.projects.find(p => p.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Not found" });
  project.color = color || "#00ff41";
  writeDb(db);
  res.json({ color: project.color });
});

// Task COMMENT endpoint
app.post("/api/projects/:projectId/tasks/:taskId/comments", (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Comment text required" });
  const db = readDb();
  const userName = getActor(req, db);
  const project = db.projects.find(p => p.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: "Not found" });
  const task = project.tasks.find(t => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!task.comments) task.comments = [];
  const comment = { id: id("cmt"), text, user: userName, timestamp: new Date().toISOString() };
  task.comments.push(comment);
  writeDb(db);
  res.json(comment);
});

// ════════════════════════════════════════════════════════
// SQUAD COMMS
// ════════════════════════════════════════════════════════

app.get("/api/comms", (req, res) => {
  const db = readDb();
  res.json(db.messages.slice(-50));
});

app.post("/api/comms", (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "No signal detected." });
  const db = readDb();
  const userName = getActor(req, db);
  const msg = {
    id: id("msg"),
    text,
    user: userName,
    timestamp: new Date().toISOString()
  };
  db.messages.push(msg);
  if (db.messages.length > 100) db.messages = db.messages.slice(-100);
  writeDb(db);
  res.json(msg);
});

/* ═══════════════════════════════════════════════════════
   START SERVER
   ═══════════════════════════════════════════════════════ */

app.listen(PORT, () => {
  ensureDb();
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Google OAuth: ${GOOGLE_CLIENT_ID ? "CONFIGURED" : "NOT CONFIGURED (set GOOGLE_CLIENT_ID)"}`);
  console.log(`Groq AI: ${GROQ_API_KEY ? "CONFIGURED" : "NOT CONFIGURED (set GROQ_API_KEY)"}`);
});
