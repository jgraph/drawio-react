import { describe, expect, it } from "vitest";
import { buildEditorUrl } from "../src/url";

describe("buildEditorUrl", () =>
{
  it("adds the embed parameters to the default URL", () =>
  {
    expect(buildEditorUrl()).toBe("https://embed.diagrams.net/?spin=1&embed=1&proto=json");
  });

  it("sends booleans as 1 and 0 and skips undefined values", () =>
  {
    const url = new URL(buildEditorUrl(undefined, { ui: "min", libraries: true, noExitBtn: false, lang: undefined }));

    expect(url.searchParams.get("ui")).toBe("min");
    expect(url.searchParams.get("libraries")).toBe("1");
    expect(url.searchParams.get("noExitBtn")).toBe("0");
    expect(url.searchParams.has("lang")).toBe(false);
  });

  it("keeps embed and proto and adds configure", () =>
  {
    const url = new URL(buildEditorUrl("https://example.com/drawio/?offline=1", { embed: "0", proto: "xml" }, true));

    expect(url.pathname).toBe("/drawio/");
    expect(url.searchParams.get("offline")).toBe("1");
    expect(url.searchParams.get("embed")).toBe("1");
    expect(url.searchParams.get("proto")).toBe("json");
    expect(url.searchParams.get("configure")).toBe("1");
  });

  it("lets the spinner be turned off", () =>
  {
    expect(new URL(buildEditorUrl(undefined, { spin: false })).searchParams.get("spin")).toBe("0");
  });

  it("resolves relative URLs against the page", () =>
  {
    expect(buildEditorUrl("/drawio/")).toBe(location.origin + "/drawio/?spin=1&embed=1&proto=json");
  });

  it("rejects URLs that are not http or https", () =>
  {
    expect(() => buildEditorUrl("javascript:alert(1)")).toThrow();
    expect(() => buildEditorUrl("data:text/html,<script>alert(1)</script>")).toThrow();
  });
});
