import { StrictMode, createRef } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrawioEditor, type DrawioEditorHandle } from "../src/DrawioEditor";
import { lastAction, receive, spyOnFrame, state } from "./helpers";

afterEach(() =>
{
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Renders the editor and records what it sends to the iframe. */
function renderEditor(element: React.ReactElement)
{
  const result = render(element);
  const iframe = result.container.querySelector("iframe")!;
  const sent = spyOnFrame(iframe);

  return { ...result, iframe, sent: () => sent };
}

describe("DrawioEditor", () =>
{
  it("renders an iframe that fills its container", () =>
  {
    const { iframe } = renderEditor(<DrawioEditor urlParameters={{ ui: "min" }} />);

    expect(iframe.title).toBe("draw.io editor");
    expect(iframe.style.width).toBe("100%");
    expect(iframe.getAttribute("allow")).toContain("clipboard-write");
    expect(new URL(iframe.src).searchParams.get("ui")).toBe("min");
  });

  it("loads the xml prop with the load options when the editor starts", () =>
  {
    const { iframe, sent } = renderEditor(
      <DrawioEditor xml="<mxfile>a</mxfile>" autosave loadOptions={{ title: "A" }} />);
    act(() => receive(iframe, { event: "init" }));

    expect(lastAction(sent(), "load")).toMatchObject({ xml: "<mxfile>a</mxfile>", autosave: true, title: "A" });
  });

  it("calls the callbacks of the events", () =>
  {
    const onLoad = vi.fn();
    const onSave = vi.fn();
    const onEvent = vi.fn();
    const { iframe } = renderEditor(<DrawioEditor onLoad={onLoad} onSave={onSave} onEvent={onEvent} />);

    act(() =>
    {
      receive(iframe, { event: "init" });
      receive(iframe, { event: "load", xml: "<mxfile/>", ...state });
      receive(iframe, { event: "save", xml: "<mxfile>s</mxfile>", ...state });
    });

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ xml: "<mxfile>s</mxfile>" }));
    expect(onEvent).toHaveBeenCalledTimes(3);
  });

  it("loads a new xml prop but not the diagram the editor reported", () =>
  {
    const { iframe, sent, rerender } = renderEditor(<DrawioEditor xml="<mxfile>a</mxfile>" />);

    act(() =>
    {
      receive(iframe, { event: "init" });
      receive(iframe, { event: "load", xml: "<mxfile>a</mxfile>", ...state });
      receive(iframe, { event: "autosave", xml: "<mxfile>b</mxfile>", ...state });
    });

    const loads = () => sent().filter((m) => m.action == "load").length;
    rerender(<DrawioEditor xml="<mxfile>b</mxfile>" />);
    expect(loads()).toBe(1);

    rerender(<DrawioEditor xml="<mxfile>c</mxfile>" />);
    expect(loads()).toBe(2);
    expect(lastAction(sent(), "load")).toMatchObject({ xml: "<mxfile>c</mxfile>" });
  });

  it("shows the templates when there is no diagram", () =>
  {
    const { iframe, sent } = renderEditor(<DrawioEditor templates={{ templatesOnly: true }} />);
    act(() => receive(iframe, { event: "init" }));

    expect(lastAction(sent(), "template")).toMatchObject({ callback: true, templatesOnly: true });
    expect(lastAction(sent(), "load")).toBeUndefined();
  });

  it("sends the config when the editor asks for it", () =>
  {
    const { iframe, sent } = renderEditor(<DrawioEditor config={{ defaultFonts: ["Humor Sans"] }} />);

    expect(new URL(iframe.src).searchParams.get("configure")).toBe("1");
    act(() => receive(iframe, { event: "configure" }));
    expect(lastAction(sent(), "configure")).toMatchObject({ config: { defaultFonts: ["Humor Sans"] } });
  });

  it("forwards the methods of the ref to the editor", async () =>
  {
    const ref = createRef<DrawioEditorHandle>();
    const { iframe, sent } = renderEditor(<DrawioEditor ref={ref} />);

    act(() =>
    {
      receive(iframe, { event: "init" });
      receive(iframe, { event: "load", xml: "<mxfile/>", ...state });
    });

    const result = ref.current!.export({ format: "svg" });
    const request = lastAction(sent(), "export")!;
    act(() => receive(iframe, { event: "export", format: "svg", data: "data:image/svg+xml,", message: request, ...state }));

    await expect(result).resolves.toMatchObject({ data: "data:image/svg+xml," });
    expect(ref.current!.client).not.toBeNull();
  });

  it("starts once in strict mode", () =>
  {
    const { iframe, sent } = renderEditor(<StrictMode><DrawioEditor xml="<mxfile/>" /></StrictMode>);
    act(() => receive(iframe, { event: "init" }));

    expect(sent().filter((m) => m.action == "load")).toHaveLength(1);
  });

  it("reloads the editor with the current diagram when the URL changes", async () =>
  {
    const { iframe, sent, rerender } = renderEditor(<DrawioEditor xml="<mxfile>a</mxfile>" urlParameters={{ ui: "min" }} />);

    act(() =>
    {
      receive(iframe, { event: "init" });
      receive(iframe, { event: "load", xml: "<mxfile>a</mxfile>", ...state });
    });

    // Asks the old editor for the diagram, and tells it that it is stored
    rerender(<DrawioEditor xml="<mxfile>a</mxfile>" urlParameters={{ ui: "atlas" }} />);
    expect(lastAction(sent(), "status")).toMatchObject({ modified: false });
    const request = lastAction(sent(), "export")!;
    expect(new URL(iframe.src).searchParams.get("ui")).toBe("min");

    await act(async () => receive(iframe, { event: "export", format: "xml", xml: "<mxfile>b</mxfile>", message: request, ...state }));
    expect(new URL(iframe.src).searchParams.get("ui")).toBe("atlas");

    const frameSent = spyOnFrame(iframe);
    act(() => receive(iframe, { event: "init" }));
    expect(lastAction(frameSent, "load")).toMatchObject({ xml: "<mxfile>b</mxfile>" });
  });

  it("closes the client when it is unmounted", async () =>
  {
    vi.useFakeTimers();
    const ref = createRef<DrawioEditorHandle>();
    const { iframe, unmount } = renderEditor(<DrawioEditor ref={ref} />);
    act(() => receive(iframe, { event: "init" }));
    const client = ref.current!.client!;
    const xml = client.getXml();

    unmount();
    vi.advanceTimersByTime(0);
    await expect(xml).rejects.toMatchObject({ code: "closed" });
    expect(client.closed).toBe(true);
  });
});
