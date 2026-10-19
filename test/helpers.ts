import { vi } from "vitest";

export const ORIGIN = "https://embed.diagrams.net";

/** An iframe whose outgoing messages are recorded as parsed objects. */
export function createFrame(): { iframe: HTMLIFrameElement; sent: Array<Record<string, any>> }
{
  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);

  return { iframe, sent: spyOnFrame(iframe) };
}

/** Records the messages posted to the window of the iframe. */
export function spyOnFrame(iframe: HTMLIFrameElement): Array<Record<string, any>>
{
  const sent: Array<Record<string, any>> = [];
  const target = iframe.contentWindow!;

  vi.spyOn(target, "postMessage").mockImplementation(((message: string, targetOrigin: string) =>
  {
    sent.push({ ...JSON.parse(message), targetOrigin });
  }) as typeof target.postMessage);

  return sent;
}

/** Sends a message from the editor in the iframe to the host. */
export function receive(iframe: HTMLIFrameElement, message: unknown,
  origin = ORIGIN, source: Window | null = iframe.contentWindow): void
{
  window.dispatchEvent(new MessageEvent("message", {
    data: (typeof message === "string") ? message : JSON.stringify(message),
    origin,
    source
  }));
}

/** The last action of the given type that was sent to the editor. */
export function lastAction(sent: Array<Record<string, any>>, action: string): Record<string, any> | undefined
{
  return sent.filter((m) => m.action == action).pop();
}

export const state = {
  bounds: { x: 0, y: 0, width: 10, height: 10 },
  modelBounds: { x: 0, y: 0, width: 10, height: 10 },
  scale: 1,
  translate: { x: 0, y: 0 },
  pageVisible: true,
  currentPage: 0,
  page: { x: 0, y: 0, width: 800, height: 1100 },
  containerSize: { width: 800, height: 600, offsetWidth: 800, offsetHeight: 600 }
};
