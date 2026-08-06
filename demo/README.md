# Primitive CLI demo video

A [Remotion](https://www.remotion.dev/) project that renders a short, stylized
terminal demo of the Primitive CLI first-run journey:

1. **Install** — `npm install -g @primitivedotdev/cli`
2. **Sign up** — `primitive signup` (email OTP) → `primitive signup confirm`
3. **Inbox** — `primitive inbox setup` shows the ready receive address
4. **Send** — `primitive send --to … --body …`

The terminal is *driven by a transcript* — commands type out and output reveals
frame-by-frame — but every output line is **real**, not invented. The text was
captured by actually running `@primitivedotdev/cli` v1.2.0 and the Primitive API
(`npm install`, `primitive --version`, a real `primitive signup` against staging,
a real `getInboxStatus`, and a real `/send-mail` response) and reproduced verbatim
from the command source. The provenance of each line is documented at the top of
[`src/script.ts`](src/script.ts). Identity is a clean demo persona
(`you@acme.dev` / Acme), but the flow, flags, messages, field names, and
formatting are exactly what the CLI emits.

This package is intentionally **standalone** — it is not part of the pnpm SDK
workspace (`pnpm-workspace.yaml`), so its Remotion + headless-Chromium
dependencies stay out of every SDK contributor's install and out of the SDK CI
path filters.

## Preview

```bash
cd demo
npm install
npm run studio      # opens Remotion Studio at http://localhost:3000
```

Scrub the four compositions in the left sidebar.

## Render

The first render downloads a headless Chromium build (one-time, via
`@remotion/renderer`). Outputs land in `out/` (gitignored).

Compositions run at **60fps**, and the mp4/webm scripts render at **`--scale=2`**
(2× the composition resolution, i.e. true 4K for landscape) with a high-quality
CRF:

```bash
npm run render:landscape   # out/demo-landscape.mp4   3840x2160 (4K) 60fps h264
npm run render:square      # out/demo-square.mp4      2160x2160       60fps h264
npm run render:vertical    # out/demo-vertical.mp4    2160x3840       60fps h264
npm run render:webm        # out/demo.webm            3840x2160 (4K) 60fps vp9
npm run render:gif         # out/demo.gif             1920x1080       30fps loop
npm run render:all         # the three mp4s + the gif
```

> GIF note: the GIF format is hard-capped at 50fps (and uses centisecond frame
> timing), so it can't carry the 60fps the video runs at. `render:gif` renders
> every 2nd frame for a clean 30fps loop (`--every-nth-frame=2`). For a true
> 60fps clip, use the webm. Adjust quality/size via `--scale` and `--crf` in the
> scripts (lower CRF = higher quality + larger file).

All four compositions share one `DemoVideo` component
([`src/DemoVideo.tsx`](src/DemoVideo.tsx)) parameterized by a `format` prop;
they are registered in [`src/Root.tsx`](src/Root.tsx).

## Embedding the clip

`out/` is gitignored, so to show the clip in a README on GitHub you must either
commit the rendered asset (e.g. copy `out/demo.gif` to `demo/preview.gif` and
reference it) or upload it to a CDN / GitHub release and link that URL. The GIF
is ~7 MB; `render:webm` produces a smaller file if you prefer.

```markdown
<!-- once committed/hosted -->
![Primitive CLI demo](preview.gif)
```

## Customizing

- **Transcript & timing** — [`src/script.ts`](src/script.ts): the ordered
  commands, output lines, typing speed (`cps`), and holds.
- **Colors & fonts** — [`src/theme.ts`](src/theme.ts): the terminal palette,
  accent color, and per-format layout. Drop a real brand SVG into `public/` and
  wire it into [`src/components/Logo.tsx`](src/components/Logo.tsx) to replace the
  built-in mark.
- **Layout per format** — `margins` / `cardScale` in
  [`src/DemoVideo.tsx`](src/DemoVideo.tsx).
