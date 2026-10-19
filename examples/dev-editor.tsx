// The examples import @drawio/react from here (see vite.config.ts), so they
// can run with another draw.io: ?dev=1 on the examples page uses the local
// draw.io at https://test.draw.io/?dev=1, and DRAWIO_URL when the server
// starts overrides both.
import { forwardRef } from "react";
import { DrawioEditor as Editor, type DrawioEditorHandle, type DrawioEditorProps } from "../src";

export * from "../src";

declare const __DRAWIO_URL__: string | null;

const DEV_URL = "https://test.draw.io/?dev=1";

const baseUrl = __DRAWIO_URL__ ??
  ((new URLSearchParams(location.search).get("dev") == "1") ? DEV_URL : undefined);

export const DrawioEditor = forwardRef<DrawioEditorHandle, DrawioEditorProps>(
  (props, ref) => <Editor ref={ref} baseUrl={baseUrl} {...props} />);
