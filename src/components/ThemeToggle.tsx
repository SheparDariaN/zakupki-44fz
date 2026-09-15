import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { getStoredTheme, toggleTheme, type Theme } from '../utils/theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="btn-brutal"
      title={isDark ? 'Светлая тема' : 'Тёмная тема'}
      aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      aria-pressed={isDark}
      onClick={() => setTheme(toggleTheme())}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
