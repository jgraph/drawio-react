/**
 * Types of the draw.io embed mode JSON protocol (`embed=1&proto=json`).
 *
 * The host page sends actions (`{action: ...}`) to the editor in the iframe
 * and the editor sends events (`{event: ...}`) back, both as JSON strings via
 * `postMessage`. Reference: https://www.drawio.com/docs/reference/embed-mode
 */

export interface Point
{
  x: number;
  y: number;
}

export interface Rect extends Point
{
  width: number;
  height: number;
}

/** A diagram region in model coordinates with an optional border in screen pixels (default 10). */
export interface ViewBox extends Rect
{
  border?: number;
}

/** State of the editor view that most responses carry. */
export interface EditorState
{
  /** Diagram bounds in view coordinates (they change with the zoom). */
  bounds: Rect;
  /** Diagram bounds in model coordinates (independent of the zoom). */
  modelBounds: Rect;
  /** Zoom scale of the view. */
  scale: number;
  /** Translation of the view. */
  translate: Point;
  /** Whether page view is enabled. */
  pageVisible: boolean;
  /** Index of the selected page. */
  currentPage: number;
  /** Bounds of the background page. */
  page: Rect;
  /** Size of the editor container. */
  containerSize: { width: number; height: number; offsetWidth: number; offsetHeight: number };
}

// ---------------------------------------------------------------------------
// Actions (host to editor)
// ---------------------------------------------------------------------------

/** Layout presets accepted by the `layout` load option and the `layout` action. */
export type LayoutPreset = "verticalFlow" | "horizontalFlow" | "verticalTree" |
  "horizontalTree" | "radialTree" | "organic";

/**
 * One step of a custom layout, as in _Arrange > Layout > Apply_.
 * See https://www.drawio.com/docs/reference/json-layout-specification
 */
export interface LayoutStep
{
  layout: string;
  config?: Record<string, unknown>;
}

export type Layout = LayoutPreset | LayoutStep[];

/** Creates a diagram from CSV (same format as _Arrange > Insert > Advanced > CSV_). */
export interface CsvDescriptor
{
  format: "csv";
  data: string;
}

/** Converts Mermaid source to a diagram. */
export interface MermaidDescriptor
{
  format: "mermaid";
  data: string;
  /** Wraps the result in a Mermaid group that can be edited as Mermaid later. */
  wrap?: boolean;
  /** Loads the diagram as an image cell that carries the Mermaid source. */
  image?: boolean;
  /** Mermaid defaults version, e.g. `"12"`. Mermaid 11 defaults are used when omitted. */
  version?: string;
}

/** Converts PlantUML source to a diagram (converted in the browser). */
export interface PlantUmlDescriptor
{
  format: "plantuml";
  data: string;
  wrap?: boolean;
  image?: boolean;
}

export type Descriptor = CsvDescriptor | MermaidDescriptor | PlantUmlDescriptor;

/** Options of the `load` action other than the diagram data. */
export interface LoadOptions
{
  /** Sends an `autosave` event after every change. */
  autosave?: boolean;
  /** Resource key of the status message after changes, or `"0"` to clear the status bar. */
  modified?: string;
  /** Shows a _Save and Exit_ button. URL parameters take precedence. */
  saveAndExit?: boolean;
  /** Replaces the _Save_ button with _Save and Exit_. */
  noSaveBtn?: boolean;
  /** Hides the _Exit_ button. */
  noExitBtn?: boolean;
  /** Title shown in the menu bar. */
  title?: string;
  /** Shape libraries to show, separated by semicolons, e.g. `"general;uml"`. */
  libs?: string;
  /** Enables or disables dark mode. */
  dark?: boolean;
  /** Theme of the SVG sent by `snapshot` and inline embeds. */
  theme?: "light" | "dark" | "auto";
  /** Enables the sketch (hand-drawn) style. */
  rough?: boolean;
  /** Converts the diagram to the sketch style. */
  toSketch?: boolean;
  /** Border of `snapshot` exports and of `scale`/`fit` below. */
  border?: number;
  /** Background colour of `snapshot` exports. */
  background?: string;
  /** Visible rectangle of the host window for inline embeds (window coordinates). */
  viewport?: Rect;
  /** Inline embeds: where the editor opens in the iframe, e.g. over the image of the diagram. */
  rect?: { left: number; top: number; width: number; height: number };
  /** Inline embeds: minimum width of the editor. */
  minWidth?: number;
  /** Inline embeds: minimum height of the editor. */
  minHeight?: number;
  /** Shows this region after loading. Takes precedence over `scale` and `fit`. */
  viewbox?: ViewBox;
  /** Exact zoom scale after loading. Takes precedence over `fit`. */
  scale?: number;
  /** Border around the diagram in screen pixels when `scale` is used. */
  scaleBorder?: number;
  /** Fits the diagram to the viewport after loading. */
  fit?: boolean;
  /** Maximum scale for `fit`. */
  maxFitScale?: number;
  /** Scrolls this model point to the top left corner after loading. */
  scroll?: Point;
  /** Stores an attribute on the root cell of the model after loading. */
  sourceMetadata?: { key: string; value: string };
  /** Sends exports started in the UI as `export` events instead of downloading them. */
  exportProtocol?: boolean;
  /** Enables diff sync: patches and checksums in autosave events, and the patch actions. */
  diffSync?: boolean | { patchOnly?: boolean };
  /** Sends a `zoom` event when the zoom changes after loading. */
  zoomEvents?: boolean;
  /** Runs a layout after loading, before the diagram becomes the sync baseline. */
  layout?: Layout;
}

