import { DrawioEditor } from "@drawio/react";

// A new diagram starts with the template dialog. The selected template is
// loaded with autosave on.
export default function Templates()
{
  return (
    <div style={{ height: 600 }}>
      <DrawioEditor
        templates
        autosave
        onAutosave={(event) => console.log("Diagram changed", event.xml?.length)}
      />
    </div>
  );
}
