import { useEffect, useState } from 'react';

const THEME_DEFAULT = 'light';
const THEME_DARK = 'dark';
const THEME_SAKURA = 'sakura';

export function useTheme() {
  const [theme, setThemeState] = useState<string>(() => {
    if (typeof window === 'undefined') return THEME_DEFAULT;
    return document.documentElement.getAttribute('data-theme') || localStorage.getItem('unicorns.theme') || THEME_DEFAULT;
  });

  const [previousNonSakuraTheme, setPreviousNonSakuraTheme] = useState<string>(() => {
    if (typeof window === 'undefined') return THEME_DEFAULT;
    return localStorage.getItem('unicorns.prevTheme') || THEME_DEFAULT;
  });

  useEffect(() => {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme') || THEME_DEFAULT;
    
    // Restore theme on mount
    const savedTheme = localStorage.getItem('unicorns.theme') || THEME_DEFAULT;
    if (savedTheme !== currentTheme) {
      html.setAttribute('data-theme', savedTheme);
      setThemeState(savedTheme);
    }

    // Save previous theme when switching to sakura
    const savedPrevTheme = localStorage.getItem('unicorns.prevTheme') || THEME_DEFAULT;
    setPreviousNonSakuraTheme(savedPrevTheme);
  }, []);

  const setTheme = (newTheme: string) => {
    if (typeof window === 'undefined') return;
    
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme') || THEME_DEFAULT;

    // Save previous theme when switching to sakura
    if (newTheme === THEME_SAKURA && currentTheme !== THEME_SAKURA) {
      const prev = currentTheme;
      setPreviousNonSakuraTheme(prev);
      localStorage.setItem('unicorns.prevTheme', prev);
    } else if (newTheme !== THEME_SAKURA) {
      setPreviousNonSakuraTheme(newTheme);
      localStorage.setItem('unicorns.prevTheme', newTheme);
    }

    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('unicorns.theme', newTheme);
    setThemeState(newTheme);
  };

  return {
    theme,
    setTheme,
    previousNonSakuraTheme,
    THEME_DEFAULT,
    THEME_DARK,
    THEME_SAKURA,
  };
}

