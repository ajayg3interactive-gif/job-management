import { useState } from 'react';
import { applyTheme, getInitialTheme, saveTheme, type Theme } from '../app/theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    saveTheme(next);
    setTheme(next);
  };

  return { theme, isDark: theme === 'dark', toggleTheme };
}
