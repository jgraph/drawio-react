import type {
  DiagramPatch, DrawioAction, DrawioConfig, DrawioEvent,
  DrawioEventName, DrawioEventOf, ExportAction, FitAction, Layout, LoadAction,
  LoadOptions, PromptAction, DraftAction, Rect, TemplateAction, ViewBox,
  DialogAction, StatusAction, SpinnerAction
} from "./protocol";
import { parseEditorUrl } from "./url";

type Fields<A> = A extends unknown ? Omit<A, "action"> : never;

/** Load options and the diagram, or data to convert. */
export type LoadRequest = Fields<LoadAction>;

/** Export options with the format. */
export type ExportRequest = Fields<ExportAction>;

/**
 * Functions of the host that the editor calls with `remoteInvoke`, for
 * example `getRecentDiagrams`, `searchDiagrams` and `getCustomTemplates` of
 * the template dialog. A function returns the arguments of the editor's
 * callback as an array.
 */
export type RemoteFunctions = Record<string, (...args: unknown[]) => unknown[] | Promise<unknown[]>>;

export interface DrawioClientOptions
{
  /**
   * URL of the editor (see `buildEditorUrl`), http or https. Use a constant
   * or an allowed URL: the editor at its origin gets the diagrams.
   */
  url: string;
  /** Configuration sent when the editor asks for it (`configure=1`). */
  config?: DrawioConfig;
  /**
   * Starts the editor after it sent `init`, also after it reloaded. Must
   * call `load` or `showTemplates`. Loads an empty diagram by default.
   */
  onInit?: (client: DrawioClient) => void;
  /** Called with every event of the editor. */
  onEvent?: (event: DrawioEvent) => void;
  /**
   * Rejects requests without a response after this many milliseconds,
   * including the time they wait for the editor to load. 0 waits forever.
   * Default 60000.
   */
  requestTimeout?: number;
  /** Functions the editor may call. */
  remoteFunctions?: RemoteFunctions;
}

export type DrawioErrorCode = "editor" | "timeout" | "closed" | "restarted" | "invalid";

/** Rejection reason of the requests of a `DrawioClient`. */
export class DrawioError extends Error
{
  /** `editor`: the editor reported an error, see `event`. */
  readonly code: DrawioErrorCode;
  /** The response that reported the error. */
  readonly event?: DrawioEvent;

  constructor(code: DrawioErrorCode, message: string, event?: DrawioEvent)
  {
    super(message);
    this.name = "DrawioError";
    this.code = code;
    this.event = event;
  }
}

interface PendingRequest
{
  /** The request was sent, it is not waiting for the editor to load. */
  sent: boolean;
  /** Events that answer the request. */
  responses: DrawioEventName[];
  /** The request is answered by its event without the request in `message`. */
  unechoed: boolean;
  resolve: (event: DrawioEvent) => void;
  reject: (error: DrawioError) => void;
  timer?: ReturnType<typeof setTimeout>;
}

let nextClientId = 0;

/**
 * Talks to the draw.io editor in an iframe with the JSON protocol of embed
 * mode. Accepts only messages from the iframe's window and the origin of
 * the editor URL, and sends messages only to that origin.
 *
 * The client sets the URL of the iframe after it listens for messages, so
 * that it cannot miss the first event. Requests sent before the editor
 * loaded its first diagram wait for the `load` event. If the editor starts
 * again without the client loading it, e.g. after a link in the diagram
 * opened another page in the iframe, the client loads its URL again.
 */
export class DrawioClient
{
  readonly iframe: HTMLIFrameElement;
  readonly url: string;
  readonly origin: string;

  private readonly options: DrawioClientOptions;
  private readonly idPrefix = "drawio-" + (++nextClientId) + "-";
  private readonly pending = new Map<string, PendingRequest>();
  private queue: Array<() => void> = [];
  private nextRequestId = 0;
  private attached = false;
  private stopped = false;
  private loaded = false;
  // The iframe is loading the URL of the client
  private expectStart = true;
  private diffSync = false;
  private templateLoad: LoadOptions | null = null;
  private warnedOrigin: string | null = null;

