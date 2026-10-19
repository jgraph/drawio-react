import {
  forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, type CSSProperties
} from "react";
import { DrawioClient, DrawioError, type DrawioClientOptions, type RemoteFunctions } from "./client";
import type {
  Descriptor, DrawioConfig, DrawioEvent, DrawioEventOf, LoadOptions, TemplateAction, UrlParameters
} from "./protocol";
import { buildEditorUrl } from "./url";

export type TemplateOptions = Omit<TemplateAction, "action" | "callback">;

export interface DrawioEditorProps
{
  /**
   * URL of the editor, e.g. of a self-hosted draw.io. Default
   * `https://embed.diagrams.net/`. Use a constant: the editor gets the diagrams.
   */
  baseUrl?: string;
  /**
   * URL parameters of the editor, e.g. `{ui: "min", libraries: true}`. A
   * change reloads the editor with the current diagram.
   */
  urlParameters?: UrlParameters;
  /**
   * Configuration of the editor, sent before it starts. Read when the
   * editor starts: change the `key` of the component to apply a new one.
   */
  config?: DrawioConfig;
  /**
   * The diagram. A change loads the new diagram, unless it is the diagram
   * that the editor reported last in a load, save or autosave event.
   */
  xml?: string;
  /** CSV, Mermaid or PlantUML to convert instead of `xml`. A change loads it. */
  descriptor?: Descriptor;
  /** Shows the template dialog when there is no `xml` and no `descriptor`. */
  templates?: boolean | TemplateOptions;
  /** Sends an autosave event after every change. */
  autosave?: boolean;
  /** More options for loading diagrams. Changes apply to the next load. */
  loadOptions?: LoadOptions;
  /** A diagram was loaded. */
  onLoad?: (event: DrawioEventOf<"load">) => void;
  /** The user clicked _Save_ or _Save and Exit_ (`event.exit`). */
  onSave?: (event: DrawioEventOf<"save">) => void;
  /** The diagram changed (with `autosave`). */
  onAutosave?: (event: DrawioEventOf<"autosave">) => void;
  /** The user clicked _Exit_ or cancelled the template dialog. */
  onExit?: (event: DrawioEventOf<"exit">) => void;
  /** An export started in the UI (`loadOptions.exportProtocol`), or a snapshot. */
  onExport?: (event: DrawioEventOf<"export">) => void;
  /** Every event of the editor, including the ones above. */
  onEvent?: (event: DrawioEvent) => void;
  /** Functions the editor may call, e.g. `getRecentDiagrams` for the template dialog. */
  remoteFunctions?: RemoteFunctions;
  /** Rejects requests without a response after this many milliseconds. 0 waits forever. Default 60000. */
  requestTimeout?: number;
  /** Title of the iframe for assistive technology. Default `"draw.io editor"`. */
  title?: string;
  className?: string;
  /** Style of the iframe, which fills its container by default. */
  style?: CSSProperties;
}

const asyncMethods = ["load", "merge", "patch", "getDiff", "resetDiff", "export", "getXml",
  "getTextContent", "fit", "viewbox", "layout", "prompt", "draft"] as const;

const syncMethods = ["send", "showTemplates", "dialog", "status", "setModified", "spinner", "invokeAction",
  "resetEditor", "viewport", "fullscreenChanged", "snapshot", "exit"] as const;

type HandleMethod = typeof asyncMethods[number] | typeof syncMethods[number];

/** Methods of the editor for a `ref`. Requests made before the editor loaded wait for it. */
export type DrawioEditorHandle = Pick<DrawioClient, HandleMethod> &
{
  /** The client of the current editor, or null if there is none. */
  readonly client: DrawioClient | null;
};

const useIsomorphicLayoutEffect = (typeof window !== "undefined") ? useLayoutEffect : useEffect;

const defaultStyle: CSSProperties = { display: "block", width: "100%", height: "100%", border: 0 };

/**
 * The draw.io editor in an iframe, connected with the JSON protocol of
 * embed mode. Docs: https://www.drawio.com/react
 */
