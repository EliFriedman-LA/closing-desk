import React, { useState, useEffect } from "react";
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
const isFirmApp = !isClient && !isSign;

// ---------------------------------------------------------------------------
// PWA: inject manifest + apple/install meta tags from here so we don't depend
// on index.html, then register the service worker. Firm app only — we don't
// turn one-off client/signing pages into installable apps.
// ---------------------------------------------------------------------------
function injectPwaHead() {
  const head = document.head;
  const add = (tag, attrs) => {
    const el = document.createElement(tag);
    Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
    head.appendChild(el);
  };
  if (!head.querySelector('link[rel="manifest"]'))
    add("link", { rel: "manifest", href: "/partner-manifest.json" });
  if (!head.querySelector('meta[name="theme-color"]'))
    add("meta", { name: "theme-color", content: "#1e3a5f" });
  if (!head.querySelector('link[rel="apple-touch-icon"]'))
    add("link", { rel: "apple-touch-icon", href: "/cd-icon-180-apple.png" });
  add("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
  add("meta", { name: "mobile-web-app-capable", content: "yes" });
  add("meta", { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" });
  add("meta", { name: "apple-mobile-web-app-title", content: "Closing Desk" });
}

if (isFirmApp) {
  injectPwaHead();
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/partner-sw.js").catch(() => {});
    });
  }
}

function isStandalone() {
  return (
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true
  );
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}

function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // already installed
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // iOS Safari never fires beforeinstallprompt — show a manual hint instead.
    if (isIOS() && !isStandalone()) setShow(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show) return null;

  const onClick = async () => {
    if (deferred) {
      deferred.prompt();
      try { await deferred.userChoice; } catch (e) {}
      setDeferred(null);
      setShow(false);
    } else if (isIOS()) {
      setIosHint((v) => !v);
    }
  };

  const wrap = {
    position: "fixed", right: 16, bottom: 16, zIndex: 9999,
    display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8,
    fontFamily: "Segoe UI, Arial, sans-serif"
  };
  const btn = {
    background: "#1B91FE", color: "#fff", border: "none",
    padding: "11px 16px", borderRadius: 10, fontWeight: 600, fontSize: 14,
    boxShadow: "0 6px 20px rgba(0,0,0,.25)", cursor: "pointer",
    display: "flex", alignItems: "center", gap: 8
  };
  const hintBox = {
    background: "#fff", color: "#1c2430", border: "1px solid #e6eaf0",
    borderRadius: 10, padding: "10px 14px", fontSize: 13, maxWidth: 250,
    boxShadow: "0 6px 20px rgba(0,0,0,.18)", lineHeight: 1.45
  };
  const closeBtn = {
    background: "transparent", border: "none", color: "rgba(255,255,255,.85)",
    fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 0, marginLeft: 4
  };

  return (
    <div style={wrap}>
      {iosHint && (
        <div style={hintBox}>
          Tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b>.
        </div>
      )}
      <button style={btn} onClick={onClick}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12" />
          <path d="M7 11l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        Install app
        <span
          style={closeBtn}
          onClick={(e) => { e.stopPropagation(); setShow(false); }}
        >×</span>
      </button>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(
  isSign ? (
    <SignPage />
  ) : isClient ? (
    <ClientPortal />
  ) : (
    <React.Fragment>
      <App />
      <InstallPrompt />
    </React.Fragment>
  )
);