  constructor(iframe: HTMLIFrameElement, options: DrawioClientOptions)
  {
    const url = parseEditorUrl(options.url);
    this.iframe = iframe;
    this.options = options;
    this.url = url.href;
    this.origin = url.origin;
    this.attach();

    if (iframe.getAttribute("src") != this.url)
    {
      iframe.setAttribute("src", this.url);
    }
  }

  /** True after the editor loaded a diagram. */
  get ready(): boolean
  {
    return this.loaded;
  }

  /** True after `close`. */
  get closed(): boolean
  {
    return this.stopped;
  }

  /** Listens for messages of the editor. Called by the constructor. */
  attach(): void
  {
    if (!this.attached && !this.stopped)
    {
      window.addEventListener("message", this.handleMessage);
      this.attached = true;
    }
  }

  /** Stops listening for messages. Pending requests wait for `attach`. */
  detach(): void
  {
    window.removeEventListener("message", this.handleMessage);
    this.attached = false;
  }

  /** Stops listening and rejects all pending requests. */
  close(): void
  {
    this.detach();
    this.stopped = true;
    this.queue = [];
    this.rejectPending(new DrawioError("closed", "The client was closed"), false);
  }

  /** Loads the URL of the editor again. The editor starts again with `onInit`. */
  reload(): void
  {
    this.expectStart = true;
    this.loaded = false;
    this.rejectPending(new DrawioError("restarted", "The editor restarted"), true);
    this.iframe.setAttribute("src", this.url);
  }

  /** Sends an action now, without waiting for the editor or for a response. */
  send(action: DrawioAction): void
  {
    this.post(action);
  }

  /** Loads a diagram. Replaces the diagram and clears the undo history. */
  load(request: LoadRequest): Promise<DrawioEventOf<"load">>
  {
    return this.request({ ...normalizeLoad(request), action: "load" } as LoadAction, ["load"],
      { unechoed: request.descriptor == null, immediate: true });
  }

  /**
   * Shows the template dialog. The selected template is loaded with the
   * given load options. Cancel sends `exit` unless `noExitOnCancel` is set.
   * A recent or found diagram is sent as a `template` event with `docUrl`
   * for the host to load.
   */
  showTemplates(options: Omit<Fields<TemplateAction>, "callback"> = {}, loadOptions: LoadOptions = {}): void
  {
    this.templateLoad = loadOptions;
    this.post({ ...options, action: "template", callback: true });
  }

  /** Merges a diagram into the current diagram. */
  merge(xml: string): Promise<DrawioEventOf<"merge">>
  {
    return (xml == null || xml == "") ?
      Promise.reject(new DrawioError("invalid", "merge needs a diagram")) :
      this.request({ action: "merge", xml }, ["merge"]);
  }

  /** Applies a patch (diff sync). */
  patch(patch: DiagramPatch, checksum?: string): Promise<DrawioEventOf<"patch">>
  {
    return (patch == null) ?
      Promise.reject(new DrawioError("invalid", "patch needs a patch")) :
      this.request({ action: "patch", patch, checksum }, ["patch"]);
  }

  /** Returns the changes since the diff sync baseline, or the XML without diff sync. */
  getDiff(): Promise<DrawioEventOf<"getDiff">>
  {
    return this.request({ action: "getDiff" }, ["getDiff"]);
  }

  /** Makes the current diagram, or the given diagram merged into it, the diff sync baseline. */
  resetDiff(xml?: string): Promise<DrawioEventOf<"resetDiff">>
  {
    return (!this.diffSync || xml === "") ?
      Promise.reject(new DrawioError("invalid", "resetDiff needs diff sync and a diagram or none")) :
      this.request({ action: "resetDiff", xml }, ["resetDiff"]);
  }

