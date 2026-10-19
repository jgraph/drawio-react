// End-to-end scenarios of the examples in examples/src: the code the docs
// tell people to copy must work. They drive the editor in the iframe with
// its own API and check the host page. Draw.loadPlugin gives the EditorUi;
// without plugins (embedInline) the next load of a diagram does.

/** The frame of the editor whose URL contains the given text. */
async function editorFrame(page, match = "embed=1")
{
  let frame = null;

  await page.waitForFunction(() => document.querySelector("iframe[src]") != null, { timeout: 30000 });

  for (let i = 0; i < 300 && frame == null; i++)
  {
    frame = page.frames().find((f) => f.url().includes(match) && !f.isDetached()) ?? null;

    if (frame == null)
    {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  if (frame == null)
  {
    throw new Error("No editor frame");
  }

  await frame.waitForFunction(() => typeof App !== "undefined", { timeout: 60000 });
  await frame.evaluate(() =>
  {
    if (window.Draw?.loadPlugin != null)
    {
      return new Promise((resolve) => window.Draw.loadPlugin((ui) =>
      {
        window.testUi = ui;
        resolve();
      }));
    }

    const setCurrentFile = App.prototype.setCurrentFile;

    App.prototype.setCurrentFile = function()
    {
      window.testUi = this;

      return setCurrentFile.apply(this, arguments);
    };
  });

  return frame;
}

/** Waits until the editor in the frame has a diagram that is enabled. */
async function waitForDiagram(frame, text)
{
  await frame.waitForFunction((t) =>
  {
    const ui = window.testUi;

    return ui != null && ui.editor.graph.isEnabled() && (t == null ||
      mxUtils.getXml(ui.editor.getGraphXml()).includes(t));
  }, { timeout: 30000 }, text);
}

async function insertCell(frame, label)
{
  await frame.evaluate((l) =>
  {
    const graph = window.testUi.editor.graph;
    graph.insertVertex(graph.getDefaultParent(), null, l, 40, 40, 160, 60);
  }, label);
}

/** Clicks the button of the editor with the given text. */
async function clickButton(frame, text)
{
  await frame.waitForFunction((t) => [...document.querySelectorAll("button, .geBtn, a")]
    .some((b) => b.textContent.trim() == t), { timeout: 30000 }, text);
  await frame.evaluate((t) => [...document.querySelectorAll("button, .geBtn, a")]
    .find((b) => b.textContent.trim() == t).click(), text);
}

function assert(condition, message)
{
  if (!condition)
  {
    throw new Error(message);
  }
}

export const exampleScenarios = {
  async "quick-start"(page)
  {
    const frame = await editorFrame(page);
    await waitForDiagram(frame);
    await insertCell(frame, "Quick");
    await clickButton(frame, "Save");
    await frame.waitForFunction(() => !window.testUi.editor.modified);
  },

  async autosave(page)
  {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    let frame = await editorFrame(page);
    await waitForDiagram(frame);
    await insertCell(frame, "Stored");
    await page.waitForFunction(() => localStorage.getItem("drawio-example")?.includes("Stored"));
    await frame.waitForFunction(() => !window.testUi.editor.modified);

    await page.reload({ waitUntil: "domcontentloaded" });
    frame = await editorFrame(page);
    await waitForDiagram(frame, "Stored");
  },

  async export(page)
  {
    await page.evaluate(() =>
    {
      window.downloads = [];
      HTMLAnchorElement.prototype.click = function()
      {
        window.downloads.push({ name: this.download, href: this.href.slice(0, 30) });
      };
    });

    const frame = await editorFrame(page);
    await waitForDiagram(frame);
    await insertCell(frame, "Export");

    for (const text of ["PNG", "SVG", "Editable SVG", ".drawio"])
    {
      await page.evaluate((t) => [...document.querySelectorAll("button")].find((b) => b.textContent == t).click(), text);
    }

    await page.waitForFunction(() => window.downloads.length == 4, { timeout: 30000 });
    const downloads = Object.fromEntries((await page.evaluate(() => window.downloads)).map((d) => [d.name, d.href]));
    assert(downloads["diagram.png"]?.startsWith("data:image/png"), "PNG download");
    assert(downloads["diagram.svg"]?.startsWith("data:image/svg+xml"), "SVG download");
    assert(downloads["diagram.drawio.svg"]?.startsWith("data:image/svg+xml"), "editable SVG download");
    assert(downloads["diagram.drawio"]?.startsWith("data:application/xml"), ".drawio download");
  },

  async "editable-image"(page)
  {
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent == "Insert a diagram").click());
    let frame = await editorFrame(page);
    await waitForDiagram(frame);
    await insertCell(frame, "Editable");
    await clickButton(frame, "Save & Exit");

    await page.waitForFunction(() => document.querySelector("img.diagram")?.src.startsWith("data:image/svg+xml") &&
      document.querySelector(".overlay") == null, { timeout: 30000 });

    await page.click("img.diagram");
    frame = await editorFrame(page);
    await waitForDiagram(frame, "Editable");
  },

  async "inline-editing"(page)
  {
    const frame = await editorFrame(page);
    await page.click(".inline-target");
    await waitForDiagram(frame);
    await page.waitForFunction(() => document.querySelector("iframe").style.visibility == "visible");
    await insertCell(frame, "Inline");

    // What Escape does
    await frame.evaluate(() => window.testUi.actions.get("exit").funct());
    await page.waitForFunction(() => document.querySelector(".inline-target img")?.src.startsWith("data:image/svg+xml") &&
      document.querySelector("iframe").style.visibility == "hidden", { timeout: 30000 });

    await page.click(".inline-target");
    await waitForDiagram(frame, "Inline");
  },

  async mermaid(page)
  {
    const frame = await editorFrame(page);
    await waitForDiagram(frame, "Ship it");

    await page.click("textarea");
    await page.keyboard.down(process.platform == "darwin" ? "Meta" : "Control");
    await page.keyboard.press("a");
    await page.keyboard.up(process.platform == "darwin" ? "Meta" : "Control");
    await page.keyboard.type("graph LR\n  Xray --> Yankee");
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent == "Convert").click());
    await waitForDiagram(frame, "Yankee");
  },

  async templates(page)
  {
    const frame = await editorFrame(page);
    await clickButton(frame, "Create");
    await waitForDiagram(frame);
  },

  async options(page)
  {
    let frame = await editorFrame(page);
    await waitForDiagram(frame);
    assert(await frame.evaluate(() => Editor.config?.presetColors?.[0] == "E6F4EA"), "configuration applied");

    // The reloaded editor keeps the diagram
    await insertCell(frame, "Kept");
    await page.select("select", "min");
    frame = await editorFrame(page, "ui=min");
    await waitForDiagram(frame, "Kept");
  }
};
