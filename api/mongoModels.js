const mongoose = require("mongoose");

const PageSchema = new mongoose.Schema({
    title: { type: String, required: true },
    title_normalized: { type: String, required: true },
    file_name: { type: String, required: true, unique: true },
    content: { type: String, required: true },
    updated_at: { type: Date, default: Date.now }
});

const TaskSchema = new mongoose.Schema({
    title: { type: String, required: true, unique: true },
    title_normalized: { type: String, required: true },
    phase: { type: String, default: "" },
    status: { type: String, default: "", index: true },
    type: { type: String, default: "" },
    difficulty: { type: String, default: "" },
    duration: { type: String, default: "" },
    resources: { type: String, default: "" },
    notes: { type: String, default: "" },
    page_id: { type: mongoose.Schema.Types.ObjectId, ref: "Page", default: null },
    updated_at: { type: Date, default: Date.now }
});

const Page = mongoose.model("Page", PageSchema);
const Task = mongoose.model("Task", TaskSchema);

module.exports = { Page, Task };