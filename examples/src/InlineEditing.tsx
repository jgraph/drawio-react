import { useRef, useState } from "react";
import { DrawioEditor, type DrawioEditorHandle, type DrawioEvent } from "@drawio/react";

// Edits a diagram image in place, like draw.io for Notion: the editor opens
// over the image (embedInline). The iframe covers the window and stays
// hidden until an image is edited. Press Escape to stop editing.
export default function InlineEditing()
{
  const [image, setImage] = useState<string>();
  const [editing, setEditing] = useState(false);
  const editor = useRef<DrawioEditorHandle>(null);
  const target = useRef<HTMLDivElement>(null);

  function edit()
  {
    const r = target.current!.getBoundingClientRect();
    const border = 8;
    setEditing(true);

    editor.current!.load({
      xml: image,
      border,
      rect: { left: r.left - border, top: r.top - border, width: r.width + 2 * border, height: r.height + 2 * border },
      minWidth: Math.min(600, innerWidth - 60),
      minHeight: Math.min(400, innerHeight - 60),
      maxFitScale: 1.5,
      viewport: { x: 0, y: 0, width: innerWidth, height: innerHeight },
      // The image shows the diagram in the light or dark mode of the page
      theme: "auto"
    });
  }

  function handleEvent(event: DrawioEvent)
  {
    if (event.event == "export" && event.exit)
    {
      // The edited diagram as an SVG with the diagram inside
      setImage(event.data as string);
      setEditing(false);
    }
    else if (event.event == "exit")
    {
      setEditing(false);
    }
    else if (event.event == "resize")
    {
      // The editor asks to go fullscreen or back
      editor.current!.fullscreenChanged(event.fullscreen);
    }
  }

  return (
    <>
      <div ref={target} className="inline-target" onClick={edit} title="Click to edit">
        {(image != null) ? <img src={image} alt="Diagram" /> : <span>Click to draw a diagram</span>}
      </div>

      <DrawioEditor
        ref={editor}
        urlParameters={{ embedInline: true, dark: "auto" }}
        onEvent={handleEvent}
        style={{
          position: "fixed", inset: 0, zIndex: 10, background: "transparent",
          visibility: editing ? "visible" : "hidden"
        }}
      />
    </>
  );
}