  /** Exports the diagram. */
  export(request: ExportRequest): Promise<DrawioEventOf<"export">>
  {
    return this.request({ ...request, action: "export" } as ExportAction, ["export"]);
  }

  /** Returns the XML of the diagram. */
  async getXml(): Promise<string>
  {
    const event = await this.export({ format: "xml" });

    return event.xml ?? "";
  }

  /** Returns the text of all labels. */
  async getTextContent(): Promise<string>
  {
    const event = await this.request({ action: "textContent" }, ["textContent"]);

    return event.data;
  }

  /** Fits the diagram to the viewport. */
  fit(options: Fields<FitAction> = {}): Promise<DrawioEventOf<"fit">>
  {
    return this.request({ ...options, action: "fit" }, ["fit"]);
  }

  /** Shows a region of the diagram. */
  viewbox(viewbox: ViewBox): Promise<DrawioEventOf<"viewbox">>
  {
    return this.request({ action: "viewbox", viewbox }, ["viewbox"]);
  }

  /** Runs layouts. Responds after the cells moved. */
  layout(layouts: Layout): Promise<DrawioEventOf<"layout">>
  {
    return this.request({ action: "layout", layouts }, ["layout"]);
  }

  /** Asks the user for a value. Returns null if the dialog was cancelled. */
  async prompt(options: Fields<PromptAction> = {}): Promise<string | null>
  {
    const event = await this.request({ ...options, action: "prompt" },
      ["prompt", "prompt-cancel"], { timeout: 0 });

    return (event.event == "prompt") ? event.value : null;
  }

  /** Shows a draft and returns the choice of the user. */
  async draft(options: Fields<DraftAction>): Promise<"edit" | "discard" | "ignore">
  {
    const event = await this.request({ ...options, action: "draft" }, ["draft"], { timeout: 0 });

    return event.result ?? "ignore";
  }

  /** Shows a message dialog. */
  dialog(options: Fields<DialogAction>): void
  {
    this.postWhenReady({ ...options, action: "dialog" });
  }

  /** Shows a message in the status bar. */
  status(options: Fields<StatusAction>): void
  {
    this.postWhenReady({ ...options, action: "status" });
  }

  /**
   * Sets the modified state of the editor. Call `setModified(false)` after
   * the host stored an autosave: a modified editor asks before the page is
   * left and before it exits.
   */
  setModified(modified: boolean): void
  {
    this.postWhenReady({ action: "status", modified });
  }

  /** Shows or hides the spinner. */
  spinner(options: Fields<SpinnerAction>): void
  {
    this.post({ ...options, action: "spinner" });
  }

  /** Runs an action of the editor, e.g. `undo`, `zoomIn` or `selectAll`. */
  invokeAction(actionName: string): void
  {
    this.postWhenReady({ action: "invokeAction", actionName });
  }

  /** Stops label editing, hides menus and clears the selection. */
  resetEditor(): void
  {
    this.postWhenReady({ action: "resetEditor" });
  }

  /** Sets the visible rectangle of the host window (inline embeds). */
  viewport(viewport: Rect): void
  {
    this.postWhenReady({ action: "viewport", viewport });
  }

  /** Tells an inline embed that fullscreen changed. */
  fullscreenChanged(value: boolean): void
  {
    this.postWhenReady({ action: "fullscreenChanged", value });
  }

  /** Requests an SVG of a modified diagram as an `export` event (no event if unmodified). */
  snapshot(): void
  {
    this.postWhenReady({ action: "snapshot" });
  }

  /** Exits the editor as if the user clicked _Exit_. */
  exit(): void
  {
    this.postWhenReady({ action: "exit" });
  }

