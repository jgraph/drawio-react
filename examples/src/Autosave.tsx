import { useRef, useState } from "react";
import { DrawioEditor, type DrawioEditorHandle } from "@drawio/react";

const KEY = "drawio-example";

// Saves every change in the browser's local storage. Reload the page: the
// diagram is still there. Replace localStorage with a call to your backend.
export default function Autosave()
{
  const [xml] = useState(() => localStorage.getItem(KEY) ?? undefined);
  const editor = useRef<DrawioEditorHandle>(null);

  return (
    <div style={{ height: 600 }}>
      <DrawioEditor
        ref={editor}
        xml={xml}
        autosave
        onAutosave={(event) =>
        {
          localStorage.setItem(KEY, event.xml!);
          // Stored: the editor does not ask before the page is left
          editor.current!.setModified(false);
        }}
        // Hides the Save, Save and Exit and Exit buttons
        urlParameters={{ noSaveBtn: true, saveAndExit: false, noExitBtn: true }}
      />
    </div>
  );
}
