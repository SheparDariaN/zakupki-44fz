export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
}

export function toggleTheme(): Theme {
  const next: Theme = getStoredTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

applyTheme(getStoredTheme());