  private readonly handleMessage = (evt: MessageEvent): void =>
  {
    if (evt.source == null || evt.source !== this.iframe.contentWindow)
    {
      return;
    }

    if (evt.origin !== this.origin)
    {
      this.warnOrigin(evt.origin);

      return;
    }

    const event = parseEvent(evt.data);

    if (event != null)
    {
      this.handleEvent(event);
    }
  };

  private handleEvent(event: DrawioEvent): void
  {
    if ((event.event == "configure" || event.event == "init") && !this.expectStart)
    {
      // Another page in the iframe, without the URL parameters of the client
      this.reload();
    }
    else if (event.event == "configure")
    {
      this.post({ action: "configure", config: this.options.config ?? {} });
    }
    else if (event.event == "init")
    {
      this.restart();
    }
    else if (event.event == "load" && event.error == null)
    {
      this.loaded = true;
      this.flushQueue();
    }
    else if (event.event == "template" && event.xml != null && this.templateLoad != null)
    {
      const loadOptions = this.templateLoad;
      this.templateLoad = null;
      this.load({ ...loadOptions, xml: event.xml }).catch(() =>
      {
        // Reported as a load event
      });
    }
    else if (event.event == "remoteInvoke")
    {
      this.invokeRemoteFunction(event);
    }

    this.settle(event);
    this.options.onEvent?.(event);
  }

  /** Handles the init event of the editor that the client loaded. */
  private restart(): void
  {
    this.expectStart = false;
    this.loaded = false;
    this.templateLoad = null;
    this.rejectPending(new DrawioError("restarted", "The editor restarted"), true);
    this.post({ action: "remoteInvokeReady" });

    if (this.options.onInit != null)
    {
      this.options.onInit(this);
    }
    else
    {
      this.load({}).catch(() =>
      {
        // Reported as a load event
      });
    }
  }

  private request<N extends DrawioEventName>(action: DrawioAction, responses: N[],
    options: { unechoed?: boolean; immediate?: boolean; timeout?: number } = {}): Promise<DrawioEventOf<N>>
  {
    if (this.stopped)
    {
      return Promise.reject(new DrawioError("closed", "The client was closed"));
    }

    const requestId = this.idPrefix + (++this.nextRequestId);
    const timeout = options.timeout ?? this.options.requestTimeout ?? 60000;

    return new Promise<DrawioEventOf<N>>((resolve, reject) =>
    {
      const request: PendingRequest = {
        sent: false, responses, unechoed: options.unechoed ?? false,
        resolve: resolve as (event: DrawioEvent) => void, reject
      };

      this.pending.set(requestId, request);

      if (timeout > 0)
      {
        request.timer = setTimeout(() =>
        {
          this.pending.delete(requestId);
          reject(new DrawioError("timeout", "No response to " + action.action));
        }, timeout);
      }

      const send = () =>
      {
        // Not after a timeout or a rejection
        if (this.pending.get(requestId) === request)
        {
          request.sent = true;

          if (action.action == "load")
          {
            this.diffSync = action.diffSync != null && action.diffSync !== false;
          }

          this.post(action, requestId);
        }
      };

      if (options.immediate || this.loaded)
      {
        send();
      }
      else
      {
        this.queue.push(send);
      }
    });
  }

  /** Resolves or rejects the request that the event answers. */
  private settle(event: DrawioEvent): void
  {
    const id = getRequestId(event);
    const echoed = (id != null) ? this.pending.get(id) : undefined;
    let key = (echoed != null && echoed.sent && echoed.responses.includes(event.event)) ? id : null;

    if (key == null && id == null)
    {
      for (const [pendingId, request] of this.pending)
      {
        if (request.sent && request.unechoed && request.responses.includes(event.event))
        {
          key = pendingId;
          break;
        }
      }
    }

    const request = (key != null) ? this.pending.get(key) : undefined;

    if (key != null && request != null)
    {
      this.pending.delete(key);
      clearTimeout(request.timer);
      const error = ("error" in event) ? event.error : null;

      if (error != null)
      {
        request.reject(new DrawioError("editor", String(error), event));
      }
      else
      {
        request.resolve(event);
      }
    }
  }

