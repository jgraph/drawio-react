import { useState } from "react";
import { DrawioEditor, type UrlParameters } from "@drawio/react";

// URL parameters change the look of the editor. A change reloads it with
// the diagram. The configuration customises fonts, colours, styles and
// shape libraries:
// https://www.drawio.com/docs/reference/configure-diagram-editor
export default function Options()
{
  const [ui, setUi] = useState<UrlParameters["ui"]>("kennedy");
  const [dark, setDark] = useState<UrlParameters["dark"]>("auto");
  const [lang, setLang] = useState("en");

  return (
    <>
      <div className="toolbar">
        <select value={ui} onChange={(e) => setUi(e.target.value as UrlParameters["ui"])}>
          <option value="kennedy">Default</option>
          <option value="min">Minimal</option>
          <option value="atlas">Atlas</option>
          <option value="sketch">Sketch</option>
          <option value="simple">Simple</option>
        </select>
        <select value={String(dark)} onChange={(e) => setDark((e.target.value == "auto") ? "auto" : e.target.value == "true")}>
          <option value="auto">Light or dark like the system</option>
          <option value="false">Light</option>
          <option value="true">Dark</option>
        </select>
        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="en">English</option>
          <option value="de">Deutsch</option>
          <option value="fr">Français</option>
          <option value="ja">日本語</option>
        </select>
      </div>
      <div style={{ height: 600 }}>
        <DrawioEditor
          urlParameters={{ ui, dark, lang, libraries: true }}
          config={{
            defaultLibraries: "general;flowchart",
            presetColors: ["E6F4EA", "FCE8E6", "E8F0FE", "FEF7E0"],
            defaultVertexStyle: { rounded: "1" }
          }}
        />
      </div>
    </>
  );
}
