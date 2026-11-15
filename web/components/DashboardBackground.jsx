export default function DashboardBackground({ children }) {
  return (
    <div className="app-shell">
      {children}
      <style jsx global>{`
        .app-shell { min-height: calc(100vh - 142px); background: #fff !important; background-image: none !important; background-attachment: scroll !important; }
        .app-shell::before { display: none !important; }
      `}</style>
    </div>
  );
}
