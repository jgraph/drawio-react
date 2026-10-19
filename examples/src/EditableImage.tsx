import { useRef, useState } from "react";
import { DrawioEditor, type DrawioEditorHandle } from "@drawio/react";

// Stores the diagram as an SVG image with the diagram inside (.drawio.svg),
// like draw.io for Notion. Any page can show the image, and the editor can
// open it again. Click the image to edit it.
export default function EditableImage()
{
  const [image, setImage] = useState<string>();
  const [editing, setEditing] = useState(false);
  const editor = useRef<DrawioEditorHandle>(null);

  async function save(exit?: boolean)
  {
    const result = await editor.current!.export({ format: "xmlsvg" });
    setImage(result.data as string);

    if (exit)
    {
      setEditing(false);
    }
  }

  return (
    <>
      {(image != null) ?
        <img src={image} alt="Diagram" className="diagram" title="Click to edit"
          onClick={() => setEditing(true)} /> :
        <button onClick={() => setEditing(true)}>Insert a diagram</button>}

      {editing &&
        <div className="overlay">
          <DrawioEditor
            ref={editor}
            xml={image}
            // One Save and Exit button and an Exit button
            urlParameters={{ noSaveBtn: true, saveAndExit: true }}
            onSave={(event) => save(event.exit)}
            onExit={() => setEditing(false)}
          />
        </div>}
    </>
  );
}
