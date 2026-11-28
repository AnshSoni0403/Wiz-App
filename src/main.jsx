import React from "react";
import { MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.layer.css";
import ReactDOM from "react-dom/client";
import "./pwa/installPrompt"; // capture beforeinstallprompt before React mounts
import App from "./App";
import "./styles/theme.css";
import "./styles/app.css";
import "./styles/chat.css";
import "./styles/markdown.css";
import "./styles/tasks.css";

const theme = createTheme({
    fontFamily: "var(--font)",
    headings: { fontFamily: "var(--font)" },
    defaultRadius: "sm",
    primaryColor: "gold",
    primaryShade: 6,
    colors: {
        gold: ["#f7f0e4", "#f3e8d5", "#ead8ba", "#d9bf91", "#bea169", "#a8863a", "#8f6b2f", "#735423", "#61451e", "#4d3718"],
    },
});

const cssVariablesResolver = () => ({
    variables: {},
    light: {
        "--mantine-color-body": "var(--surface)",
        "--mantine-color-text": "var(--text)",
        "--mantine-color-dimmed": "var(--text-muted)",
        "--mantine-color-default": "var(--surface)",
        "--mantine-color-default-border": "var(--border)",
        "--mantine-color-default-hover": "var(--brand-soft)",
    },
    dark: {},
});

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme="light">
            <App />
        </MantineProvider>
    </React.StrictMode>
);
