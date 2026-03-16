const mongoose = require("mongoose");
const { marked } = require("marked");
const { Page, Task } = require("./mongoModels");

let connectPromise = null;

// Ensure you call connectDB before using database operations anywhere
async function connectDB() {
    if (mongoose.connection.readyState >= 1) return;
    if (connectPromise) return connectPromise;

    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI environment variable is missing");
        }

        connectPromise = mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        });

        await connectPromise;
        console.log("✅ Main app connected to MongoDB");
    } catch (err) {
        console.error("❌ MongoDB connection error:", err);
        connectPromise = null;
        throw err;
    }
}

function normalize(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function detectCsvPath() { return null; }
function detectPagesDir() { return null; }

async function getTasks() {
    await connectDB();
    const tasks = await Task.find({})
        .populate("page_id")
        .sort({ phase: 1, title: 1 })
        .lean();

    return tasks.map(t => {
        t.id = t._id.toString();
        if (t.page_id) {
            t.linked_page_id = t.page_id._id.toString();
            t.linked_page_title = t.page_id.title;
            t.page_id = t.page_id._id.toString();
        }
        return t;
    });
}

async function updateTask(id, updates) {
    await connectDB();
    updates.updated_at = new Date();
    const doc = await Task.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
    if (doc) doc.id = doc._id.toString();
    return doc;
}

async function getTask(id) {
    await connectDB();
    const doc = await Task.findById(id).populate("page_id").lean();
    if (doc) {
        doc.id = doc._id.toString();
        if (doc.page_id) {
            doc.linked_page_id = doc.page_id._id.toString();
            doc.linked_page_title = doc.page_id.title;
            doc.page_id = doc.page_id._id.toString();
        }
    }
    return doc;
}

async function getPageFields(pageId) {
    await connectDB();
    const doc = await Page.findById(pageId).lean();
    if (doc) {
        doc.id = doc._id.toString();
        const renderContent = normalizeMarkdownForRendering(doc.content || "");
        doc.html = marked.parse(renderContent);
        doc.checklist = extractChecklist(doc.content);
    }
    return doc || null;
}

async function importPages() {
    await connectDB();
    const pagesDir = detectPagesDir();
    if (!pagesDir) {
        return { upserted: 0 };
    }

    const files = fs.readdirSync(pagesDir).filter((name) => name.endsWith(".md"));
    let upserted = 0;
    for (const fileName of files) {
        const full = path.join(pagesDir, fileName);
        const content = fs.readFileSync(full, "utf8");
        const first = (content.split(/\r?\n/)[0] || "").trim();
        const title = first.startsWith("# ") ? first.slice(2).trim() : fileName;

        await Page.findOneAndUpdate(
            { file_name: fileName },
            {
                $set: {
                    title,
                    title_normalized: normalize(title),
                    content,
                    updated_at: new Date()
                }
            },
            { upsert: true }
        );
        upserted++;
    }
    return { upserted };
}

async function importTasks() {
    if (!parse) throw new Error("CSV parsing is not supported on this Serverless runtime. Data must be imported locally.");

    await connectDB();
    const csvPath = detectCsvPath();
    if (!csvPath) {
        return { imported: 0 };
    }

    const content = fs.readFileSync(csvPath, "utf8");
    const rows = parse(content, { columns: true, trim: true, skip_empty_lines: true, bom: true });

    let imported = 0;
    for (const row of rows) {
        const title = String(row.Task || "").trim();
        if (!title) continue;

        await Task.findOneAndUpdate(
            { title: title },
            {
                $set: {
                    title_normalized: normalize(title),
                    phase: String(row.Phase || "").trim(),
                    status: String(row.Status || "").trim(),
                    type: String(row.Type || "").trim(),
                    difficulty: String(row.Difficulty || "").trim(),
                    duration: String(row.Duration || "").trim(),
                    resources: String(row.Resources || "").trim(),
                    notes: String(row.Notes || "").trim(),
                    updated_at: new Date()
                }
            },
            { upsert: true }
        );
        imported++;
    }
    return { imported };
}

async function linkTasksToPages() {
    await connectDB();
    const tasks = await Task.find({});
    const pages = await Page.find({});

    for (const task of tasks) {
        const exact = pages.find((p) => p.title_normalized === task.title_normalized);
        const loose = pages.find(
            (p) =>
                p.title_normalized.includes(task.title_normalized) ||
                task.title_normalized.includes(p.title_normalized)
        );
        const page = exact || loose;
        if (page) {
            task.page_id = page._id;
            await task.save();
        }
    }
}

function extractChecklist(content) {
    const lines = String(content || "").split(/\r?\n/);
    const items = [];
    lines.forEach((line, index) => {
        const m = line.match(/^(\s*[-*]\s\[( |x|X)\]\s)(.*)$/);
        if (m) {
            items.push({ lineIndex: index, checked: m[2].toLowerCase() === "x", text: m[3] });
        }
    });
    return items;
}

function normalizeMarkdownForRendering(content) {
    const source = String(content || "");
    return source.replace(/(^|\n)(Bash|Shell|CLI)\s*\n\s*`([\s\S]*?)`\s*(?=\n|$)/gi, (_match, leading, label, code) => {
        const cleanedCode = String(code || "").replace(/^\n+|\n+$/g, "");
        return `${leading}${label}\n\n\`\`\`bash\n${cleanedCode}\n\`\`\`\n`;
    });
}

async function toggleChecklistItem(pageId, lineIndex, checked) {
    await connectDB();
    const page = await Page.findById(pageId);
    if (!page) {
        return null;
    }
    const lines = page.content.split(/\r?\n/);
    if (lineIndex >= 0 && lineIndex < lines.length) {
        const m = lines[lineIndex].match(/^(\s*[-*]\s\[)( |x|X)(\]\s.*)$/);
        if (m) {
            lines[lineIndex] = m[1] + (checked ? "x" : " ") + m[3];
            page.content = lines.join("\n");
            page.updated_at = new Date();
            await page.save();
            return {
                html: marked.parse(normalizeMarkdownForRendering(page.content)),
                checklist: extractChecklist(page.content),
            };
        }
    }
    return null;
}

module.exports = {
    connectDB,
    getTasks,
    updateTask,
    getTask,
    getPageFields,
    importPages,
    importTasks,
    linkTasksToPages,
    toggleChecklistItem,
};
