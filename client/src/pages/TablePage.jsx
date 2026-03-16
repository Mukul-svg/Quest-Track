import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { Link } from "react-router-dom";
import { getJSON, patchJSON } from "../api/client";

const DataGrid = lazy(() => import("@mui/x-data-grid").then((module) => ({ default: module.DataGrid })));

const toOptionArray = (value) => (Array.isArray(value) ? value : []);

const toRowArray = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((row) => row && row.id !== undefined && row.id !== null);
};

const getCellText = (value) => {
    if (value === null || value === undefined || value === "") {
        return "-";
    }
    return String(value);
};

function TablePage() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));

    const [rows, setRows] = useState([]);
    const [options, setOptions] = useState({ status: [], phase: [], type: [], difficulty: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [savingRowId, setSavingRowId] = useState(null);
    const loadAbortRef = useRef(null);
    const loadRequestRef = useRef(0);

    const getStatusChipSx = useCallback((value) => {
        const text = String(value || "").toLowerCase();

        if (!text || text === "-") {
            return {
                bgcolor: "var(--chip-neutral-bg)",
                color: "var(--chip-neutral-fg)",
            };
        }

        if (text.includes("done") || text.includes("complete") || text.includes("closed")) {
            return {
                bgcolor: "var(--chip-success-bg)",
                color: "var(--chip-success-fg)",
            };
        }

        if (text.includes("progress") || text.includes("active") || text.includes("working")) {
            return {
                bgcolor: "var(--chip-info-bg)",
                color: "var(--chip-info-fg)",
            };
        }

        if (text.includes("blocked") || text.includes("risk") || text.includes("stuck")) {
            return {
                bgcolor: "var(--chip-danger-bg)",
                color: "var(--chip-danger-fg)",
            };
        }

        if (text.includes("hold") || text.includes("wait") || text.includes("pending") || text.includes("todo")) {
            return {
                bgcolor: "var(--chip-warning-bg)",
                color: "var(--chip-warning-fg)",
            };
        }

        return {
            bgcolor: "var(--chip-accent-bg)",
            color: "var(--chip-accent-fg)",
        };
    }, []);

    const load = useCallback(async (signal) => {
        const requestId = ++loadRequestRef.current;

        try {
            setLoading(true);
            setError("");
            const [taskRows, selectOptions] = await Promise.all([
                getJSON("/api/tasks", { signal }),
                getJSON("/api/options", { signal }),
            ]);

            if (signal?.aborted || requestId !== loadRequestRef.current) {
                return;
            }

            setRows(toRowArray(taskRows));
            setOptions({
                status: toOptionArray(selectOptions?.status),
                phase: toOptionArray(selectOptions?.phase),
                type: toOptionArray(selectOptions?.type),
                difficulty: toOptionArray(selectOptions?.difficulty),
            });
        } catch (err) {
            if (err.message === "Request cancelled.") {
                return;
            }

            if (requestId === loadRequestRef.current) {
                setError(err.message || "We could not load your tasks. Please try again.");
            }
        } finally {
            if (!signal?.aborted && requestId === loadRequestRef.current) {
                setLoading(false);
            }
        }
    }, []);

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

    const processRowUpdate = async (newRow, oldRow) => {
        if (savingRowId !== null) {
            return oldRow;
        }

        const changed = {};
        ["title", "phase", "status", "type", "difficulty", "duration", "resources", "notes"].forEach((key) => {
            if (newRow[key] !== oldRow[key]) {
                changed[key] = newRow[key];
            }
        });

        if (Object.keys(changed).length === 0) {
            return oldRow;
        }

        try {
            setSavingRowId(newRow.id);
            const updated = await patchJSON(`/api/tasks/${newRow.id}`, changed);
            setRows((prev) => prev.map((row) => (row.id === newRow.id ? updated : row)));
            return updated;
        } catch (err) {
            setError(err.message || "We could not save that row. Please try again.");
            return oldRow;
        } finally {
            setSavingRowId(null);
        }
    };

    const columns = useMemo(
        () => [
            {
                field: "title",
                headerName: "Task",
                flex: 1.6,
                minWidth: isMobile ? 260 : 320,
                editable: true,
                renderCell: (params) => (
                    <Link
                        className="task-link cell-text-truncate bidi-safe"
                        to={`/task/${params.row.id}`}
                        title={getCellText(params.value)}
                        dir="auto"
                    >
                        {getCellText(params.value)}
                    </Link>
                ),
            },
            {
                field: "status",
                headerName: "Status",
                type: "singleSelect",
                editable: true,
                valueOptions: options.status,
                minWidth: isMobile ? 132 : 150,
                renderCell: (params) => (
                    <Chip
                        size="small"
                        label={getCellText(params.value)}
                        sx={{
                            borderRadius: "999px",
                            fontWeight: 600,
                            border: "1px solid var(--chip-border)",
                            ...getStatusChipSx(params.value),
                        }}
                    />
                ),
            },
            {
                field: "phase",
                headerName: "Phase",
                type: "singleSelect",
                editable: true,
                valueOptions: options.phase,
                minWidth: isMobile ? 190 : 230,
            },
            {
                field: "type",
                headerName: "Type",
                type: "singleSelect",
                editable: true,
                valueOptions: options.type,
                minWidth: isMobile ? 120 : 140,
            },
            {
                field: "difficulty",
                headerName: "Difficulty",
                type: "singleSelect",
                editable: true,
                valueOptions: options.difficulty,
                minWidth: isMobile ? 126 : 140,
            },
            {
                field: "duration",
                headerName: "Duration",
                editable: true,
                minWidth: isMobile ? 124 : 140,
                renderCell: (params) => (
                    <span className="cell-text-truncate bidi-safe" title={getCellText(params.value)} dir="auto">
                        {getCellText(params.value)}
                    </span>
                ),
            },
            {
                field: "resources",
                headerName: "Resources",
                editable: true,
                flex: 1.2,
                minWidth: isMobile ? 220 : 260,
                renderCell: (params) => (
                    <span className="cell-text-truncate bidi-safe" title={getCellText(params.value)} dir="auto">
                        {getCellText(params.value)}
                    </span>
                ),
            },
            {
                field: "notes",
                headerName: "Notes",
                editable: true,
                flex: 1.2,
                minWidth: isMobile ? 220 : 260,
                renderCell: (params) => (
                    <span className="cell-text-truncate bidi-safe" title={getCellText(params.value)} dir="auto">
                        {getCellText(params.value)}
                    </span>
                ),
            },
        ],
        [getStatusChipSx, isMobile, options]
    );

    if (loading) {
        return (
            <Stack className="centered" spacing={2}>
                <CircularProgress />
                <Typography>Loading your tasks...</Typography>
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
                        <Button variant="outlined" onClick={retryLoad} disabled={loading || savingRowId !== null}>
                            Try again
                        </Button>
                    </Box>
                </Stack>
            </Paper>
        );
    }

    if (!rows.length) {
        return (
            <Paper className="panel">
                <Stack spacing={1.5}>
                    <Typography variant="h5">No tasks yet</Typography>
                    <Typography color="text.secondary">
                        Sync tracker data to import tasks from your source files.
                    </Typography>
                    <Box>
                        <Button variant="outlined" onClick={retryLoad} disabled={loading || savingRowId !== null}>
                            Reload tasks
                        </Button>
                    </Box>
                </Stack>
            </Paper>
        );
    }

    return (
        <Box>
            {savingRowId !== null && (
                <Alert severity="info" className="status-alert" sx={{ mb: 2 }} role="status" aria-live="polite">
                    Saving row updates...
                </Alert>
            )}
            <Typography variant="h4" className="page-title reveal-seq reveal-1">
                Mission Board
            </Typography>
            <Typography color="text.secondary" className="page-subtitle reveal-seq reveal-2">
                Tune mission cards directly, then jump into a quest page to check off progress beats.
            </Typography>
            {isMobile && (
                <Typography className="mobile-grid-hint reveal-seq reveal-2" color="text.secondary">
                    Swipe sideways to reveal every mission stat.
                </Typography>
            )}

            <Paper className="panel table-panel reveal-seq reveal-3">
                <Suspense
                    fallback={
                        <Stack className="centered" spacing={1.5}>
                            <CircularProgress size={30} />
                            <Typography color="text.secondary">Loading table...</Typography>
                        </Stack>
                    }
                >
                    <DataGrid
                        rows={rows}
                        columns={columns}
                        editMode="row"
                        processRowUpdate={processRowUpdate}
                        onProcessRowUpdateError={(err) => setError(err.message)}
                        pageSizeOptions={isMobile ? [10, 25] : [10, 25, 50]}
                        initialState={{ pagination: { paginationModel: { pageSize: isMobile ? 10 : 25, page: 0 } } }}
                        disableRowSelectionOnClick
                        getRowHeight={() => (isMobile ? 64 : isTablet ? 60 : 56)}
                        sx={{
                            border: "none",
                            color: "var(--grid-text)",
                            "--DataGrid-containerBackground": "var(--grid-surface)",
                            "--DataGrid-rowBorderColor": "var(--grid-line)",
                            "--DataGrid-pinnedBackground": "var(--grid-surface-strong)",
                            "--DataGrid-headerBackground": "var(--grid-surface-strong)",
                            "& .MuiDataGrid-columnHeaderTitle": {
                                fontSize: isMobile ? "0.78rem" : "0.84rem",
                                fontWeight: 700,
                            },
                            "& .MuiDataGrid-columnHeaders": {
                                borderBottomColor: "var(--grid-line)",
                            },
                            "& .MuiDataGrid-cell": {
                                py: isMobile ? 0.5 : 0,
                                borderColor: "var(--grid-line)",
                            },
                            "& .MuiDataGrid-row:hover": {
                                backgroundColor: "var(--grid-hover)",
                            },
                            "& .MuiDataGrid-footerContainer": {
                                borderTopColor: "var(--grid-line)",
                            },
                        }}
                    />
                </Suspense>
            </Paper>
        </Box>
    );
}

export default TablePage;
