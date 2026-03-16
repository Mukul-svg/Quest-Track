const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
try { require("dotenv").config(); } catch (e) { } // Don't crash if dotenv fails

function getDb() {
    return require("./db");
}

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: "256kb" }));

app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});

app.get("/api/options", async (_req, res) => {
    try {
        const { getTasks } = getDb();
        const tasks = await getTasks();
        const uniqueVals = (field) => [...new Set(tasks.map(t => t[field]).filter(v => v))].sort();
        res.json({
            phases: uniqueVals("phase"),
            statuses: uniqueVals("status"),
            types: uniqueVals("type"),
            difficulties: uniqueVals("difficulty")
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/tasks", async (_req, res) => {
    try {
        const { getTasks } = getDb();
        const tasks = await getTasks();
        res.json(tasks);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.patch("/api/tasks/:id", async (req, res) => {
    try {
        const id = req.params.id;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: "Invalid task id" });
        }

        if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
            return res.status(400).json({ error: "Invalid request body" });
        }

        const { updateTask } = getDb();
        const updated = await updateTask(id, req.body || {});
        if (!updated) {
            return res.status(404).json({ error: "Task not found" });
        }
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/tasks/:id/page", async (req, res) => {
    try {
        const id = req.params.id;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: "Invalid task id" });
        }

        const { getTask, getPageFields } = getDb();
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
        if (!mongoose.isValidObjectId(pageId)) {
            return res.status(400).json({ error: "Invalid page id" });
        }
        if (!Number.isInteger(lineIndex) || lineIndex < 0) {
            return res.status(400).json({ error: "Invalid checklist line index" });
        }
        if (!req.body || typeof req.body.checked !== "boolean") {
            return res.status(400).json({ error: "checked must be a boolean" });
        }

        const checked = req.body.checked;

        const { toggleChecklistItem, getPageFields } = getDb();
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
    res.status(403).json({ error: "Sync is disabled in production" });
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
