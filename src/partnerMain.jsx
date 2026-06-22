import React from "react";
import { createRoot } from "react-dom/client";
import App from "./PartnerApp.jsx";
import ClientPortal from "./ClientPortal.jsx";
import SignPage from "./SignPage.jsx";
import "./partner.css";

// Tokenized public pages bypass firm auth entirely:
//   /c/<token>    → client portal
//   /sign/<token> → e-signature signing page
const path = window.location.pathname;
const isClient = path.startsWith("/c/");
const isSign = path.startsWith("/sign/");
createRoot(document.getElementById("root")).render(
  isSign ? <SignPage /> : isClient ? <ClientPortal /> : <App />
);