export interface LoadAction extends LoadOptions
{
  action: "load";
  /**
   * Diagram data: draw.io XML, compressed XML, a PNG or SVG data URI with an
   * embedded diagram, a Visio data URI (`data:application/vnd.visio;base64,...`)
   * or a Lucidchart or Gliffy JSON string.
   */
  xml?: string;
  /** Data to convert instead of `xml`. */
  descriptor?: Descriptor;
}

export interface MergeAction
{
  action: "merge";
  /** XML, or a PNG or SVG data URI with an embedded diagram. */
  xml: string;
}

export interface PatchAction
{
  action: "patch";
  patch: DiagramPatch;
  /** Expected checksum after the patch. A mismatch is reported in the response. */
  checksum?: string;
}

export interface GetDiffAction
{
  action: "getDiff";
}

export interface ResetDiffAction
{
  action: "resetDiff";
  /** Merges this XML before the diff baseline is reset. */
  xml?: string;
}

export interface DialogAction
{
  action: "dialog";
  title?: string;
  message?: string;
  button?: string;
  titleKey?: string;
  messageKey?: string;
  buttonKey?: string;
  modified?: boolean;
}

export interface PromptAction
{
  action: "prompt";
  title?: string;
  titleKey?: string;
  ok?: string;
  okKey?: string;
  defaultValue?: string;
}

export interface TemplateAction
{
  action: "template";
  /** Sends the selected template as a `template` event instead of loading it. */
  callback?: boolean;
  /** Shows only the templates. */
  templatesOnly?: boolean;
  /** Keeps the editor open when the dialog is cancelled (no `exit` event). */
  noExitOnCancel?: boolean;
  /** Converts the template to the sketch style (without `callback`). */
  toSketch?: boolean;
  /** Shows recent diagrams, requested from the host with `getRecentDiagrams`. */
  enableRecent?: boolean;
  /** Enables search, requested from the host with `searchDiagrams`. */
  enableSearch?: boolean;
  /** Shows custom templates, requested from the host with `getCustomTemplates`. */
  enableCustomTemp?: boolean;
  /** Hides the diagram type filter. */
  withoutType?: boolean;
}

export interface LayoutAction
{
  action: "layout";
  layouts: Layout;
}

export interface DraftAction
{
  action: "draft";
  xml: string;
  name?: string;
  editKey?: string;
  discardKey?: string;
  /** Adds an _Ignore_ option. */
  ignore?: boolean;
}

export interface StatusAction
{
  action: "status";
  message?: string;
  messageKey?: string;
  modified?: boolean;
}

export interface SpinnerAction
{
  action: "spinner";
  message?: string;
  messageKey?: string;
  /** `false` hides the spinner. */
  show?: boolean;
}

interface ExportBase
{
  /**
   * Loads this XML into the editor and exports it. This replaces the
   * diagram in the editor.
   */
  xml?: string;
  /** Message of the spinner shown during the export. */
  spin?: string;
  spinKey?: string;
}

interface ImageExportBase extends ExportBase
{
  scale?: number;
  border?: number;
  /** IDs of the visible layers. */
  layerIds?: string[];
  pageId?: string;
  currentPage?: boolean;
  shadow?: boolean;
  keepTheme?: boolean;
  background?: string;
  embedImages?: boolean;
  embedFonts?: boolean;
}

