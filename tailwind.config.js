import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load local safelist if it exists (git-ignored file for personal Figma exports)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const safelistPath = join(__dirname, 'tailwind.safelist.json');
const localSafelist = existsSync(safelistPath)
  ? JSON.parse(readFileSync(safelistPath, 'utf-8'))
  : [];

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/generated/export_figma/**/*.{tsx,jsx}",  // Auto-scan Figma exports for hot-reload
  ],
  theme: {
    screens: {
      'sm': '420px',   // Mobile breakpoint
      'md': '960px',   // Tablet breakpoint
      'lg': '1440px',  // Desktop breakpoint
      'max-lg': {'max': '1439px'},  // Tablet + Mobile (≤1439px)
      'max-md': {'max': '939px'},   // Mobile only (≤939px)
    },
    extend: {
      colors: {
        // Shadcn colors mapped to CSS variables
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))'
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  // Safelist loaded from tailwind.safelist.json (git-ignored)
  // Copy tailwind.safelist.example.json to tailwind.safelist.json to add your classes
  safelist: localSafelist,
  plugins: [require("tailwindcss-animate")],
}
