# NEXUS Tactical PAM (Project Management)

![NEXUS PLATFORM](/public/nexus_logo.png) <!-- Assuming a logo exists or just placeholder -->

**NEXUS** is a high-fidelity, retro-terminal inspired Project Management System designed for tactical operatives and high-performance teams. It combines the immersive aesthetic of a mission control HUD with the power of modern productivity workflows.

---

## 🛰️ Mission Core Features

### 📊 Tactical Dashboard
*   **Operational Metrics:** Real-time visualization of mission counts, active operations, and hull damage (overdue tasks).
*   **XP & Ranking System:** Gamified progression from **CADET** to **FLEET ADMIRAL** based on completed objectives.
*   **Mission Status HUD:** Dynamic progress bars tracking **Frontline** (In Progress), **Logistics** (Todo), and **Complete** sectors.
*   **Combat Log:** A unified activity stream tracking every tactical shift across all sectors.

### 🗃️ Mission Boards (Kanban V2)
*   **Glassmorphic Mission Cards:** Clean, frosted-glass interface for managing project lifecycles.
*   **Objective Management:** Add, delete, and prioritize tasks with a sleek, centered layout.
*   **Project Templates:** Quick-deploy standard operating procedures from saved templates.

### 🤖 NEXUS BOT (AI Assistant)
*   **Natural Language Protocol (NLP):** Log missions orally—e.g., *"Quantum project due 29 April"*—and the bot will autonomously initialize the board.
*   **Tactical Fallbacks:** Built-in backend NLP ensures the bot executes commands even when the AI core is offline.
*   **Actionable Intelligence:** Automated task creation, deletion, and status updates via conversational interface.

### 👥 Squad Management
*   **Squad Formation:** Create and deploy cooperative units with custom mission objectives.
*   **Pilot Collaboration:** Invite teammates and assign roles within the tactical system.

### 📅 Tactical Visualization
*   **Tactical Gantt:** Visualize operational timelines on a high-fidelity timeline.
*   **Mission Calendar:** Stay ahead of deadlines with a synchronized mission schedule.

---

## 🛠️ Technical Architecture

### Core Stack
- **Backend:** Node.js + Express
- **Frontend:** Vanilla JavaScript (ES6+)
- **Storage:** JSON-based Tactical Database (`db.json`)
- **Styling:** Vanilla CSS (Glassmorphism & CSS Variables)
- **AI Core:** Groq Llama 3 API (with local NLP fallback)

### Design System: Glass-Tech HUD
- **Palette:** Emerald & Zinc (Muted tactical theme to reduce eye strain).
- **Typography:** 
    - **Headers:** *'Press Start 2P'* (Retro Identity)
    - **Body/Logs:** *'VT323'* (High-Legibility Terminal)
- **Aesthetic:** High-retention glassmorphism with backdrop blurring, subtle glowing borders, and micro-animations.

### Identity & Security
- **JWT Authorization:** Secure token-based identity persistence.
- **Identity Syncing:** The `getActor` protocol correctly attributes actions across Chat, Boards, and API calls.

---

## ⚡ Quick Start

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Set `GROQ_API_KEY` in your environment variables for AI bot functionality.

3. **Deploy Locally:**
   ```bash
   npm start
   ```
   Access the command center at `http://localhost:3000`.

---

## 🔒 Security Directives
- User data is securely hashed before storage.
- All tactical actions require a valid session token.
- Confirmation protocols enforced for high-risk mission deletions.

**NEXUS PAM — Evolving the future of tactical coordination.**
