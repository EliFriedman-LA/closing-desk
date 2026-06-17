import React from "react";
import { createRoot } from "react-dom/client";
import App from "./PartnerApp.jsx";
import ClientPortal from "./ClientPortal.jsx";
import "./partner.css";

// Tokenized client portal lives at /c/<token> and bypasses firm auth entirely.
const isClient = window.location.pathname.startsWith("/c/");
createRoot(document.getElementById("root")).render(isClient ? <ClientPortal /> : <App />);
