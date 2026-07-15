import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  // Dark tokens are driven by BOTH `.dark` (convention) and `.rm-dark` (the
  // class the app actually toggles). This makes every `dark:` utility in the
  // components activate under reading-mode "Tối" too.
  darkMode: ["variant", ["&:where(.dark, .dark *)", "&:where(.rm-dark, .rm-dark *)"]],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
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
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // Markdown prose driven entirely by design tokens → auto-adapts to
      // light / dark / sepia with no `.dark`-specific overrides or `!important`.
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "none",
            // Inherit font-size from the reader container (user font controls).
            fontSize: "inherit",
            "--tw-prose-body": "hsl(var(--foreground))",
            "--tw-prose-headings": "hsl(var(--foreground))",
            "--tw-prose-lead": "hsl(var(--muted-foreground))",
            "--tw-prose-links": "hsl(var(--primary))",
            "--tw-prose-bold": "hsl(var(--foreground))",
            "--tw-prose-counters": "hsl(var(--muted-foreground))",
            "--tw-prose-bullets": "hsl(var(--muted-foreground))",
            "--tw-prose-hr": "hsl(var(--border))",
            "--tw-prose-quotes": "hsl(var(--foreground))",
            "--tw-prose-quote-borders": "hsl(var(--border))",
            "--tw-prose-captions": "hsl(var(--muted-foreground))",
            "--tw-prose-code": "hsl(var(--code-inline-fg))",
            "--tw-prose-pre-code": "hsl(var(--code-fg))",
            "--tw-prose-pre-bg": "hsl(var(--code-bg))",
            "--tw-prose-th-borders": "hsl(var(--border))",
            "--tw-prose-td-borders": "hsl(var(--border))",
            // Kill the plugin's decorative backtick / smart-quote pseudo-content.
            "code::before": { content: "none" },
            "code::after": { content: "none" },
            "blockquote p:first-of-type::before": { content: "none" },
            "blockquote p:last-of-type::after": { content: "none" },
            // Academic heading rules.
            h1: {
              borderBottom: "1px solid hsl(var(--border))",
              paddingBottom: "0.3em",
            },
            h2: {
              borderBottom: "1px solid hsl(var(--border))",
              paddingBottom: "0.3em",
            },
            // Inline code chip.
            ":not(pre) > code": {
              backgroundColor: "hsl(var(--code-inline-bg))",
              color: "hsl(var(--code-inline-fg))",
              padding: "0.2rem 0.4rem",
              borderRadius: "0.25rem",
              fontWeight: "500",
              fontSize: "0.875em",
            },
            // Fenced code block.
            pre: {
              backgroundColor: "hsl(var(--code-bg))",
              color: "hsl(var(--code-fg))",
              border: "1px solid hsl(var(--code-border))",
              borderRadius: "0.5rem",
              padding: "1.25rem",
            },
            // Bordered academic tables with zebra striping.
            table: { width: "100%" },
            "thead": { backgroundColor: "hsl(var(--muted))" },
            "tbody tr:nth-child(even)": {
              backgroundColor: "hsl(var(--muted) / 0.4)",
            },
            "th, td": {
              borderWidth: "1px",
              borderColor: "hsl(var(--border))",
              padding: "10px 14px",
            },
          },
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
