const same = (a, b) => String(a) === String(b);
const ago = (value) => {
  if (!value) return "—";
  const n = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  return n < 60 ? `${n}s ago` : n < 3600 ? `${Math.floor(n / 60)}m ago` : n < 86400 ? `${Math.floor(n / 3600)}h ago` : `${Math.floor(n / 86400)}d ago`;
};
const Empty = ({ children }) => <div className="empty-state">{children}</div>;
export { same, ago, Empty };
