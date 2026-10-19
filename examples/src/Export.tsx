import { useRef } from "react";
import { DrawioEditor, type DrawioEditorHandle } from "@drawio/react";

// Your own buttons call the editor through a ref.
export default function Export()
{
  const editor = useRef<DrawioEditorHandle>(null);

  async function download(format: "png" | "svg" | "xmlsvg")
  {
    const result = await editor.current!.export({ format });
    const link = document.createElement("a");
    link.href = result.data as string;
    link.download = (format == "xmlsvg") ? "diagram.drawio.svg" : "diagram." + format;
    link.click();
  }

  async function downloadXml()
  {
    const xml = await editor.current!.getXml();
    const link = document.createElement("a");
    link.href = "data:application/xml;charset=utf-8," + encodeURIComponent(xml);
    link.download = "diagram.drawio";
    link.click();
  }

  return (
    <>
      <div className="toolbar">
        <button onClick={() => download("png")}>PNG</button>
        <button onClick={() => download("svg")}>SVG</button>
        <button onClick={() => download("xmlsvg")}>Editable SVG</button>
        <button onClick={downloadXml}>.drawio</button>
      </div>
      <div style={{ height: 600 }}>
        <DrawioEditor ref={editor} urlParameters={{ noSaveBtn: true, saveAndExit: false, noExitBtn: true }} />
      </div>
    </>
  );
}
