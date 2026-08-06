import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { continueRender, delayRender, staticFile } from "remotion";

// Brand system mirrored from primitive-mono-repo/web (app/globals.css):
// brutalist / retro-computing — JetBrains Mono everywhere, sharp corners,
// thick borders, hard offset shadows, green primary, base #1d1d1d / #f4f4f4.
const mono = loadMono("normal", {
  weights: ["400", "700", "800"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

export const monoFamily = mono.fontFamily;
// The wordmark/titles use mono too (the site sets `body { font-mono }`).
export const sansFamily = mono.fontFamily;

// Inter — used ONLY for the mocked ChatGPT host chrome (sidebar, message
// bubbles, composer) so it reads as the real app. The Primitive email widget
// embedded inside it stays JetBrains Mono, on-brand, exactly like production.
const inter = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});
export const uiSansFamily = inter.fontFamily;

// The custom logo face used to render the braille-art mark (PrimitiveLogoMono).
export const LOGO_FONT = "PrimitiveLogoMono";
if (typeof document !== "undefined") {
  const handle = delayRender("load-logo-font");
  const face = new FontFace(LOGO_FONT, `url(${staticFile("PrimitiveLogoMono.woff2")})`);
  face
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
      continueRender(handle);
    })
    .catch(() => continueRender(handle));
}

export type Format = "landscape" | "square" | "vertical";

export const BASE_FPS = 30;
export const FPS = 60;
export const f = (baselineFrames: number): number => Math.round((baselineFrames * FPS) / BASE_FPS);

// Dark-mode brand tokens from globals.css :root / .dark.
export const theme = {
  // base
  baseDark: "#1d1d1d",
  baseDarkSecondary: "#181818",
  baseLight: "#f4f4f4",
  muted: "#9a9a9a", // base-muted-dark

  // app surface (flat — brutalist, no gradient glow)
  pageBg: "#1d1d1d",

  // terminal window: dark surface, thick light foreground border, hard shadow
  windowBg: "#181818",
  windowBorder: "#f4f4f4",
  titlebarBg: "#1d1d1d",
  titlebarText: "#9a9a9a",
  // brutalist hard offset shadow color (foreground)
  hardShadow: "#f4f4f4",
  dotRed: "#dc2626",
  dotYellow: "#fbbf24",
  dotGreen: "#15803d",

  // text
  text: "#f4f4f4",
  dim: "#9a9a9a",
  prompt: "#4ade80", // bright green $
  command: "#f4f4f4",
  accent: "#22c55e", // brand green (bright on dark)
  accentDeep: "#15803d", // primary green
  amber: "#fbbf24",
  url: "#57c7ff", // dark-mode logo-scanline blue
  jsonKey: "#57c7ff",
  jsonString: "#f4f4f4",
  success: "#4ade80",
  cursor: "#4ade80",

  // animated braille glyph (dark-mode --logo-idle-* + reveal/glitch)
  logoIdle1: "hsl(150, 90%, 65%)",
  logoIdle2: "hsl(175, 80%, 55%)",
  logoIdle3: "hsl(200, 80%, 60%)",
  logoGlitch: "#ff6ac1",

  cardText: "#f4f4f4",
  cardDim: "#9a9a9a",
} as const;

export type Tone = "default" | "dim" | "success" | "url" | "accent" | "key" | "string" | "amber";

export function toneColor(tone: Tone | undefined): string {
  switch (tone) {
    case "dim":
      return theme.dim;
    case "success":
      return theme.success;
    case "url":
      return theme.url;
    case "accent":
      return theme.accent;
    case "amber":
      return theme.amber;
    case "key":
      return theme.jsonKey;
    case "string":
      return theme.jsonString;
    default:
      return theme.text;
  }
}

// Per-format layout tuning.
export const layout: Record<
  Format,
  { width: number; height: number; fontSize: number; maxLines: number; padding: number }
> = {
  landscape: { width: 1920, height: 1080, fontSize: 30, maxLines: 22, padding: 120 },
  square: { width: 1080, height: 1080, fontSize: 26, maxLines: 20, padding: 60 },
  vertical: { width: 1080, height: 1920, fontSize: 30, maxLines: 24, padding: 60 },
};
