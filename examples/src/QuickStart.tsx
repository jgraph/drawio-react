import { useState } from "react";
import { DrawioEditor } from "@drawio/react";

// The editor loads `xml` and calls onSave when the user clicks Save.
export default function QuickStart()
{
  const [xml, setXml] = useState<string>();

  return (
    <div style={{ height: 600 }}>
      <DrawioEditor
        xml={xml}
        onSave={(event) => setXml(event.xml)}
      />
    </div>
  );
}
