export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

// Storage can be unavailable (private mode, blocked cookies), so it is always optional.
function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

// Saved choice first, then the browser's colour-scheme preference, then light.
export function getInitialTheme(): Theme {
  const stored = readStoredTheme();
  if (stored) return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// The theme tokens in index.css switch on the `dark` class of <html>.
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore: the theme still applies for this visit.
  }
}
