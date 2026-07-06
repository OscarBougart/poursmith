# design.md — PourSmith

Read this fully before making any UI change. PourSmith shares a design language with **Dram**; the goal is that the two apps read as one product. Never deviate without being explicitly asked.

---

## What this app is

**PourSmith** — the bartender's profit tool. A fast, dark-first **web** app for costing pours, setting prices, and seeing margin at a glance. It is the daytime, spreadsheet-killing counterpart to Dram (the shift-time recipe notebook). Same family, same palette, same discipline — different job.

Where Dram answers *"how do I make it?"*, PourSmith answers *"does it make money?"*

---

## Family resemblance — the non-negotiables

These are the signals that make PourSmith feel like Dram. Break any one and the two apps look like cousins, not siblings.

1. **Dark-first, always.** Never render a white background — not even a flash before mount. The base is Dram's warm near-black (`--bg-primary`).
2. **Warm cream text, not cool white.** Primary text is `--text-primary` (`#F0EBE0`). Pure white is banned.
3. **Emerald is the accent.** `--green` (`#0ead69`) is Dram's signature. It carries positive meaning and primary actions everywhere.
4. **Red is reserved.** `--red` is the only alarm color. Don't spend it on decoration.
5. **Tokens, never hardcoded values.** Every color, size, space, and radius comes from `dram-tokens.css`.

---

## Design principles

Adapted from Dram's shift-time principles to a web profit tool.

1. **Clarity above all.** The number a bartender came for — pour cost, margin %, suggested price — is the loudest thing on screen. Everything else recedes.
2. **Dark first.** Same as Dram. Light mode is opt-in, never default.
3. **Scannable money.** Financial state is readable in under a second via color: emerald = healthy, red = underwater, cream = neutral. Color is meaning, not decoration.
4. **Calm and dense.** This is a tool, not a landing page. Prefer information density and restraint over motion and whitespace theatrics. Echo Dram's "no spinners, instant" ethos — nothing should feel like it's performing.
5. **Generous targets.** Even on desktop, interactive elements stay comfortably large. Dram's wet-hands rule becomes PourSmith's fast-entry rule.

---

## Color language

The palette is Dram's. What matters is **discipline** — using each color only for its assigned meaning.

| Role | Token | Meaning / usage |
|---|---|---|
| Page background | `--bg-primary` | The base. Never white. |
| Card surface | `--bg-card` | Rows, panels, grouped inputs. |
| Elevated surface | `--bg-elevated` | Modals, menus, popovers. |
| Hairline | `--border` / `--border-light` | Dividers; `-light` on elevated surfaces. |
| Primary text | `--text-primary` | Warm cream. Headings, key numbers. |
| Secondary text | `--text-secondary` | Labels, supporting copy. |
| Muted text | `--text-muted` | Hints, disabled, placeholder-level. |
| **Accent / positive** | `--green` (`#0ead69`) | Primary buttons, healthy margin, positive deltas, active states. **The through-line to Dram.** |
| Accent pressed | `--green-d1` | Hover / active on emerald elements. |
| **Danger / underwater** | `--red` | Negative margin, destructive actions, errors. **Only** color used for alarm. |
| Danger surface | `--red-dim` | Tinted background behind a danger state. |
| Caution | `--warning-text` / `--warning-bg` | Thin-margin warnings, low-confidence estimates. |
| Input field | `--input-bg` / `--placeholder-text` | Field background and placeholder. |
| Overlay | `--modal-overlay` / `--overlay-strong` | Scrims behind modals. |

**Semantic aliases** (use these in markup so intent is legible):
`--margin-good` → emerald · `--margin-good-strong` → pressed emerald · `--margin-bad` → red.

> Rule of thumb: if a color isn't carrying meaning (state, action, or hierarchy), it shouldn't be there. Monochrome cream-on-black is the resting state; emerald and red are earned.

---

## Design tokens

