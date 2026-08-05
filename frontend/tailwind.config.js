/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        separator: 'hsl(var(--separator))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          elevated: 'hsl(var(--surface-elevated))',
          border: 'hsl(var(--surface-border))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        elevated: 'var(--shadow-elevated)',
        'elevated-sm': 'var(--shadow-elevated-sm)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        // The "you have not seen the tour yet" pulse on the dashboard's what's-new
        // button: a glow breathing in and out.
        //
        // Strength comes from `--attention-glow-*` in index.css, because light and
        // dark need different values — see the comment there.
        //
        // A blur radius and NOT a scale, which is the whole point: an earlier
        // version scaled a halo element behind the pill, and scaling something
        // ~200px wide turned it into a glowing slab across the corner. A blur reads
        // the same on a wide pill as on a small one; a scale factor does not. It
        // also keeps the label out of a scaled compositing layer, which is what
        // makes text go soft on a Retina screen.
        'attention-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 hsl(var(--primary) / 0)' },
          '50%': {
            boxShadow:
              '0 0 var(--attention-glow-blur) var(--attention-glow-spread) hsl(var(--primary) / var(--attention-glow-alpha))',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'attention-glow': 'attention-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
