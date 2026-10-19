import type { UrlParameters } from "./protocol";

/** The draw.io editor for embedding. */
export const DEFAULT_BASE_URL = "https://embed.diagrams.net/";

/**
 * Returns the URL of the editor for the iframe: the base URL with the given
 * URL parameters and `embed=1&proto=json`, plus `configure=1` if the host
 * sends a configuration. Booleans become `1` and `0`. A relative base URL is
 * resolved against the page. Throws for URLs that are not http or https.
 */
export function buildEditorUrl(baseUrl: string = DEFAULT_BASE_URL,
  parameters: UrlParameters = {}, configure = false): string
{
  const url = parseEditorUrl(baseUrl);
  const values: Record<string, string> = { spin: "1" };

  for (const [key, value] of Object.entries(parameters))
  {
    if (value != null)
    {
      values[key] = (typeof value === "boolean") ? (value ? "1" : "0") : String(value);
    }
  }

  values.embed = "1";
  values.proto = "json";

  if (configure)
  {
    values.configure = "1";
  }

  for (const [key, value] of Object.entries(values))
  {
    url.searchParams.set(key, value);
  }

  return url.href;
}

/**
 * Resolves the URL of the editor against the page. Throws for URLs that are
 * not http or https: a javascript: URL in an iframe runs in the page, and a
 * data: URL has the origin "null", which any sandboxed frame has too.
 */
export function parseEditorUrl(value: string): URL
{
  const base = (typeof location !== "undefined") ? location.href : undefined;
  const url = new URL(value, base);

  if ((url.protocol != "https:" && url.protocol != "http:") || url.origin == "null")
  {
    throw new Error("The editor URL must be http or https: " + url.protocol);
  }

  return url;
}