All tokens live in **`dram-tokens.css`** (the token bridge). That file is the single source of truth and mirrors Dram's `constants/`. **Never hardcode a value** — reference the token.

| Group | Tokens |
|---|---|
| Color | `--bg-primary/card/elevated`, `--border`, `--border-light`, `--text-primary/secondary/muted`, `--green`, `--green-d1`, `--red`, `--red-dim`, `--warning-text/bg`, `--input-bg`, `--placeholder-text`, `--modal-overlay`, `--overlay-strong` |
| Typography | `--font-size-xs/sm/md/lg/xl`, `--font-weight-normal/bold`, `--font-family` |
| Spacing | `--space-xs/sm/md/lg/xl/2xl` |
| Radius | `--radius-sm/md/lg/full` |

Consume them through Tailwind utilities (see the `@theme` / config block in `dram-tokens.css`), e.g. `bg-bg-card`, `text-text-muted`, `text-margin-good`, `rounded-lg`.

---

## Tech stack

| Concern | Library |
|---|---|
| Build | Vite |
| Framework | React + TypeScript |
| Styling | Tailwind (tokens via `dram-tokens.css`) — utilities only, no ad-hoc hex |
| Motion | Framer Motion — restrained (see Motion) |
| Backend / auth | Supabase (shared with Dram post-merge) |
| Icons | Match Dram's icon language (Ionicons-style line icons) |

**Never introduce a new library without asking first** (Dram's rule, kept).

---

## Motion

- **Restrained by default.** Taste dials target **5 / 3 / 6** (variance / motion / density). Motion is low on purpose.
- Transitions are functional: state changes, value updates, modal enter/exit. No decorative or attention-seeking animation.
- A margin flipping from healthy to underwater may animate its color/number — because that's *information*. Ambient movement is not.
- Nothing blocks the user. No full-screen spinners for computable, local results (Dram's "no loading spinners" ethos).

---

## Layout & component conventions

- **Surfaces stack by elevation:** page on `--bg-primary`, grouped content on `--bg-card`, transient UI (modals, menus) on `--bg-elevated`.
- **Hairlines, not heavy borders:** `--border` for standard dividers, `--border-light` on elevated surfaces.
- **Radius:** `--radius-md` for cards/inputs, `--radius-sm` for small chips/tags, `--radius-lg` for large panels, `--radius-full` for pills and round buttons (mirrors Dram's fully-round FABs).
- **Inputs:** `--input-bg` background, `--placeholder-text` for placeholders, emerald focus ring.
- **Primary action = emerald.** One clear emerald action per view. Destructive = red, and always confirmed.
- **Numbers are typographic anchors:** key figures use `--font-size-lg`/`xl` and `--font-weight-bold`; supporting labels use `--text-secondary` at smaller sizes.

---

## Coding rules

Aligned with Dram's, adapted for web.

- **TypeScript strict** — no `any`, full types on params and returns.
- **Functional components + hooks only.** One default export per file.
- **No hardcoded design values.** All color/space/size/radius via tokens (Tailwind utilities or `var(--…)`). No raw hex in components.
- **Semantic color in markup:** use `text-margin-good` / `text-margin-bad`, not raw `text-green` / `text-red`, wherever the color expresses financial state.
- **Accessibility labels on every interactive element.** Maintain contrast against the dark base (cream and emerald both pass on `--bg-primary`; verify any new pairing).
- **No white.** No `bg-white`, no `#fff`, no light-mode Tailwind defaults slipping in.

---

## Naming conventions

| Thing | Convention |
|---|---|
| Components | `PascalCase.tsx` |
| Hooks | `useCamelCase.ts` |
| Stores | `camelCaseStore.ts` |
| CSS variables | `--kebab-case` |
| DB tables (Supabase) | `snake_case` |

---

## The one-line test

Before shipping any screen, ask: *"Put side by side with a Dram screen, would a stranger say these are the same product?"* If not — it's the background, the text warmth, or a misused emerald. Fix that first.