  private async invokeRemoteFunction(event: DrawioEventOf<"remoteInvoke">): Promise<void>
  {
    const functions = this.options.remoteFunctions;
    const name = event.funtionName;
    const fn = (functions != null && Object.prototype.hasOwnProperty.call(functions, name)) ?
      functions[name] : null;

    try
    {
      if (typeof fn !== "function")
      {
        throw new Error("No remote function " + name);
      }

      const resp = await fn(...(Array.isArray(event.functionArgs) ? event.functionArgs : []));
      this.post({ action: "remoteInvokeResponse", msgMarkers: event.msgMarkers, resp });
    }
    catch (e)
    {
      this.post({ action: "remoteInvokeResponse", msgMarkers: event.msgMarkers,
        error: { errResp: (e instanceof Error) ? e.message : String(e) } });
    }
  }

  private postWhenReady(action: DrawioAction): void
  {
    if (this.loaded)
    {
      this.post(action);
    }
    else
    {
      this.queue.push(() => this.post(action));
    }
  }

  /** Sends an action to the origin of the editor. The editor sends `requestId` back in `message`. */
  private post(action: DrawioAction, requestId?: string): void
  {
    const target = this.iframe.contentWindow;

    if (target != null && !this.stopped)
    {
      const message = (requestId != null) ? { ...action, requestId } : action;
      target.postMessage(JSON.stringify(message), this.origin);
    }
  }

  private flushQueue(): void
  {
    const queue = this.queue;
    this.queue = [];
    queue.forEach((send) => send());
  }

  /** Rejects the pending requests, or only the ones that were sent. */
  private rejectPending(error: DrawioError, sentOnly: boolean): void
  {
    for (const [id, request] of this.pending)
    {
      if (request.sent || !sentOnly)
      {
        clearTimeout(request.timer);
        this.pending.delete(id);
        request.reject(error);
      }
    }
  }

  private warnOrigin(origin: string): void
  {
    if (this.warnedOrigin != origin)
    {
      this.warnedOrigin = origin;
      console.warn("drawio: ignored a message from " + origin + ", expected " + this.origin +
        ". Use the final URL of the editor if it redirects.");
    }
  }
}

/** Parses a message of the editor. Returns null for anything but a JSON object with an event. */
export function parseEvent(data: unknown): DrawioEvent | null
{
  let value: unknown = null;

  if (typeof data === "string")
  {
    try
    {
      value = JSON.parse(data);
    }
    catch (e)
    {
      // Not a message of the JSON protocol
    }
  }

  let event: DrawioEvent | null = null;

  if (value != null && typeof value === "object" && !Array.isArray(value))
  {
    const message = value as Record<string, unknown>;

    if (message.error === "unknownMessage")
    {
      event = { event: "unknownMessage", data: String(message.data) };
    }
    else if (typeof message.event === "string")
    {
      event = message as unknown as DrawioEvent;
    }
  }

  return event;
}

/** Returns the ID of the request that the editor sent back in `message`. */
function getRequestId(event: DrawioEvent): string | null
{
  const message = ("message" in event) ? event.message : null;
  const id = (message != null && typeof message === "object") ?
    (message as { requestId?: unknown }).requestId : null;

  return (typeof id === "string") ? id : null;
}

/** Sends the URL parameter flags as the strings that the editor compares with. */
function normalizeLoad(request: LoadRequest): Record<string, unknown>
{
  const result: Record<string, unknown> = { ...request };

  for (const key of ["saveAndExit", "noSaveBtn", "noExitBtn"] as const)
  {
    if (typeof request[key] === "boolean")
    {
      result[key] = request[key] ? "1" : "0";
    }
  }

  // The editor fits for any value of fit
  if (request.fit === false)
  {
    delete result.fit;
  }

  return result;
}
