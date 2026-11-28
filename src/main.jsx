import React from "react";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.layer.css";
import "@mantine/notifications/styles.layer.css";
import ReactDOM from "react-dom/client";
import "./pwa/installPrompt"; // capture beforeinstallprompt before React mounts
import App from "./App";
import { theme, cssVariablesResolver } from "./theme";
import "./styles/theme.css";
import "./styles/app.css";
import "./styles/shell.css";
import "./styles/chat.css";
import "./styles/markdown.css";
import "./styles/tasks.css";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme="light">
            <Notifications position="top-center" limit={3} autoClose={3500} zIndex={4000} />
            <App />
        </MantineProvider>
    </React.StrictMode>
);
