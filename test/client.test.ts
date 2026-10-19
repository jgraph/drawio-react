import { afterEach, describe, expect, it, vi } from "vitest";
import { DrawioClient, DrawioError, parseEvent } from "../src/client";
import { buildEditorUrl } from "../src/url";
import { createFrame, lastAction, ORIGIN, receive, spyOnFrame, state } from "./helpers";

const URL = buildEditorUrl();
const clients: DrawioClient[] = [];

function createClient(options: Partial<ConstructorParameters<typeof DrawioClient>[1]> = {})
{
  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  const client = new DrawioClient(iframe, { url: URL, ...options });
  clients.push(client);

  // After the URL is set, which replaces the window of the iframe
  return { iframe, sent: spyOnFrame(iframe), client };
}

/** Starts the editor: init, then the response to the initial load. */
function start(iframe: HTMLIFrameElement, sent: Array<Record<string, any>>, xml = "<mxfile/>")
{
  receive(iframe, { event: "init" });
  const load = lastAction(sent, "load")!;
  receive(iframe, { event: "load", xml, ...state });

  return load;
}

afterEach(() =>
{
  clients.splice(0).forEach((client) => client.close());
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("DrawioClient", () =>
{
  it("sets the URL of the iframe and posts only to the origin of the editor", () =>
  {
    const { iframe, sent } = createClient();

    expect(iframe.getAttribute("src")).toBe(URL);
    receive(iframe, { event: "init" });
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.every((m) => m.targetOrigin == ORIGIN)).toBe(true);
  });

  it("only loads http and https URLs", () =>
  {
    const iframe = document.createElement("iframe");

    for (const url of ["javascript:alert(1)", "data:text/html,<p>", "blob:https://example.com/1"])
    {
      expect(() => new DrawioClient(iframe, { url })).toThrow();
    }

    expect(iframe.hasAttribute("src")).toBe(false);
  });

  it("loads its URL again when another page in the iframe starts the editor", () =>
  {
    const { iframe, sent, client } = createClient();
    start(iframe, sent);
    const setAttribute = vi.spyOn(iframe, "setAttribute");
    const loads = sent.filter((m) => m.action == "load").length;

    // E.g. a link with target _self to another URL of the editor
    receive(iframe, { event: "configure" });
    expect(setAttribute).toHaveBeenCalledWith("src", URL);
    expect(lastAction(sent, "configure")).toBeUndefined();
    expect(client.ready).toBe(false);

    const frameSent = spyOnFrame(iframe);
    receive(iframe, { event: "init" });
    expect(sent.filter((m) => m.action == "load").length).toBe(loads);
    expect(lastAction(frameSent, "load")).toBeDefined();
  });

  it("does not reload an iframe that already has the URL", () =>
  {
    const { iframe } = createFrame();
    iframe.setAttribute("src", URL);
    const setAttribute = vi.spyOn(iframe, "setAttribute");
    clients.push(new DrawioClient(iframe, { url: URL }));

    expect(setAttribute).not.toHaveBeenCalled();
  });

  it("loads an empty diagram after init by default", () =>
  {
    const { iframe, sent } = createClient();
    receive(iframe, { event: "init" });

    expect(lastAction(sent, "remoteInvokeReady")).toBeDefined();
    expect(lastAction(sent, "load")).toMatchObject({ action: "load" });
  });

  it("answers configure with the configuration", () =>
  {
    const { iframe, sent } = createClient({ config: { defaultFonts: ["Humor Sans"] } });
    receive(iframe, { event: "configure" });

    expect(lastAction(sent, "configure")).toMatchObject({ config: { defaultFonts: ["Humor Sans"] } });
  });

  it("ignores messages from other windows and origins", () =>
  {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onEvent = vi.fn();
    const { iframe } = createClient({ onEvent });
    const other = createFrame().iframe;

    receive(iframe, { event: "init" }, ORIGIN, other.contentWindow);
    receive(iframe, { event: "init" }, ORIGIN, window);
    receive(iframe, { event: "init" }, ORIGIN, null);
    receive(iframe, { event: "init" }, "https://embed.diagrams.net.example.com");
    receive(iframe, { event: "init" }, "https://example.com");
    receive(iframe, { event: "init" }, "https://example.com");

    expect(onEvent).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("keeps two editors on one page apart", () =>
  {
    const a = createClient({ onEvent: vi.fn() });
    const b = createClient({ onEvent: vi.fn() });
    receive(a.iframe, { event: "save", xml: "<a/>", ...state });

    expect(a.client["options"].onEvent).toHaveBeenCalledTimes(1);
    expect(b.client["options"].onEvent).not.toHaveBeenCalled();
  });

  it("ignores messages that are not JSON objects with an event", () =>
  {
    expect(parseEvent("ready")).toBeNull();
    expect(parseEvent("[1]")).toBeNull();
    expect(parseEvent("null")).toBeNull();
    expect(parseEvent({ event: "init" })).toBeNull();
    expect(parseEvent("{\"event\":1}")).toBeNull();
    expect(parseEvent("{\"event\":\"init\"}")).toEqual({ event: "init" });
    expect(parseEvent("{\"error\":\"unknownMessage\",\"data\":\"{}\"}")).toEqual({ event: "unknownMessage", data: "{}" });
  });

  it("does not let JSON keys change prototypes", () =>
  {
    const event = parseEvent("{\"event\":\"save\",\"__proto__\":{\"polluted\":true}}");

    expect(event).not.toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("queues requests until the first diagram is loaded", async () =>
  {
    const { iframe, sent, client } = createClient();
    const xml = client.getXml();
    client.status({ message: "Hello" });

    receive(iframe, { event: "init" });
    expect(lastAction(sent, "export")).toBeUndefined();
    expect(lastAction(sent, "status")).toBeUndefined();

    receive(iframe, { event: "load", xml: "<mxfile/>", ...state });
    const request = lastAction(sent, "export")!;
    expect(request).toMatchObject({ format: "xml" });
    expect(lastAction(sent, "status")).toMatchObject({ message: "Hello" });
    expect(client.ready).toBe(true);

    receive(iframe, { event: "export", format: "xml", xml: "<mxfile id=\"1\"/>", message: request, ...state });
    await expect(xml).resolves.toBe("<mxfile id=\"1\"/>");
  });

  it("sends loads and templates requested before init after the initial diagram", async () =>
  {
    const { iframe, sent, client } = createClient({ onInit: (c) => c.load({ xml: "<a/>" }).catch(() => {}) });
    const early = client.load({ xml: "<b/>" });
    client.showTemplates();
    expect(sent).toHaveLength(0);

    receive(iframe, { event: "init" });
    expect(sent.filter((m) => m.action == "load").map((m) => m.xml)).toEqual(["<a/>", "<b/>"]);
    expect(lastAction(sent, "template")).toBeDefined();

    let settled = false;
    early.then(() => settled = true, () => settled = true);
    receive(iframe, { event: "load", xml: "<a/>", ...state });
    await Promise.resolve();
    expect(settled).toBe(false);

    receive(iframe, { event: "load", xml: "<b/>", ...state });
    await expect(early).resolves.toMatchObject({ xml: "<b/>" });
  });

  it("resolves the load request with the load event", async () =>
  {
    const { iframe, sent, client } = createClient({ onInit: () => {} });
    receive(iframe, { event: "init" });
    const result = client.load({ xml: "<mxfile/>", autosave: true, noExitBtn: true, fit: false });
    const request = lastAction(sent, "load")!;

    expect(request).toMatchObject({ xml: "<mxfile/>", autosave: true, noExitBtn: "1" });
    expect("fit" in request).toBe(false);

    receive(iframe, { event: "load", xml: "<mxfile/>", ...state });
    await expect(result).resolves.toMatchObject({ event: "load", xml: "<mxfile/>" });
  });

  it("matches responses that arrive out of order", async () =>
  {
    const { iframe, sent, client } = createClient();
    start(iframe, sent);

    const png = client.export({ format: "png" });
    const svg = client.export({ format: "svg" });
    const [pngRequest, svgRequest] = sent.filter((m) => m.action == "export");

    receive(iframe, { event: "export", format: "svg", data: "data:svg", message: svgRequest, ...state });
    receive(iframe, { event: "export", format: "png", data: "data:png", message: pngRequest, ...state });

    await expect(png).resolves.toMatchObject({ data: "data:png" });
    await expect(svg).resolves.toMatchObject({ data: "data:svg" });
  });

  it("does not take an export from the UI as the response to a request", async () =>
  {
    vi.useFakeTimers();
    const onEvent = vi.fn();
    const { iframe, sent, client } = createClient({ onEvent, requestTimeout: 1000 });
    start(iframe, sent);

    const result = client.export({ format: "png" });
    receive(iframe, { event: "export", format: "png", data: "data:ui", filename: "diagram.png" });

    expect(onEvent).toHaveBeenLastCalledWith(expect.objectContaining({ filename: "diagram.png" }));
    vi.advanceTimersByTime(1000);
    await expect(result).rejects.toMatchObject({ code: "timeout" });
  });

  it("rejects with the error of the editor", async () =>
  {
    const { iframe, sent, client } = createClient();
    start(iframe, sent);

    const result = client.merge("<mxfile/>");
    receive(iframe, { event: "merge", error: "Invalid file", message: lastAction(sent, "merge") });

    const error = await result.catch((e) => e);
    expect(error).toBeInstanceOf(DrawioError);
    expect(error).toMatchObject({ code: "editor", message: "Invalid file" });
    expect(error.event).toMatchObject({ event: "merge" });
  });

  it("times out requests that wait for a diagram that does not load", async () =>
  {
    vi.useFakeTimers();
    const { iframe, sent, client } = createClient({ requestTimeout: 1000 });
    const xml = client.getXml();
    receive(iframe, { event: "init" });
    receive(iframe, { event: "load", error: "Parse error", message: lastAction(sent, "load") });

    vi.advanceTimersByTime(1000);
    await expect(xml).rejects.toMatchObject({ code: "timeout" });

    receive(iframe, { event: "load", xml: "<mxfile/>", ...state });
    expect(lastAction(sent, "export")).toBeUndefined();
  });

  it("rejects waiting requests when it is closed and keeps them when the editor restarts", async () =>
  {
    const { iframe, sent, client } = createClient();
    receive(iframe, { event: "init" });
    const fit = client.fit();
    client.reload();
    const frameSent = spyOnFrame(iframe);
    receive(iframe, { event: "init" });
    receive(iframe, { event: "load", xml: "<mxfile/>", ...state });
    expect(lastAction(frameSent, "fit")).toBeDefined();
    receive(iframe, { event: "fit", ...state, message: lastAction(frameSent, "fit") });
    await expect(fit).resolves.toMatchObject({ event: "fit" });

    const xml = client.getXml();
    client.close();
    await expect(xml).rejects.toMatchObject({ code: "closed" });
    expect(sent.length).toBeGreaterThan(0);
  });

  it("rejects requests the editor would not answer", async () =>
  {
    const { iframe, sent, client } = createClient();
    start(iframe, sent);

    await expect(client.merge("")).rejects.toMatchObject({ code: "invalid" });
    await expect(client.resetDiff()).rejects.toMatchObject({ code: "invalid" });
  });

  it("returns the value of a prompt, or null if it was cancelled", async () =>
  {
    const { iframe, sent, client } = createClient();
    start(iframe, sent);

    const name = client.prompt({ title: "Name" });
    receive(iframe, { event: "prompt", value: "Diagram", message: lastAction(sent, "prompt") });
    await expect(name).resolves.toBe("Diagram");

    const cancelled = client.prompt({ title: "Name" });
    receive(iframe, { event: "prompt-cancel", message: lastAction(sent, "prompt") });
    await expect(cancelled).resolves.toBeNull();
  });

  it("rejects pending requests when the editor restarts", async () =>
  {
    const { iframe, sent, client } = createClient();
    start(iframe, sent);

    const result = client.fit();
    receive(iframe, { event: "init" });

    await expect(result).rejects.toMatchObject({ code: "restarted" });
    expect(client.ready).toBe(false);
  });

  it("loads the template that the user selected", () =>
  {
    const { iframe, sent } = createClient({
      onInit: (client) => client.showTemplates({ templatesOnly: true }, { autosave: true })
    });
    receive(iframe, { event: "init" });

    expect(lastAction(sent, "template")).toMatchObject({ callback: true, templatesOnly: true });
    receive(iframe, { event: "template", xml: "<mxfile>t</mxfile>", builtIn: true, message: lastAction(sent, "template") });
    expect(lastAction(sent, "load")).toMatchObject({ xml: "<mxfile>t</mxfile>", autosave: true });
  });

  it("answers remote calls with own functions only", async () =>
  {
    const getRecentDiagrams = vi.fn(async () => [[{ url: "https://example.com/a.drawio", title: "A" }]]);
    const { iframe, sent } = createClient({ remoteFunctions: { getRecentDiagrams } });
    start(iframe, sent);

    receive(iframe, { event: "remoteInvoke", funtionName: "getRecentDiagrams", functionArgs: [null], msgMarkers: { callbackId: 1 } });
    receive(iframe, { event: "remoteInvoke", funtionName: "constructor", functionArgs: [], msgMarkers: { callbackId: 2 } });
    await vi.waitFor(() => expect(sent.filter((m) => m.action == "remoteInvokeResponse")).toHaveLength(2));

    const responses = sent.filter((m) => m.action == "remoteInvokeResponse");
    const first = responses.find((m) => m.msgMarkers.callbackId == 1);
    const second = responses.find((m) => m.msgMarkers.callbackId == 2);
    expect(getRecentDiagrams).toHaveBeenCalledWith(null);
    expect(first).toMatchObject({ msgMarkers: { callbackId: 1 }, resp: [[{ title: "A" }]] });
    expect(second).toMatchObject({ msgMarkers: { callbackId: 2 }, error: { errResp: "No remote function constructor" } });
  });

  it("stops listening when detached and rejects requests when closed", async () =>
  {
    const onEvent = vi.fn();
    const { iframe, sent, client } = createClient({ onEvent });
    start(iframe, sent);
    onEvent.mockClear();

    client.detach();
    receive(iframe, { event: "save", xml: "<mxfile/>", ...state });
    expect(onEvent).not.toHaveBeenCalled();

    client.attach();
    receive(iframe, { event: "save", xml: "<mxfile/>", ...state });
    expect(onEvent).toHaveBeenCalledTimes(1);

    const result = client.fit();
    client.close();
    await expect(result).rejects.toMatchObject({ code: "closed" });
    await expect(client.fit()).rejects.toMatchObject({ code: "closed" });
  });
});
