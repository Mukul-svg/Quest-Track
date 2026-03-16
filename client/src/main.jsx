import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import App from "./App";
import "./styles.css";

const designTokens = {
    color: {
        primary: "#e4552f",
        secondary: "#1f8f8a",
        bg: "#f7efe0",
        paper: "#fff9ee",
        ink: "#201912",
        line: "#2f261d",
    },
    radius: {
        base: 14,
        panel: 18,
    },
};

const theme = createTheme({
    palette: {
        mode: "light",
        primary: { main: designTokens.color.primary },
        secondary: { main: designTokens.color.secondary },
        text: {
            primary: designTokens.color.ink,
        },
        background: {
            default: designTokens.color.bg,
            paper: designTokens.color.paper,
        },
    },
    shape: { borderRadius: designTokens.radius.base },
    typography: {
        fontFamily: '"Nunito", "Segoe UI", sans-serif',
        h4: {
            fontFamily: '"Bangers", "Nunito", "Segoe UI", sans-serif',
            fontWeight: 400,
            letterSpacing: "0.04em",
        },
        h5: {
            fontFamily: '"Bangers", "Nunito", "Segoe UI", sans-serif',
            fontWeight: 400,
            letterSpacing: "0.035em",
        },
        h6: {
            fontFamily: '"Bangers", "Nunito", "Segoe UI", sans-serif',
            fontWeight: 400,
            letterSpacing: "0.03em",
        },
        body1: {
            lineHeight: 1.55,
        },
        body2: {
            lineHeight: 1.5,
        },
    },
    components: {
        MuiButton: {
            defaultProps: {
                size: "medium",
            },
            styleOverrides: {
                root: {
                    textTransform: "none",
                    fontWeight: 800,
                    minHeight: 44,
                    paddingInline: 16,
                    borderRadius: 999,
                    borderWidth: 2,
                    borderStyle: "solid",
                    borderColor: designTokens.color.line,
                    boxShadow: "3px 3px 0 rgba(47, 38, 29, 0.75)",
                    transition: "background-color 180ms ease, border-color 180ms ease, color 180ms ease",
                    "&:focus-visible": {
                        outline: `3px solid color-mix(in srgb, ${designTokens.color.primary} 62%, white 38%)`,
                        outlineOffset: 2,
                    },
                },
            },
        },
        MuiAlert: {
            styleOverrides: {
                root: {
                    borderRadius: designTokens.radius.base,
                    border: `2px solid ${designTokens.color.line}`,
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: designTokens.radius.panel,
                    border: `2px solid ${designTokens.color.line}`,
                },
            },
        },
    },
});

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </ThemeProvider>
    </React.StrictMode>
);
