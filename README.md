# draw.io for React

The [draw.io](https://www.drawio.com) diagram editor as a React component. `@drawio/react` runs the editor in an iframe in [embed mode](https://www.drawio.com/docs/reference/embed-mode) and wraps its message protocol in typed props, events and methods.

Docs and examples: **[drawio.com/react](https://www.drawio.com/react)**

```bash
npm install @drawio/react
```

## Quick start

```tsx
import { useState } from "react";
import { DrawioEditor } from "@drawio/react";

export default function App()
{
  const [xml, setXml] = useState<string>();

  return (
    <div style={{ height: 600 }}>
      <DrawioEditor xml={xml} onSave={(event) => setXml(event.xml)} />
    </div>
  );
}
```

The editor fills its container. It loads `xml` when it starts and calls `onSave` with the diagram when the user clicks _Save_.

## Examples

Each example is one file you can copy into your app.

| Example | What it shows |
|---|---|
| [Quick start](examples/src/QuickStart.tsx) | Load a diagram and get it back on save |
| [Autosave](examples/src/Autosave.tsx) | Store every change, here in local storage |
| [Export](examples/src/Export.tsx) | Your own buttons: PNG, SVG, editable SVG and `.drawio` downloads |
| [Editable image](examples/src/EditableImage.tsx) | Store the diagram as an SVG image that opens again in the editor (`.drawio.svg`) |
| [Inline editing](examples/src/InlineEditing.tsx) | Edit the image in place, like draw.io for Notion |
| [Mermaid](examples/src/Mermaid.tsx) | Convert Mermaid (or CSV) to an editable diagram |
| [Templates](examples/src/Templates.tsx) | Start a new diagram from the template dialog |
| [Options](examples/src/Options.tsx) | Theme, dark mode, language, shape libraries and configuration |

Run them:

```bash
git clone https://github.com/jgraph/drawio-react.git
cd drawio-react
npm install
npm run examples
```

## Props

| Prop | Description |
|---|---|
| `xml` | The diagram: draw.io XML, or a PNG or SVG data URI with an embedded diagram. A new value loads it, unless it is the diagram the editor last reported. |
| `descriptor` | Mermaid, PlantUML or CSV to convert instead: `{format: "mermaid", data}` |
| `autosave` | Calls `onAutosave` after every change |
| `templates` | Shows the template dialog when there is no `xml` |
| `urlParameters` | Look of the editor, e.g. `{ui: "min", dark: "auto", lang: "de", libraries: true}`. `dark: "auto"` follows the light or dark mode of the system. A change reloads the editor with the current diagram. |
| `config` | [Configuration](https://www.drawio.com/docs/reference/configure-diagram-editor): fonts, colours, styles, libraries. Read when the editor starts. |
| `loadOptions` | More options for loading, e.g. `{title, dark, fit, zoomEvents, exportProtocol}` |
| `baseUrl` | URL of a [self-hosted draw.io](https://github.com/jgraph/docker-drawio). Default `https://embed.diagrams.net/` |
| `onLoad`, `onSave`, `onAutosave`, `onExit`, `onExport` | Events of the editor |
| `onEvent` | Every event, typed: `switch (event.event)` |
| `className`, `style`, `title` | For the iframe |

## Methods

Get them with a ref: `const editor = useRef<DrawioEditorHandle>(null)`. Calls made before the editor has loaded wait for it.

| Method | Returns |
|---|---|
| `getXml()` | The diagram |
| `export({format: "png" \| "svg" \| "xmlsvg" \| "xmlpng" \| "json" \| ...})` | The export, `data` is a data URI |
| `load({xml})`, `merge(xml)` | Replace the diagram, or merge changes into it |
| `setModified(false)` | Mark the diagram as saved, e.g. after an autosave |
| `fit()`, `viewbox({x, y, width, height})`, `layout(layouts)` | Change the view or arrange the diagram |
| `prompt({title})`, `dialog({title, message})`, `status({message})`, `spinner({show})` | Talk to the user |
| `invokeAction(name)` | Run an editor action, e.g. `"undo"`, `"zoomIn"`, `"save"` |

All methods and the types of every action and event are in [src/protocol.ts](src/protocol.ts).

## Next.js

The package is marked `"use client"`. Use the editor in a client component:

```tsx
"use client";

import { DrawioEditor } from "@drawio/react";

export default function Diagram()
{
  return <DrawioEditor onSave={(event) => console.log(event.xml)} />;
}
```

## Without React

`DrawioClient` is the same protocol for any framework:

```ts
import { DrawioClient, buildEditorUrl } from "@drawio/react";

const client = new DrawioClient(iframe, {
  url: buildEditorUrl(),
  onInit: (client) => client.load({ xml }),
  onEvent: (event) => console.log(event)
});
```

## The editor shows a 403 error

embed.diagrams.net serves pages on the standard ports of http and https, and on localhost on any port. A page on another port, a headless browser and some sites get a 403 in the frame. For those, run draw.io yourself, for example with the [jgraph/drawio](https://github.com/jgraph/docker-drawio) Docker image, and set `baseUrl`:

```bash
docker run -it --rm -p 8080:8080 jgraph/drawio
```

```tsx
<DrawioEditor baseUrl="http://localhost:8080/" />
```

## Security

The component accepts messages only from its own iframe and the origin of the editor URL, and sends diagrams only to that origin. Several editors on one page do not see each other's messages.

- Set `baseUrl` to a constant or an allowed URL, never to user input: the editor at that origin gets the diagrams and the configuration. It must be an `http` or `https` URL.
- The `href` of `openLink` events comes from the diagram. Check it before you open it.

## Development

```bash
npm test            # unit tests
npm run typecheck
npm run build
DRAWIO_URL=http://localhost:8080/ npm run test:e2e
```

The end-to-end tests run the examples in headless Chrome against a draw.io build that you serve locally (`src/main/webapp` of [jgraph/drawio](https://github.com/jgraph/drawio)). embed.diagrams.net does not serve headless browsers.

## License

[Apache 2.0](LICENSE)
