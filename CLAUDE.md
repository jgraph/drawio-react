# drawio-react

`@drawio/react`: the draw.io editor as a React component. Runs the editor in
an iframe in embed mode (`embed=1&proto=json`) and wraps the JSON protocol in
typed props, events and methods. Docs: https://www.drawio.com/react (the
`/react` page in the private `jgraph/drawusaurus` repo).

The focus is getting started quickly: examples people copy into their app.
Keep the API small and the examples short; protocol depth belongs in the
embed mode reference (`docs/reference/embed-mode.md` in drawusaurus).

## Layout

- `src/protocol.ts`: types of every action and event. The source of truth is
  `EditorUi.prototype.installMessageHandler` in jgraph/drawio
  (`src/main/webapp/js/diagramly/EditorUi.js`), not the docs (they had the
  `draft` results capitalised and listed `publishClose` as a load option).
- `src/client.ts`: `DrawioClient`, framework-agnostic.
- `src/DrawioEditor.tsx`: the React component, a thin layer over the client.
- `src/url.ts`: `buildEditorUrl`.
- `examples/src/*.tsx`: one example per file, imported as `@drawio/react`
  (aliased to `src/` by `examples/vite.config.ts`). The drawusaurus page
  shows the same code: change both.
- `test/*.test.ts(x)`: Vitest with jsdom. `test/e2e/run.mjs`: the real editor
  in headless Chrome for Testing, the protocol scenarios of `test/e2e/app`
  and every example (`test/e2e/examples.mjs`).

## Invariants

- **Messages:** accept only `evt.source === iframe.contentWindow` and
  `evt.origin` equal to the origin of the editor URL; post only with that
  origin as `targetOrigin`, never `"*"`. Several editors on one page must not
  see each other's messages.
- **Editor URL:** only `http:` and `https:` (`parseEditorUrl`, used by
  `buildEditorUrl` and the `DrawioClient` constructor): a `javascript:`
  iframe URL runs in the host's origin, a `data:` URL has origin `"null"`.
- **Unexpected start:** a `configure` or `init` the client did not cause
  (a link in the diagram opened another page of the editor's origin in the
  iframe) makes the client load its own URL again (`reload`), so the
  editor never runs without the host's URL parameters.
- **URL change (React):** the old editor gets `setModified(false)` (no
  prompt for unsaved changes when the iframe navigates) and `getXml()`,
  then the reloaded editor loads that diagram. Restarts load the last
  diagram the editor reported, not stale props.
- **Listener before URL:** the client sets the iframe `src` after it listens,
  so it cannot miss `init`. The component renders the iframe without `src`
  (SSR-safe) and lets the client set it in a layout effect.
- **Unmount (React):** the client closes in a `setTimeout(0)` that the
  next effect run cancels, so strict mode keeps it and a real unmount
  rejects pending requests.
- **Requests:** responses are matched by the `requestId` the client adds,
  which the editor echoes in `message`. Only the `load` response lacks the
  echo (except for descriptors). Reject requests the editor would never
  answer (`merge` without data, `resetDiff` without diff sync) instead of
  letting them time out.
- **Iframe color scheme:** the default style has `colorScheme: "normal"`,
  the scheme of the editor page. A frame whose scheme differs from its
  document gets an opaque backdrop, which hides dark pages behind the
  inline editor and flashes white while the editor loads.
- **Remote functions:** look names up with `hasOwnProperty` only.
- **Clean room:** do not read the source of other draw.io React wrappers
  (react-drawio and its forks). Their READMEs and issue titles are fine.

## Testing

```bash
npm test && npm run typecheck && npm run build
DRAWIO_URL=https://test.draw.io/?dev=1 npm run test:e2e
```

The examples (`npm run examples`) use embed.diagrams.net,
`http://localhost:5173/?dev=1` uses `https://test.draw.io/?dev=1` (the local
draw.io), and `DRAWIO_URL` overrides both (`examples/dev-editor.tsx`).

embed.diagrams.net answers 403 to headless Chrome, so run the e2e tests
against a local draw.io (`src/main/webapp` of jgraph/drawio over http; CI
uses a sparse checkout). It also refuses embedding pages on a port other
than 80 and 443, except localhost, and some sites; a self-hosted draw.io has
no such limits. These refusals are draw.io's policy: never work around them
(no `referrerpolicy="no-referrer"` on the iframe, no user agent tricks).

TypeScript is pinned to 6.x: tsup's declaration build needs the compiler API,
which TypeScript 7 does not have.

## Style

2-space indentation, braces on their own line, double quotes, like
jgraph/drawio-mcp. Comments say why, briefly.
