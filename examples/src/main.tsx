import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import QuickStart from "./QuickStart";
import Autosave from "./Autosave";
import Export from "./Export";
import EditableImage from "./EditableImage";
import InlineEditing from "./InlineEditing";
import Mermaid from "./Mermaid";
import Templates from "./Templates";
import Options from "./Options";

const examples = {
  "quick-start": { title: "Quick start", component: QuickStart, file: "QuickStart.tsx" },
  "autosave": { title: "Autosave", component: Autosave, file: "Autosave.tsx" },
  "export": { title: "Export", component: Export, file: "Export.tsx" },
  "editable-image": { title: "Editable image", component: EditableImage, file: "EditableImage.tsx" },
  "inline-editing": { title: "Inline editing", component: InlineEditing, file: "InlineEditing.tsx" },
  "mermaid": { title: "Mermaid", component: Mermaid, file: "Mermaid.tsx" },
  "templates": { title: "Templates", component: Templates, file: "Templates.tsx" },
  "options": { title: "Options", component: Options, file: "Options.tsx" }
};

type Name = keyof typeof examples;

function current(): Name
{
  const name = location.hash.substring(1);

  return Object.hasOwn(examples, name) ? name as Name : "quick-start";
}

function App()
{
  const [name, setName] = useState(current);
  const Example = examples[name].component;

  useEffect(() =>
  {
    const update = () => setName(current());
    addEventListener("hashchange", update);

    return () => removeEventListener("hashchange", update);
  }, []);

  return (
    <>
      <nav>
        <strong>draw.io React</strong>
        {Object.entries(examples).map(([key, example]) =>
          <a key={key} href={"#" + key} className={(key == name) ? "active" : undefined}>{example.title}</a>)}
        <a href={"https://github.com/jgraph/drawio-react/blob/main/examples/src/" +
          examples[name].file} target="_blank" rel="noreferrer">Source</a>
      </nav>
      <main>
        <Example key={name} />
      </main>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
