import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { Link, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import { getJSON, patchJSON } from "../api/client";

const toText = (value, fallback = "-") => {
    if (value === null || value === undefined || value === "") {
        return fallback;
    }
    return String(value);
};

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();

const metadataLabels = ["phase:", "status:", "type:", "duration:", "resources:", "notes:", "difficulty:"];

const shouldStripMetaBlock = (text, taskTitle) => {
    const normalized = normalizeText(text);
    if (!normalized) {
        return false;
    }

    const labelHits = metadataLabels.reduce((count, label) => (normalized.includes(label) ? count + 1 : count), 0);
    const normalizedTitle = normalizeText(taskTitle);

    if (labelHits >= 3) {
        return true;
    }

    if (normalizedTitle && normalized === normalizedTitle) {
        return true;
    }

    return Boolean(normalizedTitle && normalized.startsWith(normalizedTitle) && labelHits >= 2);
};

const stripTaskMetaFromHtml = (html, taskTitle) => {
    if (!html || typeof document === "undefined") {
        return html;
    }

    const container = document.createElement("div");
    container.innerHTML = html;

    container.querySelectorAll("p, li").forEach((node) => {
        if (shouldStripMetaBlock(node.textContent, taskTitle)) {
            node.remove();
        }
    });

    container.querySelectorAll("p").forEach((node) => {
        if (!node.textContent?.trim()) {
            node.remove();
        }
    });

    return container.innerHTML;
};

const getMetaToneClass = (label, value) => {
    const text = String(value || "").toLowerCase();

    if (label !== "Status") {
        return "quest-meta-value--accent";
    }

    if (!text || text === "-") {
        return "quest-meta-value--neutral";
    }
    if (text.includes("done") || text.includes("complete") || text.includes("closed")) {
        return "quest-meta-value--success";
    }
    if (text.includes("progress") || text.includes("active") || text.includes("working")) {
        return "quest-meta-value--info";
    }
    if (text.includes("blocked") || text.includes("risk") || text.includes("stuck")) {
        return "quest-meta-value--danger";
    }
    if (text.includes("hold") || text.includes("wait") || text.includes("pending") || text.includes("todo")) {
        return "quest-meta-value--warning";
    }

    return "quest-meta-value--accent";
};

function TaskPage() {
    const { taskId } = useParams();
    const [task, setTask] = useState(null);
    const [page, setPage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [savingLine, setSavingLine] = useState(null);
    const markdownRef = useRef(null);
    const loadAbortRef = useRef(null);
    const loadRequestRef = useRef(0);

    const load = useCallback(async (signal) => {
        const requestId = ++loadRequestRef.current;

        try {
            setLoading(true);
            setError("");
            const data = await getJSON(`/api/tasks/${taskId}/page`, { signal });

            if (signal?.aborted || requestId !== loadRequestRef.current) {
                return;
            }

            if (!data?.task || !data?.page) {
                throw new Error("Task details are incomplete. Please try again.");
            }

            setTask(data.task);
            setPage({
                ...data.page,
                checklist: Array.isArray(data.page.checklist) ? data.page.checklist : [],
            });
        } catch (err) {
            if (err.message === "Request cancelled.") {
                return;
            }

            if (requestId === loadRequestRef.current) {
                setError(err.message || "We could not load task details. Please try again.");
            }
        } finally {
            if (!signal?.aborted && requestId === loadRequestRef.current) {
                setLoading(false);
            }
        }
    }, [taskId]);

    useEffect(() => {
        const controller = new AbortController();
        loadAbortRef.current = controller;
        load(controller.signal);

        return () => {
            controller.abort();
            if (loadAbortRef.current === controller) {
                loadAbortRef.current = null;
            }
        };
    }, [load]);

    const retryLoad = () => {
        if (loadAbortRef.current) {
            loadAbortRef.current.abort();
        }

        const controller = new AbortController();
        loadAbortRef.current = controller;
        load(controller.signal);
    };

    const onToggle = async (lineIndex, checked) => {
        if (!page?.id) {
            return false;
        }

        if (savingLine !== null && savingLine !== lineIndex) {
            return false;
        }

        try {
            setSavingLine(lineIndex);
            const updatedPage = await patchJSON(`/api/pages/${page.id}/checklist/${lineIndex}`, { checked });
            setPage(updatedPage);
            return true;
        } catch (err) {
            if (err.message === "Request cancelled.") {
                return false;
            }
            setError(err.message);
            return false;
        } finally {
            setSavingLine(null);
        }
    };

    const sanitizedHtml = useMemo(() => {
        if (!page?.html) {
            return "";
        }

        const cleanHtml = DOMPurify.sanitize(page.html, { USE_PROFILES: { html: true } });
        return stripTaskMetaFromHtml(cleanHtml, task?.title);
    }, [page?.html, task?.title]);

    const metaItems = useMemo(
        () => [
            { label: "Phase", value: toText(task?.phase) },
            { label: "Status", value: toText(task?.status) },
            { label: "Type", value: toText(task?.type) },
            { label: "Duration", value: toText(task?.duration) },
        ],
        [task?.duration, task?.phase, task?.status, task?.type]
    );

    useEffect(() => {
        if (!page || !markdownRef.current) {
            return;
        }

        const root = markdownRef.current;
        const boxes = Array.from(root.querySelectorAll('input[type="checkbox"]'));
        boxes.forEach((box, index) => {
            const item = page.checklist?.[index];
            if (!item) {
                box.disabled = true;
                box.setAttribute("title", "Checklist item is not mapped");
                return;
            }

            box.disabled = false;
            box.checked = item.checked;
            box.style.cursor = "pointer";
            box.dataset.lineIndex = String(item.lineIndex);
        });

        const handleCheckboxChange = async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") {
                return;
            }

            const lineIndex = Number(target.dataset.lineIndex);
            if (!Number.isFinite(lineIndex)) {
                target.checked = !target.checked;
                return;
            }

            const next = target.checked;
            target.disabled = true;
            const ok = await onToggle(lineIndex, next);
            if (!ok) {
                target.checked = !next;
            }
            target.disabled = false;
        };

        root.addEventListener("change", handleCheckboxChange);

        return () => {
            root.removeEventListener("change", handleCheckboxChange);
        };
    }, [page]);

    if (loading) {
        return (
            <Stack className="centered" spacing={2}>
                <CircularProgress />
                <Typography>Loading task details...</Typography>
            </Stack>
        );
    }

    if (error) {
        return (
            <Paper className="panel">
                <Stack spacing={1.5}>
                    <Alert severity="error" role="alert" aria-live="assertive">
                        {error}
                    </Alert>
                    <Box>
                        <Button variant="outlined" onClick={retryLoad} disabled={loading || savingLine !== null}>
                            Try again
                        </Button>
                    </Box>
                </Stack>
            </Paper>
        );
    }

    if (!task || !page) {
        return (
            <Paper className="panel">
                <Stack spacing={1.5}>
                    <Typography variant="h5">This task page is not available</Typography>
                    <Typography color="text.secondary">
                        We could not load the linked content right now. Please try again.
                    </Typography>
                    <Box>
                        <Button variant="outlined" onClick={retryLoad} disabled={loading || savingLine !== null}>
                            Try again
                        </Button>
                    </Box>
                </Stack>
            </Paper>
        );
    }

    return (
        <Box>
            {savingLine !== null && (
                <Alert severity="info" className="status-alert" sx={{ mb: 2 }} role="status" aria-live="polite">
                    Saving your checklist change...
                </Alert>
            )}

            <Typography variant="h4" className="page-title reveal-seq reveal-1 bidi-safe" dir="auto">
                {task.title}
            </Typography>
            <Typography color="text.secondary" className="page-subtitle reveal-seq reveal-2 bidi-safe" dir="auto">
                Linked page: {page.title}
            </Typography>

            <Box className="quest-meta-grid reveal-seq reveal-3" role="group" aria-label="Task metadata">
                {metaItems.map((item) => (
                    <Box key={item.label} className="quest-meta-card">
                        <Typography component="p" className="quest-meta-label">
                            {item.label}
                        </Typography>
                        <Typography component="p" className={`quest-meta-value ${getMetaToneClass(item.label, item.value)}`} dir="auto">
                            {item.value}
                        </Typography>
                    </Box>
                ))}
            </Box>

            <Box sx={{ mb: 2 }} className="reveal-seq reveal-3">
                <Button component={Link} to="/" variant="outlined">
                    Back to mission board
                </Button>
            </Box>

            <Paper className="panel markdown-panel reveal-seq reveal-3">
                <Typography variant="h6">Quest Script (tick checklist beats below)</Typography>
                <div ref={markdownRef} className="markdown-content" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
            </Paper>
        </Box>
    );
}

export default TaskPage;
