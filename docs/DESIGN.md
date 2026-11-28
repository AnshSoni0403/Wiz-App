# Wizz app design guide (Mantine redesign)

Wizz is a phone-first PWA for Marwiz staff. It should feel like a native app: compact, calm, fast.
Colours are fixed (Marwiz gold `--brand #8f6b2f` on cream `--canvas #f6f3ed`); never add new brand colours.

## Building blocks

- **Mantine 8** (`@mantine/core`, `@mantine/hooks`, `@mantine/notifications`). Defaults live in `src/theme.js`
  (small controls, 10px radius, cards with hairline border, light badges, pill segmented controls). Prefer
  props (`gap`, `p`, `c="dimmed"`, `fw`, `size`) over custom CSS. Keep custom CSS small and in the area's file.
- **Icons:** `<Icon name="…" size={18} />` from `src/components/Icon.jsx` (Tabler). If a name is missing,
  import it straight from `@tabler/icons-react` in your own file (`size={18} stroke={1.75}`) — do not edit Icon.jsx.
- **Status colours:** `STATUS_COLORS` / `PRIORITY_COLORS` from `src/theme.js` for `<Badge color=…>`.
- **Toasts:** `notifications.show({ message, color: "teal" | "red", icon })` from `@mantine/notifications`
  for save feedback. Keep an `aria-live` region only where the existing code needs one.

## Layout

- The shell (`AppShell`, bottom tabs on phones, left rail ≥768px, account menu) is done — do not change it.
- Every screen: `<div className="page"><TopBar …/><div className="page__body">…</div></div>`.
- `TopBar` props: `title`, `subtitle`, `back` (path or `true` for sub-screens — shows a back arrow), and
  `children` for 1–2 screen actions as `<ActionIcon aria-label=…><Icon/></ActionIcon>` (search, filter, new
  chat, history…). The bell and account avatar are added by TopBar itself. Never put text buttons in the header.
- Primary "create" action on list screens: a floating button
  `<ActionIcon className="fab" size={52} radius="xl" variant="filled" aria-label="New …">` (or `Button
  className="fab" radius="xl" leftSection={<Icon name="plus"/>}`) placed as the last child of `.page`.
- Filters: `SegmentedControl` (≤4 options) or a horizontally scrolling row of `Chip`s with counts.
- Lists: compact `Card`s or `Paper` rows (≈64–76px tall), one line title + one meta line, badges right.
  Long screens use `Stack gap="xs"`. Group sections with small uppercase `Text size="xs" c="dimmed" fw={600}`.
- Bottom sheets / forms: `Drawer position="bottom" size="auto"` on phones and `Modal` from 768px
  (`useMediaQuery("(min-width: 768px)")`). Sheet title in the Drawer header, primary action full width at the bottom.
- Loading: `Skeleton` rows shaped like the content. Empty: small icon in a soft circle, one sentence, one action.
  Error: `Alert color="red"` with a Retry button.
- Touch targets ≥ 40px; content max width 860px (already on `.page__body`).

## Rules

- Do not change API calls, routes, data handling or behaviour — only presentation and UX flow.
- Keep every existing feature reachable. Keep labels, `aria-*`, focus handling and keyboard use working.
- No infrastructure names (MCP, Hermes) in UI text.
- Run `npm run build` (and `npm run build:vercel`) before finishing.
