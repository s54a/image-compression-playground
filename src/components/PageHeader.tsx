type PageHeaderProps = {
  theme: "light" | "dark";
  onToggle: () => void;
};

export function PageHeader({ theme, onToggle }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <h1>
          Image compression playground<span className="title-period">.</span>
        </h1>
        <p>Less weight. Keep what matters.</p>
      </div>
      <button
        className="theme-toggle"
        onClick={onToggle}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      >
        {theme === "light" ? (
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </svg>
        )}
        <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
      </button>
    </header>
  );
}
