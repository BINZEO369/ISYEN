import { useEffect } from "react";

export function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 3800);
    return () => clearTimeout(t);
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

export function Modal({ title, eyebrow, description, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="modal active"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="বন্ধ করুন"
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

export function Loading({ text = "আপনার ড্যাশবোর্ড প্রস্তুত হচ্ছে…" }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      {text}
    </div>
  );
}
