const express = require("express");
const cors = require("cors");
const {
    connectDB,
    getTasks,
    getTask,
    updateTask,
    getPageFields,
    toggleChecklistItem,
    importPages,
    importTasks,
    linkTasksToPages,
} = require("./db");
try { require("dotenv").config(); } catch (e) { } // Don't crash if dotenv fails

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Ensure DB connection is established before processing any request
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        res.status(500).json({ error: "Database connection failed", details: err.message });
    }
});

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});

app.get("/api/options", async (_req, res) => {
    // Generate default select options for the frontend based on all possible tasks in MongoDB
    const tasks = await getTasks();
    const uniqueVals = (field) => [...new Set(tasks.map(t => t[field]).filter(v => v))].sort();
    res.json({
        phases: uniqueVals("phase"),
        statuses: uniqueVals("status"),
        types: uniqueVals("type"),
        difficulties: uniqueVals("difficulty")
    });
});

app.get("/api/tasks", async (_req, res) => {
    try {
        const tasks = await getTasks();
        res.json(tasks);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.patch("/api/tasks/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const updated = await updateTask(id, req.body || {});
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/tasks/:id/page", async (req, res) => {
    try {
        const id = req.params.id;
        const task = await getTask(id);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        if (!task.page_id) {
            return res.status(404).json({ message: "No linked page found for this task", task });
        }

        const page = await getPageFields(task.page_id);
        return res.json({ task, page });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.patch("/api/pages/:id/checklist/:lineIndex", async (req, res) => {
    try {
        const pageId = req.params.id;
        const lineIndex = Number(req.params.lineIndex);
        const checked = Boolean(req.body.checked);

        const content = await toggleChecklistItem(pageId, lineIndex, checked);
        if (!content) {
            return res.status(404).json({ message: "Checklist item not found" });
        }

        const page = await getPageFields(pageId);
        return res.json(page);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/sync", async (_req, res) => {
    try {
        await importPages();
        await importTasks();
        await linkTasksToPages();

        const tasksCount = (await getTasks()).length;
        return res.json({ ok: true, synced: true, counts: { tasks: tasksCount } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Remove static file serving - Vercel handles this perfectly via its CDN natively!

// Export for Vercel Serverless
module.exports = app;

// Only listen when running directly in local development.
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`API server running on http://localhost:${PORT}`);
    });
}
