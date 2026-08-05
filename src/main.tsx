import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider } from "convex/react";
import "./index.css";
import "./safari.css";
import App from "./App.tsx";
import { convex, convexConfigured } from "./lib/convex.ts";
import { initTheme } from "./lib/theme.ts";

initTheme();

const app = convexConfigured ? (
  <ConvexProvider client={convex}>
    <App />
  </ConvexProvider>
) : (
  <App />
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>{app}</StrictMode>,
);
