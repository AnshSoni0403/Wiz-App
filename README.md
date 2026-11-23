# Wizz (PWA)

Wizz is Marwiz Vision's AI assistant app for staff. The **Knowledge Base Agent** provides cited
answers and media. The **Proposal Making Agent** shares drafts with Admin and provides guided
intake, draft chat, licence pricing, and Google Docs export.

- React 18 + Vite 7, react-router v6, axios (cookie session, `withCredentials: true`)
- `vite-plugin-pwa` for the web manifest and service worker
- Plain CSS with CSS variables (brand tokens in `src/styles/theme.css`)

## Commands

```bash
npm install
npm run dev       # http://localhost:7003/wizz-app/ (proxies /api to WIZZ_BACKEND_ORIGIN)
npm run build     # production build into dist/
npm run build:vercel # production build into dist-vercel/wizz-app/
npm run preview   # serve dist/ at http://localhost:7003/wizz-app/ (no API proxy)
```

Requires Node 22+.

## How it is served (`/wizz-app/`)

The API server serves the built app at **`/wizz-app/`** on the same origin as the API, so the
existing cookie session (the same login as the Admin) works without CORS:

- `base: "/wizz-app/"` in `vite.config.js`, router basename `/wizz-app`,
  manifest `start_url` and `scope` = `/wizz-app/`, service worker at `/wizz-app/sw.js`
  (scope `/wizz-app/`).
- It is deliberately **not** `/wizz/`: the Admin panel has its own pages at `/wizz/knowledge`,
  `/wizz/members` and `/wizz/settings`, and a service worker scoped to `/wizz/` would capture them.
- All API calls are same-origin: `/api/v1/...`.
- For local frontend development, set `WIZZ_BACKEND_ORIGIN` in the ignored `.env` to the deployed
  Marwiz API's HTTPS origin. Vite forwards same-origin `/api` requests to that API.

**Deployment:** the build output `dist/` is copied to the server's `out/wizz-app/` folder at
deploy time (not done by this task). The server registers `express.static(out/wizz-app)` at
`/wizz-app` plus a `/wizz-app/*` fallback to `out/wizz-app/index.html`, before the Admin catch-all.
API calls stay at `/api/v1/wizz/...`.

## Service worker and privacy

For Vercel, select `marwizvision-v2-wizz` as the project Root Directory (or the repository root if Wizz is in its own repo). Use the checked-in `vercel.json` and Node.js 22. Set `WIZZ_BACKEND_ORIGIN` in Vercel to the HTTPS origin of the deployed Marwiz API, with no path or credentials. Deploy the current Marwiz backend with the Wizz routes first. An unauthenticated request to `/api/v1/wizz/me` should return a JSON authentication error, rather than an HTML application shell.

The Vercel function keeps the browser's API calls same-origin and forwards the Wizz session cookie to the backend. Sign in on the Vercel hostname to establish a session there. The function exposes only the endpoints used for sign-in, chat, history and media. Manage Telegram linking from Marwiz Admin. The backend still owns access checks and must reach Hermes privately. If the backend uses its local Hermes address, run Hermes on the same host as that backend. Do not add Anthropic or Hermes credentials to the Vercel PWA environment.

After deploying, verify sign-in, a cited answer, conversation history, a signed media link, and PWA install from `/wizz-app/`. With a permitted staff account, open **Proposals**, start a draft, save an answer, and resume it from Admin. Verify writing and Google Docs export with the backend's proposal integrations configured. Manage the Price Master and the Google connection in Admin.

- Precaches the **app shell only** (HTML, JS, CSS, icons).
- Anything under `/api/` is **network-only**: answers, conversations, sessions and signed file
  links are never stored by the service worker. Navigation fallback excludes `/api/`.
- An offline banner is shown when the device has no connection.
- New versions show an "Update available - Reload" prompt instead of reloading mid-conversation.

## Auth

- Login: `POST /api/v1/auth/company/login` `{ email, password }` (same as the Admin).
- Session check: `GET /api/v1/auth/me`; logout: `POST /api/v1/auth/logout`.
  Logging out ends the shared session, so it also signs the same browser out of the Admin.
- After login: `GET /api/v1/wizz/me`. A `403 WIZZ_NO_ACCESS` shows the
  "ask your admin to add you in Admin -> Wizz -> Members & Access" screen.
- Any `401` returns to the login screen.

## Screens

| Route (under `/wizz-app`) | Screen |
|---|---|
| `/login` | Sign in |
| `/knowledge`, `/knowledge/:conversationId` | Chat with the Knowledge Base Agent, branch picker, history drawer |
| `/proposals`, `/proposals/:draftId` | Start and resume drafts, answer guided questions, chat with Wizz, review prices, and export |
| `/profile` | Name, role, branches, install, logout |

## Adding more agents (Tasks, CRM, ...)

Agents are listed in `src/agents/registry.js`. Each entry is one bottom-navigation tab and one
route. Disabled entries (Tasks, CRM) are hidden. To add one: build its page under
`src/pages/<agent>/`, set `Component` and `enabled: true` (or an `isAvailable(wizz)` check), and
add its API calls under `src/api/`.

## Project layout

```
src/
  agents/registry.js        agent tabs/routes
  api/                      axios client, endpoints, auth + wizz calls
  components/               shell, top bar, prompts, markdown, knowledge/*, profile/*
  context/AuthContext.jsx   session + /wizz/me state
  hooks/                    online status, branch preference
  pages/                    login, no-access, connection error, profile, knowledge chat
  pwa/installPrompt.js      beforeinstallprompt capture + iOS detection
  styles/                   theme tokens, layout, chat, markdown
  utils/                    errors, safe markdown renderer, formatting, storage
public/                     favicon, app icons (192, 512, maskable 512, apple-touch)
```

Assistant answers are rendered by `src/utils/markdown.js`, which HTML-escapes the whole answer
first and then adds only a fixed set of tags; links are limited to http(s), mailto and same-origin
paths.

## Brand

Colours come from the Admin's gold theme (`src/constants/roleTheme.js`): primary `#8F6B2F`,
canvas `#F6F3ED`. The icons were generated from the Admin's Marwiz logo
(`public/logo.png`, monogram cropped and drawn white on the brand gold); the in-app gold logo is
`MarwizVisionLogo_gold.png` from the Admin. The UI is intentionally plain so it can be redesigned
later.

## Note on NODE_ENV

`vite.config.js` forces `NODE_ENV=production` for `vite build`, because a machine-wide
`NODE_ENV=development` would otherwise bundle React's development build.
