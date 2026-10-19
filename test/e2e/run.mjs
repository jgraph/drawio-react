// End-to-end test of DrawioEditor with the real draw.io editor in headless
// Chrome. Serves test/e2e/app and the examples with Vite and runs the
// scenarios of main.tsx and examples.mjs.
//
//   DRAWIO_URL=https://test.draw.io/?dev=1 node test/e2e/run.mjs [scenario]
//
// DRAWIO_URL is a draw.io that headless Chrome can load: embed.diagrams.net
// refuses headless browsers, so use a local build (src/main/webapp of
// jgraph/drawio served over http).
//
// Chrome: CHROME_PATH, or the newest Chrome for Testing in the Puppeteer
// cache (npx @puppeteer/browsers install chrome@stable --path ~/.cache/puppeteer).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { exampleScenarios } from "./examples.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.DRAWIO_URL ?? "https://embed.diagrams.net/";
const only = process.argv[2];

const XML_C = "<mxGraphModel><root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/>" +
  "<mxCell id=\"c\" value=\"Charlie\" vertex=\"1\" parent=\"1\">" +
  "<mxGeometry x=\"300\" y=\"40\" width=\"120\" height=\"60\" as=\"geometry\"/></mxCell></root></mxGraphModel>";

function findChrome()
{
  if (process.env.CHROME_PATH)
  {
    return process.env.CHROME_PATH;
  }

  const cache = path.join(process.env.PUPPETEER_CACHE_DIR ?? path.join(os.homedir(), ".cache", "puppeteer"), "chrome");
  const versions = fs.existsSync(cache) ? fs.readdirSync(cache) : [];
  const byVersion = (a, b) =>
  {
    const va = a.split("-").pop().split(".").map(Number);
    const vb = b.split("-").pop().split(".").map(Number);

    return vb.reduce((d, n, i) => d || (n - va[i]), 0);
  };

  for (const dir of versions.sort(byVersion))
  {
    const candidates = [
      "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      "chrome-linux64/chrome",
      "chrome-win64/chrome.exe"
    ];

    for (const candidate of candidates)
    {
      const file = path.join(cache, dir, candidate);

      if (fs.existsSync(file))
      {
        return file;
      }
    }
  }

  throw new Error("No Chrome for Testing found, set CHROME_PATH");
}

/** Waits until the page has an event that matches. */
async function waitForEvent(page, match, timeout = 30000)
{
  try
  {
    await page.waitForFunction((m) => window.events.some((e) =>
      Object.entries(m).every(([k, v]) => e[k] === v)), { timeout }, match);
  }
  catch (e)
  {
    const events = await page.evaluate(() => window.events.map((e) => e.editor + ":" + e.event).join(", "));
    throw new Error("No event " + JSON.stringify(match) + ", got: " + events);
  }
}

async function count(page, match)
{
  return page.evaluate((m) => window.events.filter((e) =>
    Object.entries(m).every(([k, v]) => e[k] === v)).length, match);
}

function assert(condition, message)
{
  if (!condition)
  {
    throw new Error(message);
  }
}

