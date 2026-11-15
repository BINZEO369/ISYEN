"use client";

import { useEffect } from "react";

export function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onDismiss, 3800);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div
      className={`toast show ${toast.error ? "error" : ""}`}
      role="status"
      aria-live={toast.error ? "assertive" : "polite"}
    >
      {toast.message}
    </div>
  );
}

export function Modal({
  title,
  eyebrow,
  description,
  onClose,
  children,
  className = "",
}) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="modal active"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={["modal-content", className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 id="modal-title">{title}</h2>
        {description && <p className="muted">{description}</p>}
        {children}
      </section>
    </div>
  );
}

export function Loading({ text = "Preparing your dashboard…" }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      {text}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="empty-state">{children}</div>;
}

export const same = (left, right) => String(left) === String(right);

export function ago(value) {
  if (!value) return "—";
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
