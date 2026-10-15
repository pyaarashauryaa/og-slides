# OGSlides

A team workspace for building presentations together: slides, team chat, tasks, resources and decisions.
Built for the CometChat "Zero to Chat" hackathon. Sign-in goes through a small server so no CometChat secret key is ever in the browser (see "Sign-in server").

## Run it (Windows, VS Code)

OGSlides has two parts: the web app (Vite) and a tiny sign-in server (`server/`). Run both, each in its own terminal.

1. `npm.cmd install` (once).
2. Make `.env` from `.env.example` and fill in `VITE_COMETCHAT_APP_ID` and `VITE_COMETCHAT_REGION` (not secret).
3. Make `server/.env` from `server/.env.example` and fill in the REST API Key and a session secret (private, see below).
4. Terminal 1: `npm.cmd run server`. Terminal 2: `npm.cmd run dev`. Open http://localhost:5173.

Restart the matching command after changing its `.env`. Other commands: `npm.cmd test` (all tests), `npm.cmd run test:server`, `npm.cmd run build`.

## How sharing works

Every edit is a small message saved in a hidden CometChat group (`ogslides-workspace-sync`). Every browser replays all messages in order, so everyone sees the same deck. Team chat uses a different group and never receives edit messages.

Limits: the log only grows; message retention was not verified (check your CometChat dashboard); each message holds at most 65,536 characters; if two people change the same field at once, the later save wins (the person typing is warned); edits not yet sent are lost if the tab closes (you are warned first). It is not a database.

## Editor

- Free-form slides made of text boxes, shapes and images. Drag, resize, arrow-key nudge (Shift for big steps), snap guides, duplicate, delete, stacking order.
- Text formatting applies to a whole text box (font, size, bold, italic, underline, colour, alignment, bullet or numbered lists, line and letter spacing, background, border). It does not format individual words.
- 27 layouts in 5 categories (Basics, Startup pitch, Charts and tables, Plans and diagrams, People and closing), 4 themes, speaker notes (press N while presenting), transitions (none, fade, slide, zoom).
- Undo/redo covers your own edits only. If a teammate changed the same field after you, that part is skipped and you are told.
- Export: PDF (one picture per page, so text is not selectable), PNG of the current slide, ZIP of all slides as PNGs.
- Old "classic" slides still work. "Make it editable" converts one to free-form.

## Charts, tables and arrows

- **Chart** (toolbar): bar, line, pie or doughnut. Edit the title and each row (label and number) in the side panel. Bad rows (blank, not a number) are flagged and skipped; pie charts skip negatives; at most 12 rows.
- **Table** (toolbar): up to 12 rows by 8 columns. Edit cells, add or remove rows and columns, set column widths, header row, striped rows and colours in the side panel. Cells are clipped (not overflowing) and you get a warning when text probably does not fit.
- **Arrows** (toolbar): straight, elbow, two-way, dashed and dotted lines with colour, thickness and arrowheads. Shapes can hold a label (good for flowcharts), and there are diamond and chevron shapes.
- Limits: arrows are NOT glued to shapes (move the arrow too). Tables are edited in the side panel, not by typing in the cell on the slide. No multi-select, so there is no "distribute". Charts and tables export as pictures like everything else.
- **Grid** button: shows a 20-unit grid and snaps to it. **?** key or the keyboard button lists the shortcuts.

## Voice notes (team chat)

Voice notes are the chat kit's own recorder (UI Kit 7.2.4), shown as a microphone in the composer. The browser asks for the microphone only when you click it. You can listen before sending or discard. The recording is sent through CometChat's normal file upload, not stored in OGSlides. It needs https or localhost and a browser with recording support; otherwise the chat shows a notice.

## Images

Pictures (PNG, JPEG, WebP, up to 8 MB) are shrunk, re-drawn (this removes anything hidden in the file) and uploaded to CometChat file storage. Only the link is shared. SVG is refused. Whether every teammate's browser can open that link must be confirmed with two real users. If the upload fails the picture is not added.

## Teams: create, join, lobby

The first screen is a landing page with **Create a team** and **Join a team**.

- **Create** makes two CometChat *password-protected groups* with the same passkey: one for team chat (`ogs-<code>`) and one hidden group that carries the shared slides, tasks and cursors (`ogs-<code>-sync`). The 6-character room code and the 8-character passkey come from the browser's secure random generator (no look-alike characters). You see the passkey **once**, on the "Your team is ready!" screen.
- **Join** asks CometChat to join those groups with the room code and passkey. CometChat's server checks the passkey, so a room code on its own never lets anyone in. Joining twice does not add a second membership.
- **Copy invitation** copies the team name, room code, passkey (only on the device that just created the team) and joining steps. There is no invitation link: a link would put the passkey in a URL.
- **Your teams** (on the landing page) lists the teams your account has really joined, from CometChat itself. The team you were in is reopened after a refresh in the same tab.
- Chat, shared slides, cursors, voice rooms and the "call a teammate" list are all scoped to the open team.
- The shared room that existed before teams appears as "Our team room" only for accounts that had already joined it.
- First-time visitors type a display name; the sign-in server creates their CometChat user (see "Sign-in server").
- Limits you should know: CometChat cannot read a passkey back, so only the creator's screen can show it. The wrong-attempt counter in the form is a courtesy, real rate limiting is CometChat's. Cursor/presence messages go to everyone in the team's data group.
- Development only: `?dev=memory&as=dev-user-1&name=Asha&team=DEV234` opens a built-in test team in the dev test mode (two tabs of one browser act as two people). That mode is not CometChat and is not in a production build.

## Sign-in server