export const DrawioEditor = forwardRef<DrawioEditorHandle, DrawioEditorProps>(
  function DrawioEditor(props, ref)
  {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const clientRef = useRef<DrawioClient | null>(null);
    const propsRef = useRef(props);
    // The diagram the editor has, as far as the host knows
    const lastXmlRef = useRef<string | undefined>(undefined);
    const startedRef = useRef(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const url = buildEditorUrl(props.baseUrl, props.urlParameters, props.config != null);
    const descriptorKey = (props.descriptor != null) ? JSON.stringify(props.descriptor) : "";

    useIsomorphicLayoutEffect(() =>
    {
      propsRef.current = props;
    });

    useIsomorphicLayoutEffect(() =>
    {
      const client = clientRef.current;
      let active = true;
      clearTimeout(closeTimerRef.current);

      const connect = () =>
      {
        // An iframe that React kept (e.g. <Activity>) has an editor without a client
        const kept = client != null && client.closed && client.url == url;
        client?.close();
        startedRef.current = false;
        const next = new DrawioClient(iframeRef.current!, createClientOptions(url, propsRef, start, dispatch));
        clientRef.current = next;

        if (kept)
        {
          next.reload();
        }
      };

      if (client != null && client.url == url && !client.closed)
      {
        client.attach();
      }
      else if (client != null && client.ready && !client.closed)
      {
        // New URL parameters: takes the diagram to the reloaded editor, which
        // also keeps the old one from asking about unsaved changes
        client.attach();
        client.setModified(false);
        client.getXml().then((xml) =>
        {
          lastXmlRef.current = xml;
        }, () =>
        {
          // Reloads with the last known diagram
        }).then(() =>
        {
          if (active)
          {
            connect();
          }
        });
      }
      else
      {
        connect();
      }

      return () =>
      {
        active = false;
        const current = clientRef.current;
        current?.detach();
        // Closes after an unmount, but not when strict mode runs the effect again
        closeTimerRef.current = setTimeout(() => current?.close(), 0);
      };
    }, [url]);

    // Loads a new diagram from the props
    useEffect(() =>
    {
      const client = clientRef.current;

      if (client != null && startedRef.current &&
        (props.descriptor != null || props.xml !== lastXmlRef.current))
      {
        load(client);
      }
    }, [props.xml, descriptorKey]);

    useImperativeHandle(ref, () => createHandle(clientRef), []);

    function getLoadOptions(): LoadOptions
    {
      const { loadOptions, autosave } = propsRef.current;

      return (autosave != null) ? { ...loadOptions, autosave } : { ...loadOptions };
    }

    function load(client: DrawioClient, xml = propsRef.current.xml,
      descriptor = propsRef.current.descriptor): void
    {
      lastXmlRef.current = xml;
      client.load({ ...getLoadOptions(), xml, descriptor }).catch(() =>
      {
        // Reported as a load event
      });
    }

    function start(client: DrawioClient): void
    {
      const { xml, descriptor, templates } = propsRef.current;
      startedRef.current = true;

      if (lastXmlRef.current != null)
      {
        // The editor started again, e.g. with new URL parameters: keeps the diagram
        load(client, lastXmlRef.current, undefined);
      }
      else if (xml == null && descriptor == null && templates)
      {
        client.showTemplates((templates === true) ? {} : templates, getLoadOptions());
      }
      else
      {
        load(client);
      }
    }

    function dispatch(event: DrawioEvent): void
    {
      const p = propsRef.current;

      if ((event.event == "load" || event.event == "save" || event.event == "autosave") &&
        event.xml != null)
      {
        lastXmlRef.current = event.xml;
      }

      switch (event.event)
      {
        case "load": p.onLoad?.(event); break;
        case "save": p.onSave?.(event); break;
        case "autosave": p.onAutosave?.(event); break;
        case "exit": p.onExit?.(event); break;
        case "export": p.onExport?.(event); break;
      }

      p.onEvent?.(event);
    }

    return (
      <iframe
        ref={iframeRef}
        title={props.title ?? "draw.io editor"}
        className={props.className}
        style={{ ...defaultStyle, ...props.style }}
        allow="clipboard-read; clipboard-write"
      />
    );
  }
);

/** Options that read the latest props, so the client does not depend on their identity. */
function createClientOptions(url: string, propsRef: { current: DrawioEditorProps },
  onInit: (client: DrawioClient) => void, onEvent: (event: DrawioEvent) => void): DrawioClientOptions
{
  return {
    url,
    onInit,
    onEvent,
    get config()
    {
      return propsRef.current.config;
    },
    get requestTimeout()
    {
      return propsRef.current.requestTimeout;
    },
    get remoteFunctions()
    {
      return propsRef.current.remoteFunctions;
    }
  };
}

/** Forwards the methods to the current client. */
function createHandle(clientRef: { current: DrawioClient | null }): DrawioEditorHandle
{
  const handle: Record<string, unknown> = {};

  for (const name of asyncMethods)
  {
    handle[name] = (...args: unknown[]) =>
    {
      const client = clientRef.current as unknown as Record<string, (...a: unknown[]) => unknown> | null;

      return (client != null) ? client[name](...args) :
        Promise.reject(new DrawioError("closed", "The editor is not mounted"));
    };
  }

  for (const name of syncMethods)
  {
    handle[name] = (...args: unknown[]) =>
    {
      const client = clientRef.current as unknown as Record<string, (...a: unknown[]) => unknown> | null;
      client?.[name](...args);
    };
  }

  Object.defineProperty(handle, "client", { get: () => clientRef.current });

  return handle as unknown as DrawioEditorHandle;
}