export interface PngExportAction extends ImageExportBase
{
  action: "export";
  format: "png" | "xmlpng";
  width?: number;
  grid?: boolean;
  transparent?: boolean;
  size?: "page" | "diagram";
  /** Also returns an SVG of the diagram in `svg`. */
  withSvg?: boolean;
}

export interface SvgExportAction extends ImageExportBase
{
  action: "export";
  format: "svg" | "xmlsvg";
  theme?: "light" | "dark" | "auto";
  /** Adds the attributes of cell values as `data-meta-*` attributes. */
  embedCellMetadata?: boolean;
  /** Returns the SVG markup instead of a data URI (`svg` only). */
  asText?: boolean;
}

export interface XmlExportAction extends ExportBase
{
  action: "export";
  format: "xml";
}

export interface JsonExportAction extends ExportBase
{
  action: "export";
  format: "json";
  allPages?: boolean;
  includeData?: boolean;
  compressed?: boolean;
  selection?: boolean;
}

export interface HtmlExportAction extends ExportBase
{
  action: "export";
  format: "html" | "html2";
}

export type ExportAction = PngExportAction | SvgExportAction | XmlExportAction |
  JsonExportAction | HtmlExportAction;

export type ExportFormat = ExportAction["format"];

export interface FitAction
{
  action: "fit";
  /** Padding in pixels, default 16. */
  border?: number;
  /** Maximum scale, default 1. */
  maxScale?: number;
}

export interface ViewBoxAction
{
  action: "viewbox";
  viewbox: ViewBox;
}

export interface ResetEditorAction
{
  action: "resetEditor";
}

export interface InvokeAction
{
  action: "invokeAction";
  /** Name of an editor action, e.g. `"undo"`, `"zoomIn"`, `"selectAll"`. */
  actionName: string;
}

export interface TextContentAction
{
  action: "textContent";
}

export interface ViewportAction
{
  action: "viewport";
  viewport: Rect;
}

export interface SnapshotAction
{
  action: "snapshot";
}

export interface FullscreenChangedAction
{
  action: "fullscreenChanged";
  value: boolean;
}

export interface ExitAction
{
  action: "exit";
}

export interface ConfigureAction
{
  action: "configure";
  config: DrawioConfig;
  /** Lets the iframe be transparent in dark mode. */
  colorSchemeMeta?: boolean;
}

/** Marker that pairs a remote call with its response. */
export interface MessageMarkers
{
  callbackId?: number;
  [key: string]: unknown;
}

export interface RemoteInvokeReadyAction
{
  action: "remoteInvokeReady";
}

export interface RemoteInvokeAction
{
  action: "remoteInvoke";
  /** Spelled like this in the protocol. */
  funtionName: string;
  functionArgs?: unknown[];
  msgMarkers?: MessageMarkers;
}

export interface RemoteInvokeResponseAction
{
  action: "remoteInvokeResponse";
  msgMarkers: MessageMarkers;
  /** Arguments of the callback of the remote function. */
  resp?: unknown[];
  error?: { errResp: unknown };
}

export type DrawioAction = LoadAction | MergeAction | PatchAction | GetDiffAction |
  ResetDiffAction | DialogAction | PromptAction | TemplateAction | LayoutAction |
  DraftAction | StatusAction | SpinnerAction | ExportAction | FitAction | ViewBoxAction |
  ResetEditorAction | InvokeAction | TextContentAction | ViewportAction | SnapshotAction |
  FullscreenChangedAction | ExitAction | ConfigureAction | RemoteInvokeReadyAction |
  RemoteInvokeAction | RemoteInvokeResponseAction;

// ---------------------------------------------------------------------------
// Events (editor to host)
// ---------------------------------------------------------------------------

/** Changes of a page, cells or the view, keyed by `u` (update), `i` (insert) and `r` (remove). */
export interface DiagramPatch
{
  u?: Record<string, unknown>;
  i?: unknown[];
  r?: string[];
  [key: string]: unknown;
}

/** Structural JSON of a diagram (`export` with format `json`). */
export interface DiagramJson
{
  version: string;
  /** The diagram XML, with `includeData`. */
  data?: string;
  pages: Array<{
    id: string;
    name: string;
    cells: Array<{
      id: string;
      type: "layer" | "group" | "node" | "edge";
      parent?: string;
      source?: string;
      target?: string;
      label?: string;
      html?: string;
      metadata?: Record<string, string>;
    }>;
  }>;
}