CometChat's documented production flow: your server creates users and auth tokens with a **REST API key**, and the browser logs in with `CometChatUIKit.loginWithAuthToken(token)`. The Auth Key is no longer used or read anywhere in the web app.

```
Browser                         OGSlides server (server/)                CometChat
  | POST /api/auth/register {name} -> | validates, makes uid "og-<random>"  |
  |                                   | POST /v3/users (apikey: REST key) -> |
  | <- uid, authToken, deviceSecret   | <- authToken                         |
  | loginWithAuthToken(authToken) -------------------------------------------> |
  (next visit)
  | POST /api/auth/login {uid, deviceSecret} -> checks the secret, then       |
  |                                   | POST /v3/users/{uid}/auth_tokens ->  |
  | <- authToken                                                              |
```

- **The server picks the user id.** A visitor can't choose or take someone else's id.
- **Device secret.** At sign-up the server gives the browser `HMAC(server secret, uid)`. To get a new token the browser must send it back. Knowing a user id alone is useless. The server stores nothing (it recomputes the HMAC), so there is no database to run. Trade-off: one account can't be revoked on its own; changing `OGS_SESSION_SECRET` signs everybody out.
- **Checks:** JSON only, 2 KB limit, strict id/secret formats, name 1-40 characters, an allow-list of web addresses (CORS), no cookies (so no CSRF).
- **Rate limits (in memory):** sign-up 5/hour per address and 200/hour overall; sign-in 30 per 10 minutes per address and 10 per 10 minutes per account. If you run several copies of the server, add a shared limiter or your host's own.
- **Demo accounts** (`cometchat-uid-1..5`) are shared, so they only work when `ALLOW_DEMO_ACCOUNTS=true`. Keep it `false` in public.
- Errors and logs never contain the REST key, tokens, secrets or names.

CometChat dashboard: copy your **App ID** and **Region** (public), and create a **REST API Key** with *fullAccess* scope (Dashboard, your app, API & Auth Keys). It goes only in `server/.env`. Optionally delete the old Auth Key after the switch.

Deploying: host `server/` on any Node 20+ service. Set the same settings as environment variables on the host (not in a file), `OGS_ALLOWED_ORIGINS` to your site's address, and `TRUST_PROXY=true` only behind one trusted proxy. Either serve the site and `/api` from the same address, or build the site with `VITE_AUTH_API_URL` set to the server's address.

## Security: what is left

- **Device secret in localStorage.** Any script running on the page could read it. Don't add untrusted scripts. A stricter design would use an HttpOnly cookie session or real user accounts (email login) on the server.
- **No real accounts.** A browser that clears its storage loses its identity (and its teams' passkey-less access). There is no recovery flow.
- **Team passkeys** are checked by CometChat's server; OGSlides never stores them. Brute-force protection for passkeys comes from CometChat. Check your plan's limits.
- **Old accounts** made before this change (browser-created, no device secret) can't sign in; they start fresh.
- **Dependencies.** `npm audit` reports 2 moderate issues in DOMPurify inside the CometChat UI Kit. Update `@cometchat/chat-uikit-react` when a fix is published.
- Never commit `.env` or `server/.env` (both are git-ignored).

## Visual identity: Playful Studio

- Tokens and the whole look live in `src/styles/studio.css`, loaded last in `src/main.jsx`. Palette: deep-purple ink `#2b1b4d`, lavender paper, electric purple `#6a3df0`, coral pink `#ff5c8a`, butter `#ffd84a`, mint `#6fe0b0`, sky `#5bc0ff`, orange `#ff8a3d`. Colours have jobs: purple = primary/selected, pink = create, mint = done/saved, orange = attention (overdue, doing), sky = info.
- Cursor: a small paper-plane cursor on mouse devices only (native cursor stays in text fields, the slide canvas and handles), a short sparkle trail and a star burst when you create a deck (`src/ui/clickBurst.js`). All of it is off for touch and for `prefers-reduced-motion`.
- Counters count up (`src/ui/useCountUp.js`); all motion is CSS transform/opacity and stops under reduced motion.
- Mascot "Pip" (`src/ui/Mascot.jsx`) and the welcome screen (`src/session/Welcome.jsx`) carry the personality.
- Optional alternate theme: `src/styles/editorial.css` (navy/ivory/burgundy) is kept but not loaded. To try it, import it instead of `studio.css` in `main.jsx` (use one theme layer only). Its Welcome/Mascot/Logo variants are not kept; only the CSS.
- Home (`src/pages/Home.jsx`): New deck, four colour-coded counters, recent decks, small task/resource/decision lists, and a compact "Make decks together" strip.
- Development only: `?preview=welcome|connecting|error|nokeys` shows first-screen states without CometChat keys.
- Tests: `npm.cmd test`.

## Live slide cursors and voice notes

- Teammates in the same presentation see each other's pointer (with name and colour) on the slide, and the element each has selected is outlined in their colour. The editor header shows a chip per person: colour dot, name, "You", and "Away" when their tab is in the background. Code: `src/workspace/cursors.js`, `src/slides/SlideCursors.jsx`, `src/components/CollabBar.jsx`. Cursor positions travel as fractions of the slide over CometChat's live "transient message" channel (not saved, not part of the edit history). They are only sent while someone else is in the same presentation.
- Voice notes are shown by OGSlides' own player (`src/components/VoiceBubble.jsx`, registered through `src/cometchat/audioPlugin.jsx`). It plays the stored file with a normal audio element, shows play/pause, a waveform, seek bar, time and a retry/download option on failure. `npm.cmd run dev` then open `?preview=voice` to see it without CometChat.
- Tests: `npm.cmd test` (includes `test/cursors.test.mjs`).
