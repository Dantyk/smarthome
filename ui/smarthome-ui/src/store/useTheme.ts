import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

// Custom storage that uses both localStorage and cookies for persistence
const cookieStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === 'undefined') return null;
    
    // Try localStorage first
    try {
      const item = localStorage.getItem(name);
      if (item) return item;
    } catch (e) {
      console.warn('[Theme] localStorage not available:', e);
    }
    
    // Fallback to cookies
    const matches = document.cookie.match(new RegExp(
      '(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'
    ));
    return matches ? decodeURIComponent(matches[1]) : null;
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === 'undefined') return;
    
    // Save to localStorage
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      console.warn('[Theme] localStorage not available:', e);
    }
    
    // Also save to cookies (expires in 1 year)
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  },
  removeItem: (name: string): void => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(name);
    } catch (e) {
      console.warn('[Theme] localStorage not available:', e);
    }
    
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  },
};

export const useTheme = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'dark', // Default to dark theme
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'smarthome-theme',
      storage: createJSONStorage(() => cookieStorage),
    }
  )
);

export const themes = {
  light: {
    bg: '#f5f5f5',
    cardBg: '#ffffff',
    text: '#1a1a1a',
    textSecondary: '#666666',
    border: '#e0e0e0',
    currentTemp: '#ff6b35',
    targetTemp: '#3b82f6',
    weatherGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    headerBg: '#ffffff',
    headerShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  dark: {
    bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    cardBg: 'rgba(30, 41, 59, 0.8)',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    border: 'rgba(148, 163, 184, 0.2)',
    currentTemp: '#fb923c',
    targetTemp: '#60a5fa',
    weatherGradient: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
    headerBg: 'rgba(15, 23, 42, 0.95)',
    headerShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
};