/**
 * Responses carry the action that caused them in `message`. The client adds
 * a `requestId` to its requests and uses it to find the pending request.
 */
interface RequestEcho
{
  message?: unknown;
}

/** The editor is waiting for a `configure` action (URL parameter `configure=1`). */
export interface ConfigureEvent
{
  event: "configure";
}

/** The editor is ready and waits for a `load` or `template` action. */
export interface InitEvent
{
  event: "init";
}

export interface LoadEvent extends Partial<EditorState>, RequestEcho
{
  event: "load";
  /** The loaded diagram. */
  xml?: string;
  /** Checksum of the pages with diff sync. */
  checksum?: string;
  /** A Mermaid or PlantUML conversion failed. */
  error?: string;
}

export interface SaveEvent extends EditorState
{
  event: "save";
  xml: string;
  /** _Save and Exit_ was selected. */
  exit?: boolean;
}

export interface AutosaveEvent extends EditorState, RequestEcho
{
  event: "autosave";
  /** The diagram. Omitted with diff sync `patchOnly`. */
  xml?: string;
  /** Changes since the last autosave with diff sync. */
  patch?: DiagramPatch;
  checksum?: string;
}

export interface ExitEvent
{
  event: "exit";
  modified?: boolean;
  point?: Point;
}

export interface ExportEvent extends Partial<EditorState>, RequestEcho
{
  event: "export";
  /** Format of `data`. An `xmlsvg` export returns `"svg"`. */
  format?: string;
  /** Data URI, SVG markup (`asText`), HTML or the JSON object of a `json` export. */
  data?: string | DiagramJson;
  /** The exported diagram. */
  xml?: string;
  /** SVG of the diagram for `withSvg`. */
  svg?: string;
  /** File name of an export started in the UI. */
  filename?: string;
  /** Set for exports of inline embeds. */
  exit?: boolean;
  point?: Point;
}

export interface MergeEvent extends RequestEcho
{
  event: "merge";
  error?: unknown;
}

export interface PatchEvent extends RequestEcho
{
  event: "patch";
  checksum?: string;
  checksumMismatch?: boolean;
  error?: string;
}

export interface GetDiffEvent extends RequestEcho
{
  event: "getDiff";
  /** Changes since the baseline with diff sync. */
  patch?: DiagramPatch;
  checksum?: string;
  /** The diagram without diff sync. */
  xml?: string;
}

export interface ResetDiffEvent extends RequestEcho
{
  event: "resetDiff";
  checksum?: string;
  error?: unknown;
}

export interface PromptEvent extends RequestEcho
{
  event: "prompt";
  value: string;
}

export interface PromptCancelEvent extends RequestEcho
{
  event: "prompt-cancel";
}

export interface DraftEvent extends RequestEcho
{
  event: "draft";
  result?: "edit" | "discard" | "ignore";
  error?: string;
}

export interface TemplateEvent extends RequestEcho
{
  event: "template";
  /** XML of the selected built-in template (`callback`). */
  xml?: string;
  /** The blank diagram was selected. */
  blank?: boolean;
  name?: string;
  tempUrl?: string;
  libs?: string;
  builtIn?: boolean;
  /** URL of a recent, found or custom diagram that the host must load. */
  docUrl?: string;
  info?: unknown;
}

export interface TextContentEvent extends RequestEcho
{
  event: "textContent";
  data: string;
}

export interface FitEvent extends EditorState, RequestEcho
{
  event: "fit";
}

export interface ViewBoxEvent extends EditorState, RequestEcho
{
  event: "viewbox";
}

export interface LayoutEvent extends EditorState, RequestEcho
{
  event: "layout";
}

export interface ZoomEvent extends EditorState
{
  event: "zoom";
}

/**
 * A link in the diagram was clicked. The link comes from the diagram:
 * check it before the host opens it.
 */
export interface OpenLinkEvent
{
  event: "openLink";
  href: string;
  target?: string;
  allowOpener?: boolean;
}

/** Size change of an inline embed. */
export interface ResizeEvent
{
  event: "resize";
  fullscreen: boolean;
  rect: Rect;
}

/** A key chord of `passThroughKeys` in the configuration was pressed. */
export interface ShortcutEvent
{
  event: "shortcut";
  command: string;
}

/** Wheel scrolling with `passiveScroll` in the configuration. */
export interface ScrollWheelEvent
{
  event: "scrollWheel";
  deltaX: number;
  deltaY: number;
}

