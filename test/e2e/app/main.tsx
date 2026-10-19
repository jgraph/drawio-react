import { useState } from "react";
import { createRoot } from "react-dom/client";
import { DrawioEditor, type DrawioEditorHandle, type DrawioEvent } from "../../../src";

// Test page driven by run.mjs. ?case= selects the scenario, ?base= the editor URL.
const params = new URLSearchParams(location.search);
const baseUrl = params.get("base") ?? undefined;
const scenario = params.get("case") ?? "basic";

declare global
{
  interface Window
  {
    editors: Record<string, DrawioEditorHandle | null>;
    events: Array<DrawioEvent & { editor: string }>;
    setXml: (xml: string) => void;
  }
}

window.editors = {};
window.events = [];

export const XML_A = "<mxGraphModel><root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/>" +
  "<mxCell id=\"a\" value=\"Alpha\" style=\"rounded=1;\" vertex=\"1\" parent=\"1\">" +
  "<mxGeometry x=\"40\" y=\"40\" width=\"120\" height=\"60\" as=\"geometry\"/></mxCell></root></mxGraphModel>";

export const XML_B = XML_A.replace(/Alpha/g, "Bravo").replace("id=\"a\"", "id=\"b\"");

function Editor(props: { name: string; xml?: string } & Partial<React.ComponentProps<typeof DrawioEditor>>)
{
  const { name, ...rest } = props;

  return (
    <div>
      <DrawioEditor
        ref={(handle) => { window.editors[name] = handle; }}
        baseUrl={baseUrl}
        urlParameters={{ lang: "en" }}
        onEvent={(event) => window.events.push({ ...event, editor: name })}
        {...rest}
      />
    </div>
  );
}

function App()
{
  const [xml, setXml] = useState(XML_A);
  window.setXml = setXml;

  switch (scenario)
  {
    case "two":
      return <><Editor name="a" xml={XML_A} /><Editor name="b" xml={XML_B} /></>;
    case "config":
      return <Editor name="a" xml={XML_A} config={{ defaultFonts: ["Humor Sans"], css: "" }} />;
    case "mermaid":
      return <Editor name="a" descriptor={{ format: "mermaid", data: "graph TD\n  A[Start] --> B[End]" }} />;
    case "csv":
      return <Editor name="a" descriptor={{ format: "csv", data: "## Hello\n# label: %name%\nname\nCsvNode" }} />;
    case "templates":
      return <Editor name="a" templates autosave />;
    default:
      return <Editor name="a" xml={xml} autosave />;
  }
}

createRoot(document.getElementById("root")!).render(<App />);
