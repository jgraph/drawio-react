// Used instead of @drawio/react when DRAWIO_URL is set (see vite.config.ts),
// to run the examples with another draw.io, e.g. a local build.
import { forwardRef } from "react";
import { DrawioEditor as Editor, type DrawioEditorHandle, type DrawioEditorProps } from "../src";

export * from "../src";

declare const __DRAWIO_URL__: string;

export const DrawioEditor = forwardRef<DrawioEditorHandle, DrawioEditorProps>(
  (props, ref) => <Editor ref={ref} baseUrl={__DRAWIO_URL__} {...props} />);