/** The editor calls a function of the host. */
export interface RemoteInvokeEvent
{
  event: "remoteInvoke";
  funtionName: string;
  functionArgs?: unknown[];
  msgMarkers: MessageMarkers;
}

/** Result of a function of the editor called with `remoteInvoke`. */
export interface RemoteInvokeResponseEvent
{
  event: "remoteInvokeResponse";
  msgMarkers: MessageMarkers;
  resp?: unknown[];
  error?: { errResp: unknown };
}

/**
 * The editor did not understand an action. The editor sends
 * `{error: "unknownMessage", data}`; the client reports it with this
 * event name.
 */
export interface UnknownMessageEvent
{
  event: "unknownMessage";
  /** The action as a JSON string. */
  data: string;
}

export type DrawioEvent = ConfigureEvent | InitEvent | LoadEvent | SaveEvent |
  AutosaveEvent | ExitEvent | ExportEvent | MergeEvent | PatchEvent | GetDiffEvent |
  ResetDiffEvent | PromptEvent | PromptCancelEvent | DraftEvent | TemplateEvent |
  TextContentEvent | FitEvent | ViewBoxEvent | LayoutEvent | ZoomEvent | OpenLinkEvent |
  ResizeEvent | ShortcutEvent | ScrollWheelEvent | RemoteInvokeEvent |
  RemoteInvokeResponseEvent | UnknownMessageEvent;

export type DrawioEventName = DrawioEvent["event"];

/** The event with the given name. */
export type DrawioEventOf<N extends DrawioEventName> = Extract<DrawioEvent, { event: N }>;

// ---------------------------------------------------------------------------
// Configuration and URL parameters
// ---------------------------------------------------------------------------

/**
 * Configuration of the editor, sent with `configure=1` before the editor
 * starts. See https://www.drawio.com/docs/reference/configure-diagram-editor
 */
export interface DrawioConfig
{
  /** Inline embeds: keyboard only with focus, wheel events sent as `scrollWheel`. */
  passiveScroll?: boolean;
  /** Inline embeds: hides the resize handles. */
  noResizers?: boolean;
  /** Keeps the view attributes of the loaded XML when saving. */
  preserveViewState?: boolean;
  /** Uses the internal clipboard for copy and paste. */
  useInternalClipboard?: boolean;
  /** Key chords sent to the host as `shortcut` events. */
  passThroughKeys?: Array<{ key: string; ctrl?: boolean; shift?: boolean; alt?: boolean; command: string }>;
  /** Sends links as `openLink` events and does not open new windows. */
  suppressNewWindows?: boolean;
  [key: string]: unknown;
}

/**
 * URL parameters of the editor. Booleans are sent as `1` and `0`.
 * See https://www.drawio.com/docs/reference/supported-url-parameters
 */
export interface UrlParameters
{
  /** Editor theme. */
  ui?: "kennedy" | "min" | "atlas" | "dark" | "sketch" | "simple";
  /** Dark mode. */
  dark?: boolean | "auto";
  /** Language of the user interface, e.g. `"de"`. */
  lang?: string;
  /** Shows a spinner until the diagram is loaded (default `true`). */
  spin?: boolean | string;
  /** Shows the shape libraries. */
  libraries?: boolean;
  /** Shape libraries, separated by semicolons. */
  libs?: string;
  /** Custom libraries, separated by semicolons. */
  clibs?: string;
  /** Shows the _Theme_ submenu in _Extras_. */
  themes?: boolean;
  /** Replaces the _Save_ button with _Save and Exit_. */
  noSaveBtn?: boolean;
  /** Shows a _Save and Exit_ button. */
  saveAndExit?: boolean;
  /** Hides the _Exit_ button. */
  noExitBtn?: boolean;
  /** Labels the buttons _Publish_ and _Close_. */
  publishClose?: boolean;
  /** Status bar message key after changes, or `"0"`. */
  modified?: string;
  /** Keeps the modified state after a save. */
  keepmodified?: boolean;
  /** Sketch style. */
  sketch?: boolean;
  /** Rough (hand-drawn) style. */
  rough?: boolean;
  /** Page view. */
  pv?: boolean;
  /** Grid. */
  grid?: boolean;
  /** Multiple pages. */
  pages?: boolean;
  /** Format panel. */
  format?: boolean;
  /** Math typesetting. */
  math?: boolean;
  /** Suppresses new windows (also a configuration option). */
  suppressNewWindows?: boolean;
  [key: string]: string | number | boolean | undefined;
}
