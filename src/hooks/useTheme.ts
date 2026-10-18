import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function initialTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.documentElement.style.backgroundColor =
      theme === "dark" ? "#151a23" : "#f7f9fc";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#151a23" : "#f7f9fc");
    try {
      localStorage.setItem("compression-theme", theme);
    } catch {
      /* The selected theme still works when storage is unavailable. */
    }
  }, [theme]);

  function toggleTheme() {
    setTheme(theme === "light" ? "dark" : "light");
  }

  return { theme, toggleTheme };
}
