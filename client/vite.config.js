import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    root: path.resolve(__dirname),
    server: {
        port: 5173,
        proxy: {
            "/api": "http://localhost:3000",
        },
    },
    build: {
        outDir: path.resolve(__dirname, "dist"),
        emptyOutDir: true,
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes("node_modules/@mui")) {
                        return "vendor-mui";
                    }
                    if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
                        return "vendor-react";
                    }
                    return undefined;
                },
            },
        },
    },
});
