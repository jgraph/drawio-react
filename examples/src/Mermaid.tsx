import { useState } from "react";
import { DrawioEditor, type Descriptor } from "@drawio/react";

const SOURCE = `graph TD
  A[Start] --> B{Ready?}
  B -->|Yes| C[Ship it]
  B -->|No| D[Fix it]
  D --> B`;

// Converts Mermaid to an editable diagram. Use {format: "csv", data} for CSV.
export default function Mermaid()
{
  const [source, setSource] = useState(SOURCE);
  const [descriptor, setDescriptor] = useState<Descriptor>({ format: "mermaid", data: SOURCE });

  return (
    <div className="split">
      <div className="side">
        <textarea value={source} onChange={(e) => setSource(e.target.value)} spellCheck={false} />
        <button onClick={() => setDescriptor({ format: "mermaid", data: source })}>Convert</button>
      </div>
      <DrawioEditor descriptor={descriptor} />
    </div>
  );
}