const scenarios = {
  async basic(page)
  {
    await waitForEvent(page, { editor: "a", event: "load" });
    const load = await page.evaluate(() => window.events.find((e) => e.event == "load"));
    assert(load.xml.includes("Alpha"), "load event has the diagram");
    assert(load.modelBounds.width > 0, "load event has the bounds");

    const xml = await page.evaluate(() => window.editors.a.getXml());
    assert(xml.includes("Alpha"), "getXml returns the diagram");

    const [png, svg, xmlsvg, json] = await page.evaluate(() => Promise.all([
      window.editors.a.export({ format: "png", scale: 2 }),
      window.editors.a.export({ format: "svg" }),
      window.editors.a.export({ format: "xmlsvg" }),
      window.editors.a.export({ format: "json" })
    ]).then((r) => r.map((e) => ({ format: e.format, data: e.data }))));
    assert(png.data.startsWith("data:image/png;base64,"), "png export: " + png.data.slice(0, 30));
    assert(svg.data.startsWith("data:image/svg+xml"), "svg export");
    assert(xmlsvg.format == "svg" && xmlsvg.data.startsWith("data:image/svg+xml"), "xmlsvg export");
    assert(json.data.pages[0].cells.some((c) => c.label == "Alpha"), "json export");

    const text = await page.evaluate(() => window.editors.a.getTextContent());
    assert(text.includes("Alpha"), "text content");

    const fit = await page.evaluate(() => window.editors.a.fit({ border: 20 }));
    assert(fit.event == "fit" && fit.scale > 0, "fit");

    const viewbox = await page.evaluate(() => window.editors.a.viewbox({ x: 0, y: 0, width: 400, height: 300 }));
    assert(viewbox.event == "viewbox", "viewbox");

    // Merges a cell into the current page. Pages are matched by ID, so the
    // editor needs a file with page IDs: a plain mxGraphModel gets new ones.
    await page.evaluate((x) => window.editors.a.load({ xml: x, autosave: true }), xml);
    const cell = XML_C.match(/<mxCell id="c".*?<\/mxCell>/)[0];
    await page.evaluate((x) => window.editors.a.merge(x), xml.replace("</root>", cell + "</root>"));
    await waitForEvent(page, { editor: "a", event: "autosave" });
    const merged = await page.evaluate(() => window.editors.a.getXml());
    assert(merged.includes("Charlie") && merged.includes("Alpha"), "merge adds the cells");

    const merge = await page.evaluate(() => window.editors.a.merge("<notxml").then(() => "resolved", (e) => e.code));
    assert(merge == "editor", "merge of an invalid file rejects: " + merge);

    await page.evaluate(() => window.editors.a.invokeAction("save"));
    await waitForEvent(page, { editor: "a", event: "save" });

    // A new xml prop loads it, the diagram the editor reported does not
    await page.evaluate(() => window.setXml(window.events.filter((e) => e.event == "autosave").pop().xml));
    await new Promise((r) => setTimeout(r, 500));
    assert(await count(page, { event: "load" }) == 2, "no reload of the autosaved diagram");
    await page.evaluate(() => window.setXml(window.events.find((e) => e.event == "load").xml.replace(/Alpha/g, "Delta")));
    await page.waitForFunction(() => window.events.filter((e) => e.event == "load").length == 3);
    assert((await page.evaluate(() => window.editors.a.getXml())).includes("Delta"), "xml prop reloads");
  },

  async two(page)
  {
    await waitForEvent(page, { editor: "a", event: "load" });
    await waitForEvent(page, { editor: "b", event: "load" });
    const [a, b] = await page.evaluate(() => Promise.all([window.editors.a.getXml(), window.editors.b.getXml()]));
    assert(a.includes("Alpha") && !a.includes("Bravo"), "editor a has its diagram");
    assert(b.includes("Bravo") && !b.includes("Alpha"), "editor b has its diagram");

    await page.evaluate(() => window.editors.b.invokeAction("save"));
    await waitForEvent(page, { editor: "b", event: "save" });
    assert(await count(page, { editor: "a", event: "save" }) == 0, "events stay with their editor");
  },

  async config(page)
  {
    await waitForEvent(page, { editor: "a", event: "load" });
    assert(await count(page, { event: "configure" }) == 1, "configure handshake");
  },

  async mermaid(page)
  {
    await waitForEvent(page, { editor: "a", event: "load" });
    const xml = await page.evaluate(() => window.editors.a.getXml());
    assert(xml.includes("Start") && xml.includes("End"), "Mermaid converted");
  },

  async csv(page)
  {
    await waitForEvent(page, { editor: "a", event: "load" });
    const xml = await page.evaluate(() => window.editors.a.getXml());
    assert(xml.includes("CsvNode"), "CSV imported");
  },

  async templates(page)
  {
    const frame = await (await page.waitForSelector("iframe")).contentFrame();
    const create = await frame.waitForFunction(() => [...document.querySelectorAll("button")]
      .find((b) => b.textContent.trim() == "Create"), { timeout: 60000 });
    await create.click();
    await waitForEvent(page, { editor: "a", event: "template" });
    await waitForEvent(page, { editor: "a", event: "load" });
  }
};

const appServer = await createServer({
  root: path.join(dir, "app"),
  configFile: false,
  logLevel: "error",
  plugins: [react()],
  server: { port: 0, strictPort: false }
});

// The examples use the draw.io of DRAWIO_URL in English (see examples/vite.config.ts)
process.env.DRAWIO_URL = base + (base.includes("?") ? "&" : "?") + "lang=en";
const examplesServer = await createServer({
  root: path.join(dir, "..", "..", "examples"),
  configFile: path.join(dir, "..", "..", "examples", "vite.config.ts"),
  logLevel: "error",
  server: { port: 0, strictPort: false }
});

await appServer.listen();
await examplesServer.listen();

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  // Linux CI runners have no user namespaces for the sandbox of Chrome
  args: ["--use-mock-keychain", "--no-first-run", ...(process.env.CI ? ["--no-sandbox"] : [])]
});

const suites = [
  ...Object.entries(scenarios).map(([name, run]) =>
    ({ name, run, url: appServer.resolvedUrls.local[0] + "?case=" + name + "&base=" + encodeURIComponent(base) })),
  ...Object.entries(exampleScenarios).map(([name, run]) =>
    ({ name: "example " + name, run, url: examplesServer.resolvedUrls.local[0] + "#" + name }))
];

let failed = 0;
console.log("Editor: " + base);

for (const { name, run, url } of suites)
{
  if (only != null && !name.includes(only))
  {
    continue;
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // A beforeunload prompt of the editor fails the scenario
  page.on("dialog", (d) => { errors.push("dialog: " + d.type()); d.accept(); });
  const started = Date.now();

  try
  {
    await page.goto(url);
    await run(page);
    assert(errors.length == 0, "page errors: " + errors.join("; "));
    console.log("  ok   " + name + " (" + (Date.now() - started) + " ms)");
  }
  catch (e)
  {
    failed++;
    console.log("  FAIL " + name + ": " + e.message);
  }

  await page.close();
}

await browser.close();
await appServer.close();
await examplesServer.close();
process.exit(failed ? 1 : 0);
