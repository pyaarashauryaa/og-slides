import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { installClickBurst, installSparkleTrail } from "./ui/clickBurst.js";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/controls.css";
import "./styles/shell.css";
import "./styles/home.css";
import "./styles/chat.css";
import "./styles/slides.css";
import "./styles/pages.css";
import "./styles/vibe.css";
import "./styles/studio.css";

installClickBurst();
installSparkleTrail();

// Development only: ?preview=voice shows the voice-note bubble on its own (no CometChat needed).
const VoicePreview = import.meta.env.DEV && new URLSearchParams(location.search).get("preview") === "voice"
  ? (await import("./dev/VoicePreview.jsx")).default
  : null;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {VoicePreview ? <VoicePreview /> : <App />}
  </StrictMode>
);
