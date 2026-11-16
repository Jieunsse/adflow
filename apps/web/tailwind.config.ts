import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// shadcn 색: 값은 app/styles/shadcn.css (.adflow 안). 모서리는 Tailwind 기본 단계를 그대로 쓴다 —
// 기존 화면이 rounded-lg/xl 을 많이 써서 바꾸면 전체가 달라진다. 역할별 모서리는 AGENTS.md 참고.
const c = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class", "[data-theme='dark']"],
  theme: {
    extend: {
      colors: {
        background: c("background"),
        foreground: c("foreground"),
        card: { DEFAULT: c("card"), foreground: c("card-foreground") },
        popover: { DEFAULT: c("popover"), foreground: c("popover-foreground") },
        primary: {
          DEFAULT: c("primary"),
          foreground: c("primary-foreground"),
          hover: c("primary-hover"),
          pressed: c("primary-pressed"),
        },
        secondary: {
          DEFAULT: c("secondary"),
          foreground: c("secondary-foreground"),
          hover: c("secondary-hover"),
        },
        muted: { DEFAULT: c("muted"), foreground: c("muted-foreground") },
        accent: { DEFAULT: c("accent"), foreground: c("accent-foreground") },
        destructive: { DEFAULT: c("destructive"), foreground: c("destructive-foreground") },
        border: c("border"),
        input: c("input"),
        ring: c("ring"),
        chart: {
          "1": c("chart-1"),
          "2": c("chart-2"),
          "3": c("chart-3"),
          "4": c("chart-4"),
          "5": c("chart-5"),
        },
        status: Object.fromEntries(
          ["blocked", "waiting", "progress", "done", "quiet"].map((s) => [
            s,
            {
              fg: c(`status-${s}-fg`),
              bg: c(`status-${s}-bg`),
              line: c(`status-${s}-line`),
              solid: c(`status-${s}-solid`),
            },
          ]),
        ),
      },
    },
  },
  plugins: [animate],
} satisfies Config;
