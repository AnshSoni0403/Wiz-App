import React from "react";
import ReactDOM from "react-dom/client";
import "./pwa/installPrompt"; // capture beforeinstallprompt before React mounts
import App from "./App";
import "./styles/theme.css";
import "./styles/app.css";
import "./styles/chat.css";
import "./styles/markdown.css";
import "./styles/tasks.css";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
