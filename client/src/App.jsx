import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Alert, AppBar, Box, Button, Container, Toolbar, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { Link, Route, Routes } from "react-router-dom";
import { postJSON } from "./api/client";

const TablePage = lazy(() => import("./pages/TablePage"));
const TaskPage = lazy(() => import("./pages/TaskPage"));

function App() {
    const [syncState, setSyncState] = useState("idle");
    const [syncMessage, setSyncMessage] = useState("");
    const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
    const [refreshKey, setRefreshKey] = useState(0);
    const syncResetTimeoutRef = useRef(null);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            if (syncResetTimeoutRef.current) {
                window.clearTimeout(syncResetTimeoutRef.current);
            }
        };
    }, []);

    const handleSync = async () => {
        if (syncState === "loading") {
            return;
        }

        try {
            setSyncState("loading");
            setSyncMessage("");
            await postJSON("/api/sync");

            setSyncState("success");
            setSyncMessage("Tracker data is up to date.");
            setRefreshKey((prev) => prev + 1);
            if (syncResetTimeoutRef.current) {
                window.clearTimeout(syncResetTimeoutRef.current);
            }
            syncResetTimeoutRef.current = window.setTimeout(() => {
                setSyncState("idle");
                setSyncMessage("");
            }, 2400);
        } catch (err) {
            setSyncState("error");
            setSyncMessage(err.message || "We could not sync tracker data. Check your connection and try again.");
        }
    };

    return (
        <Box className="app-shell">
            <AppBar position="sticky" color="inherit" elevation={1}>
                <Toolbar className="topbar">
                    <Typography variant="h6" component={Link} to="/" className="brand-link">
                        Quest Chronicle
                    </Typography>
                    <Button
                        startIcon={<RefreshIcon className={syncState === "loading" ? "sync-icon-spin" : ""} />}
                        variant="contained"
                        color="primary"
                        size="medium"
                        onClick={handleSync}
                        disabled={syncState === "loading"}
                    >
                        {syncState === "loading" ? "Inking latest chapter..." : "Sync Story Arc"}
                    </Button>
                </Toolbar>
            </AppBar>

            <Container component="main" maxWidth={false} disableGutters className="main-wrap">
                {isOffline && (
                    <Alert severity="warning" className="status-alert" sx={{ mb: 2 }} role="alert" aria-live="assertive">
                        You are offline. Some actions are unavailable until your connection is restored.
                    </Alert>
                )}
                {syncState === "success" && (
                    <Alert severity="success" className="status-alert" sx={{ mb: 2 }} role="status" aria-live="polite">
                        {syncMessage}
                    </Alert>
                )}
                {syncState === "error" && (
                    <Alert severity="error" className="status-alert" sx={{ mb: 2 }} role="alert" aria-live="assertive">
                        {syncMessage}
                    </Alert>
                )}

                <Suspense fallback={<Alert severity="info" className="status-alert" role="status" aria-live="polite">Loading page...</Alert>}>
                    <Routes key={refreshKey}>
                        <Route path="/" element={<TablePage />} />
                        <Route path="/task/:taskId" element={<TaskPage />} />
                    </Routes>
                </Suspense>
            </Container>
        </Box>
    );
}

export default App;
