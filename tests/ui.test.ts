import { test, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fresh, addNode } from "../src/model";
const dom = new JSDOM("<body></body>", {
  url: "https://localhost",
  pretendToBeVisual: true,
});
const win = dom.window;
Object.assign(globalThis, {
  document: win.document,
  HTMLElement: win.HTMLElement,
  window: win,
  MutationObserver: win.MutationObserver,
  Node: win.Node,
  Window: win.Window,
  getComputedStyle: win.getComputedStyle.bind(win),
  requestAnimationFrame: win.requestAnimationFrame.bind(win),
  cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
  ResizeObserver: class {
    observe() {}
    disconnect() {}
  },
});
after(() => win.close());
test("Loop Hero reference replaces shipped approximation but preserves custom palettes", async () => {
  const expected = [
    "#000000",
    "#232323",
    "#602217",
    "#3a3f3f",
    "#815938",
    "#626439",
    "#686f6f",
    "#497aa7",
    "#cd6627",
    "#879b42",
    "#af9156",
    "#5ea2b0",
    "#9fa089",
    "#a4bec1",
    "#dbce2d",
    "#ffffff",
  ];
  storedConfig = {
    palette: "Loop Hero",
    palettes: {
      "Loop Hero": [
        "#d6c5a0",
        "#b7aa83",
        "#a99b70",
        "#d0ad62",
        "#bb874b",
        "#d39b75",
        "#c16b58",
        "#9e5960",
        "#b58b8d",
        "#9b839d",
        "#8a91aa",
        "#789da1",
        "#6d9385",
        "#8d9e6a",
        "#a7ad79",
        "#c6c4a7",
      ],
      Personal: ["#123456"],
    },
  };
  const v = await view();
  assert.deepEqual(v.plugin.config.palettes["Loop Hero"], expected);
  assert.equal(v.plugin.config.palette, "Loop Hero");
  assert.deepEqual(v.plugin.config.palettes.Personal, ["#123456"]);
  storedConfig = { palettes: { "Loop Hero": ["#abcdef"] } };
  const custom = await view();
  assert.deepEqual(custom.plugin.config.palettes["Loop Hero"], ["#abcdef"]);
  storedConfig = undefined;
});
const proto = win.HTMLElement.prototype as any;
proto.empty = function () {
  this.replaceChildren();
};
proto.createEl = function (tag: string, opts: any = {}) {
  const el = win.document.createElement(tag);
  if (opts.cls) el.className = opts.cls;
  if (opts.text) el.textContent = opts.text;
  if (opts.type) el.setAttribute("type", opts.type);
  if (opts.value !== undefined) (el as HTMLInputElement).value = opts.value;
  for (const [k, v] of Object.entries(opts.attr ?? {}))
    el.setAttribute(k, String(v));
  this.appendChild(el);
  return el;
};
proto.createDiv = function (o: any) {
  return this.createEl("div", o);
};
proto.createSpan = function (o: any) {
  return this.createEl("span", o);
};
proto.addClass = function (c: string) {
  this.classList.add(c);
};
proto.toggleClass = function (c: string, v: boolean) {
  this.classList.toggle(c, v);
};
proto.setText = function (s: string) {
  this.textContent = s;
};
proto.setPointerCapture = function () {};
class Component {
  addChild() {}
  register() {}
  load() {}
  unload() {}
  registerEvent() {}
  registerDomEvent(el: any, k: any, f: any, options?: any) {
    el.addEventListener(k, f, options);
  }
}
let factory: any,
  lastModal: any,
  storedConfig: any,
  lastMenu: any,
  settingsTab: any;
const app: any = {
  vault: {
    on() {},
    getFiles() {
      return [];
    },
    getAbstractFileByPath() {
      return null;
    },
  },
  workspace: { on() {} },
};
class Plugin extends Component {
  async loadData() {
    return storedConfig;
  }
  async saveData(value: any) {
    storedConfig = structuredClone(value);
  }
  addSettingTab(tab: any) {
    settingsTab = tab;
  }
  app = app;
  registerView(_: any, f: any) {
    factory = f;
  }
  registerExtensions() {}
  addRibbonIcon() {}
  addCommand() {}
}
class TextFileView extends Component {
  contentEl = win.document.createElement("div");
  app = app;
  saves = 0;
  requestSave() {
    this.saves++;
  }
  constructor(..._: any[]) {
    super();
    win.document.body.appendChild(this.contentEl);
  }
}
class Modal {
  modalEl = win.document.createElement("div");
  doc = win.document;
  app: any;
  contentEl = win.document.createElement("div");
  constructor(..._: any[]) {
    lastModal = this;
    this.app = _[0];
  }
  open() {
    assert.equal(this.doc, win.document, "Modal must retain its own Document");
    (this as any).onOpen?.();
  }
  close() {}
}
const mock = {
  Plugin,
  Scope: class {
    register() {}
  },
  TextFileView,
  Component,
  Modal,
  PluginSettingTab: class {
    containerEl = document.createElement("div");
    app = app;
  },
  Menu: class {
    items: any[] = [];
    constructor() {
      lastMenu = this;
    }
    addItem(cb: any) {
      const item: any = {
        setTitle(t: string) {
          this.title = t;
          return this;
        },
        setChecked(v: boolean) {
          this.checked = v;
          return this;
        },
        onClick(f: any) {
          this.run = f;
          return this;
        },
      };
      cb(item);
      this.items.push(item);
      return this;
    }
    showAtPosition() {}
  },
  FuzzySuggestModal: class {
    constructor(..._: any[]) {
      lastModal = this;
    }
    setPlaceholder() {}
    open() {}
  },
  TFile: class {
    extension = "md";
    stat = { size: 0 };
  },
  Notice: class {},
  setIcon: (el: any, id: string) => el.setAttribute("data-icon", id),
  getIconIds: () => ["circle-help", "chess-knight", "chess-queen", "book-open"],
  normalizePath: (s: string) => s,
  MarkdownRenderer: {
    render: async (_: any, s: string, el: any) => {
      el.textContent = s;
    },
  },
};
const source = readFileSync(new URL("../main.js", import.meta.url), "utf8");
const module = { exports: {} as any };
const require = createRequire(import.meta.url);
new Function("require", "module", "exports", source)(
  (id: string) => (id === "obsidian" ? mock : require(id)),
  module,
  module.exports,
);
async function view() {
  await new module.exports.default().onload();
  const v = factory({});
  app.workspace.getActiveViewOfType = () => v;
  await v.onOpen();
  return v;
}
test("actual bundled view: create, immediate rename, note editing, collapse, delete warning, undo, reload", async () => {
  const v = await view(),
    d = fresh();
  v.setViewData(JSON.stringify(d), true);
  const click = (selector: string) => {
    const el = v.contentEl.querySelector(selector);
    assert.ok(el, selector);
    el.click();
  };
  click(".bt-add");
  assert.equal(v.doc.nodes.length, 2);
  const input = v.contentEl.querySelector(".bt-rename") as HTMLInputElement;
  assert.ok(input);
  assert.equal(win.document.activeElement, input);
  input.value = "Моя ветка";
  input.dispatchEvent(
    new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  assert.equal(v.doc.nodes[1].title, "Моя ветка");
  const id = v.doc.nodes[1].id;
  click(`[data-id="${id}"] .bt-circle`);
  assert.ok(v.contentEl.querySelector(".bt-panel.is-open"));
  v.noteEditor.view.dispatch({
    changes: {
      from: 0,
      to: v.noteEditor.view.state.doc.length,
      insert: "**Содержимое**",
    },
  });
  assert.equal(v.contentEl.querySelectorAll(".bt-live-editor").length, 1);
  assert.equal(
    v.contentEl.querySelectorAll(".bt-note-surface textarea").length,
    0,
  );
  click('[aria-label="Показать исходный текст"]');
  assert.equal(v.noteEditor.source, true);
  assert.equal(v.noteEditor.view.state.doc.toString(), "**Содержимое**");
  click('[aria-label="Вернуть оформление Markdown"]');
  assert.equal(v.doc.nodes[1].body, "**Содержимое**");
  const rich = "## Заголовок\n\n**Жирный**\n\n| A | B |\n| - | - |\n| 1 | 2 |";
  v.noteEditor.view.dispatch({
    changes: { from: 0, to: v.noteEditor.view.state.doc.length, insert: rich },
  });
  assert.ok(v.contentEl.querySelector(".bt-md-h2"));
  assert.ok(v.contentEl.querySelector(".bt-md-widget"));
  assert.equal(v.doc.nodes[1].body, rich);
  v.noteEditor.view.dispatch({
    changes: {
      from: 0,
      to: v.noteEditor.view.state.doc.length,
      insert: "**Содержимое**",
    },
  });
  click(`[data-id="${id}"] .bt-add`);
  v.contentEl
    .querySelector(".bt-rename")
    .dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter" }));
  assert.equal(v.doc.nodes.length, 3);
  click(`[data-id="${id}"] .bt-collapse`);
  assert.equal(
    v.contentEl.querySelectorAll(".bt-node:not(.bt-exiting)").length,
    2,
  );
  assert.ok(v.contentEl.querySelector(".bt-node.bt-exiting"));
  assert.equal(v.contentEl.querySelector(".bt-badge").textContent, "+1");
  click(`[data-id="${id}"] .bt-delete`);
  assert.equal(v.doc.nodes.length, 3);
  assert.match(lastModal.contentEl.textContent, /пунктов — 2/);
  lastModal.contentEl.querySelector(".mod-warning").click();
  assert.equal(v.doc.nodes.length, 1);
  click('[aria-label="Отменить · Ctrl+Z"]');
  assert.equal(v.doc.nodes.length, 3);
  const saved = v.getViewData();
  const v2 = await view();
  v2.setViewData(saved, true);
  assert.equal(v2.doc.nodes[1].body, "**Содержимое**");
  assert.equal(v2.contentEl.querySelectorAll(".bt-node").length, 2);
  assert.ok(v.saves > 0);
});
test("panel resize persists across reopen and clamps to available space", async () => {
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  v.contentEl.querySelector(".bt-circle").click();
  const divider = v.contentEl.querySelector(".bt-panel-divider");
  const panel = v.contentEl.querySelector(".bt-panel");
  Object.defineProperty(panel.parentElement, "clientWidth", {
    value: 1200,
    configurable: true,
  });
  divider.onpointerdown({
    button: 0,
    clientX: 600,
    pointerId: 1,
    preventDefault() {},
  });
  divider.onpointermove({ clientX: 400 });
  divider.onpointerup();
  assert.equal(v.doc.panelWidth, 620);
  assert.equal(panel.style.width, "620px");
  const v2 = await view();
  v2.setViewData(v.getViewData(), true);
  v2.contentEl.querySelector(".bt-circle").click();
  assert.equal(v2.contentEl.querySelector(".bt-panel").style.width, "620px");
  divider.onpointerdown({
    button: 0,
    clientX: 400,
    pointerId: 1,
    preventDefault() {},
  });
  divider.onpointermove({ clientX: -3000 });
  divider.onpointerup();
  assert.equal(v.doc.panelWidth, 900);
  divider.onpointerdown({
    button: 0,
    clientX: 400,
    pointerId: 1,
    preventDefault() {},
  });
  divider.onpointermove({ clientX: 3000 });
  divider.onpointercancel();
  assert.equal(v.doc.panelWidth, 900);
  Object.defineProperty(panel.parentElement, "clientWidth", {
    value: 600,
    configurable: true,
  });
  divider.onkeydown({ key: "ArrowLeft", preventDefault() {} });
  assert.equal(panel.style.width, "440px");
});
test("malformed document is retained verbatim and editor disabled", async () => {
  const v = await view();
  v.setViewData("{broken", true);
  assert.equal(v.getViewData(), "{broken");
  assert.equal(v.contentEl.querySelectorAll(".bt-node").length, 0);
  assert.match(v.contentEl.textContent, /Исходный файл не изменён/);
});
test("dragging onto a parent reparents subtree and highlights destination", async () => {
  const v = await view();
  const d = fresh(),
    r = d.nodes[0],
    a = addNode(d, r.id),
    b = addNode(d, r.id),
    c = addNode(d, a.id);
  v.setViewData(JSON.stringify(d), true);
  const circle = v.contentEl.querySelector(`[data-id="${a.id}"] .bt-circle`);
  circle.onpointerdown({
    button: 0,
    clientX: 0,
    clientY: -168,
    pointerId: 1,
    stopPropagation() {},
  });
  circle.onpointermove({ clientX: 0, clientY: 168 });
  const edge = v.contentEl.querySelector(`[data-child="${a.id}"]`);
  const movedY = v.positions.get(a.id).y + 336;
  assert.equal(edge.getAttribute("d"), `M 0 0 V ${movedY / 2} H 0 V ${movedY}`);
  const childEdge = v.contentEl.querySelector(`[data-child="${c.id}"]`);
  const childY = v.positions.get(c.id).y + 336;
  assert.equal(
    childEdge.getAttribute("d"),
    `M 0 ${movedY} V ${(movedY + childY) / 2} H 0 V ${childY}`,
  );
  assert.ok(v.contentEl.querySelector(`[data-id="${b.id}"].bt-drop-target`));
  circle.onpointerup({ clientX: 0, clientY: 168 });
  assert.equal(v.doc.nodes.find((n: any) => n.id === a.id).parent, b.id);
  assert.equal(v.doc.nodes.find((n: any) => n.id === c.id).parent, a.id);
});
test("configuration survives plugin reload, affects geometry and only new icons/colors", async () => {
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  const c = structuredClone(v.plugin.config);
  c.size = 120;
  c.gapX = 100;
  c.gapY = 120;
  c.rootScale = 1.3;
  c.shape = "hexagon";
  c.palettes.Custom = ["#123456"];
  c.palette = "Custom";
  c.iconSets.Custom = ["chess-knight"];
  c.icons = "Custom";
  await v.plugin.updateConfig(c);
  assert.equal(v.config.size, 80, "existing tree retains its own settings");
  v.change(() => {
    v.doc.settings = structuredClone(c);
  });
  assert.equal(
    v.contentEl.querySelector(".bt-root").style.getPropertyValue("--node-size"),
    "156px",
  );
  assert.ok(v.contentEl.querySelector(".bt-root polygon"));
  v.contentEl.querySelector(".bt-add").click();
  assert.equal(v.doc.nodes[1].icon, "chess-knight");
  assert.equal(v.doc.nodes[1].color, "#123456");
  assert.equal(v.doc.nodes[0].icon, "circle-help");
  assert.equal(v.positions.get(v.doc.nodes[1].id).y, -276);
  const v2 = await view();
  assert.equal(v2.plugin.config.size, 120);
  assert.deepEqual(v2.plugin.config.palettes.Custom, ["#123456"]);
  storedConfig = {
    size: -100,
    palette: "missing",
    shape: "constructor",
    palettes: { Empty: [] },
  };
  const v3 = await view();
  assert.equal(v3.plugin.config.size, 48);
  assert.equal(v3.plugin.config.shape, "circle");
  assert.equal(v3.plugin.config.palette, "Яркая");
  storedConfig = undefined;
});
test("palette menu, visual shapes, hover ownership and creation animation", async () => {
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  v.contentEl.querySelector(".bt-add").click();
  const id = v.doc.nodes[1].id;
  assert.ok(v.contentEl.querySelector(`[data-id="${id}"].bt-node-new`));
  assert.ok(v.contentEl.querySelector(".bt-edge-new"));
  const circle = v.contentEl.querySelector(`[data-id="${id}"] .bt-circle`);
  circle.onpointerenter();
  assert.equal(v.contentEl.querySelectorAll(".is-hovered").length, 1);
  circle.click();
  v.contentEl.querySelector('[aria-label="Цвет ветки"]').click();
  const menu = v.contentEl.querySelector(".bt-color-menu");
  assert.equal(menu.hidden, false);
  const swatch = menu.querySelector(".bt-color-swatches button");
  swatch.click();
  assert.equal(v.doc.nodes[1].color, swatch.getAttribute("data-color"));
  menu.querySelector(":scope > button").click();
  assert.equal(v.doc.nodes[1].color, undefined);
  v.contentEl.querySelector('[aria-label="Форма узла"]').click();
  assert.equal(menu.hidden, true);
  const form = v.contentEl.querySelector(".bt-shape-menu");
  assert.equal(form.querySelectorAll(".bt-shape-grid button").length, 9);
  form.querySelector('[aria-label="Пятиугольник"]').click();
  assert.equal(v.doc.nodes[1].shape, "pentagon");
  assert.equal(
    v.contentEl
      .querySelector(`[data-id="${id}"] polygon`)
      .getAttribute("points")
      .split(" ").length,
    5,
  );
  form.querySelector('[aria-label="Волнистая печать"]').click();
  assert.equal(v.doc.nodes[1].shape, "seal");
  assert.ok(v.contentEl.querySelector(`[data-id="${id}"] .bt-shape path`));
  const reopened = await view();
  reopened.setViewData(v.getViewData(), true);
  assert.equal(reopened.doc.nodes[1].shape, "seal");
  assert.equal(reopened.contentEl.querySelectorAll(".bt-node-new").length, 0);
});
test("rename blur preserves the exact plus button for a single click", async () => {
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  v.contentEl.querySelector(".bt-add").click();
  const parent = v.doc.nodes[1],
    input = v.contentEl.querySelector(".bt-rename");
  input.value = "Имя перед созданием";
  const plus = v.contentEl.querySelector(`[data-id="${parent.id}"] .bt-add`);
  input.blur();
  assert.ok(plus.isConnected);
  plus.click();
  assert.equal(v.doc.nodes.length, 3);
  assert.equal(v.doc.nodes[1].title, "Имя перед созданием");
  assert.equal(v.doc.nodes[2].parent, parent.id);
  assert.equal(
    win.document.activeElement,
    v.contentEl.querySelector(".bt-rename"),
  );
});
test("preset cards, zero spacing and visual custom icon selection work end to end", async () => {
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  v.contentEl.querySelector('[aria-label="Настройки дерева"]').click();
  const modal = lastModal;
  const spacing = modal.contentEl.querySelector(
    '[aria-label="Промежуток по горизонтали, px"]',
  );
  spacing.value = "0";
  spacing.dispatchEvent(new win.Event("change"));
  assert.equal(v.config.gapX, 0);
  for (const colors of Object.values(v.config.palettes) as string[][])
    assert.equal(colors.length, 16);
  modal.contentEl.querySelector('[aria-label="Catppuccin Mocha"]').click();
  assert.equal(v.config.palette, "Catppuccin Mocha");
  const editors = modal.contentEl.querySelectorAll(".bt-preset-editor");
  const icons = editors[1];
  icons.querySelector("input").value = "Мой набор";
  const add = [...icons.querySelectorAll("button")].find(
    (b: any) => b.textContent === "Добавить иконку…",
  ) as any;
  add.click();
  lastModal.contentEl.querySelector('[aria-label="chess-knight"]').click();
  lastModal.contentEl.querySelector('[aria-label="chess-queen"]').click();
  assert.equal(
    lastModal.contentEl
      .querySelector('[aria-label="chess-knight"]')
      .getAttribute("aria-pressed"),
    "true",
  );
  [
    ...lastModal.contentEl.parentElement.parentElement.querySelectorAll(
      "button",
    ),
  ]
    .find((b: any) => b.textContent === "Подтвердить выбор")
    .click();
  (
    [...icons.querySelectorAll("button")].find(
      (b: any) => b.textContent === "Сохранить и включить",
    ) as any
  ).click();
  assert.equal(v.config.icons, "Мой набор");
  const random = Math.random;
  try {
    Math.random = () => 0;
    v.add(v.doc.nodes[0].id);
    Math.random = () => 0.99;
    v.add(v.doc.nodes[0].id);
  } finally {
    Math.random = random;
  }
  assert.equal(v.doc.nodes[1].icon, "chess-knight");
  assert.equal(v.doc.nodes[2].icon, "chess-queen");
  modal.contentEl.querySelector('[aria-label="Вопрос"]').click();
  v.add(v.doc.nodes[0].id);
  assert.equal(v.doc.nodes[3].icon, "circle-help");
  storedConfig = undefined;
});

test("clipboard image persists in hidden directory and survives note reopening", async () => {
  const files = new Map<string, ArrayBuffer>();
  app.vault.adapter = {
    exists: async () => true,
    mkdir: async () => {},
    writeBinary: async (p: string, b: ArrayBuffer) => files.set(p, b),
    getResourcePath: (p: string) => "https://localhost/" + p,
  };
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  v.contentEl.querySelector(".bt-circle").click();
  const e = new win.Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(e, "clipboardData", {
    value: {
      files: [
        {
          type: "image/png",
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        },
      ],
    },
  });
  v.noteEditor.view.contentDOM.dispatchEvent(e);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(e.defaultPrevented, true);
  assert.equal(files.size, 1);
  const path = [...files.keys()][0];
  assert.match(path, /^\.skilltree_files\/.*\.png$/);
  assert.ok(v.doc.nodes[0].body.includes(path));
  v.renderPanel();
  assert.ok(v.contentEl.querySelector(".bt-md-widget img")?.src.includes(path));
  const saved = v.getViewData();
  const next = await view();
  next.setViewData(saved, true);
  next.contentEl.querySelector(".bt-circle").click();
  assert.ok(
    next.contentEl.querySelector(".bt-md-widget img")?.src.includes(path),
  );
});

test("embedded links route to vault, web and Obsidian; Alt click keeps editing", async () => {
  const calls: any[] = [];
  app.workspace.openLinkText = async (...args: any[]) => calls.push(args);
  win.open = ((...args: any[]) => {
    calls.push(args);
    return null;
  }) as any;
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  v.contentEl.querySelector(".bt-circle").click();
  v.noteEditor.view.dispatch({
    changes: {
      from: 0,
      insert:
        "[[My note|Заметка]] [Сайт](https://example.com) obsidian://open?vault=test",
    },
  });
  const links = v.contentEl.querySelectorAll(".bt-inline-link");
  assert.equal(links.length, 3);
  links[0].dispatchEvent(
    new win.MouseEvent("click", { bubbles: true, altKey: true }),
  );
  assert.equal(calls.length, 0);
  for (const link of links)
    link.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
  assert.equal(calls[0][0], "My note");
  assert.equal(calls[1][0], "https://example.com");
  assert.equal(calls[2][0], "obsidian://open?vault=test");
});

test("attached note preview routes nested anchor clicks relative to the attached file", async () => {
  const originalLookup = app.vault.getAbstractFileByPath,
    originalRead = app.vault.cachedRead,
    originalRender = mock.MarkdownRenderer.render;
  const calls: any[] = [];
  const file = Object.assign(new mock.TFile(), { path: "Folder/Attached.md" });
  app.vault.getAbstractFileByPath = () => file;
  app.vault.cachedRead = async () => "";
  app.workspace.openLinkText = async (...args: any[]) => calls.push(args);
  mock.MarkdownRenderer.render = async (_app: any, _text: string, el: any) => {
    el.innerHTML =
      '<a class="internal-link" data-href="Sibling#Heading" href="Sibling#Heading"><strong>Перейти</strong></a><a href="https://example.com">Сайт</a>';
  };
  const external: any[] = [];
  win.open = ((...args: any[]) => {
    external.push(args);
    return null;
  }) as any;
  try {
    const v = await view();
    const d = fresh();
    d.nodes[0].note = file.path;
    v.setViewData(JSON.stringify(d), true);
    v.contentEl.querySelector(".bt-circle").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const anchor = v.contentEl.querySelector(".bt-markdown strong");
    assert.ok(anchor);
    anchor.dispatchEvent(
      new win.MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    assert.deepEqual(calls[0], [
      "Sibling#Heading",
      "Folder/Attached.md",
      false,
    ]);
    anchor.dispatchEvent(
      new win.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
      }),
    );
    assert.equal(calls[1][2], true);
    v.contentEl
      .querySelector('.bt-markdown a[href="https://example.com"]')
      .click();
    assert.equal(external[0][0], "https://example.com");
  } finally {
    app.vault.getAbstractFileByPath = originalLookup;
    app.vault.cachedRead = originalRead;
    mock.MarkdownRenderer.render = originalRender;
  }
});

test("hover shows note content, skips empty nodes, dismisses on change and reads attached notes", async () => {
  const v = await view();
  const d = fresh();
  v.setViewData(JSON.stringify(d), true);
  let circle = v.contentEl.querySelector(".bt-circle");
  assert.equal(circle.hasAttribute("aria-label"), false);
  assert.ok(circle.getAttribute("aria-labelledby"));
  v.hover.show(circle, v.doc.nodes[0], "Tree.skilltree");
  await new Promise((r) => setTimeout(r, 530));
  assert.equal(document.querySelector(".bt-note-hover"), null);
  v.doc.nodes[0].body = "Содержимое заметки";
  v.hover.show(circle, v.doc.nodes[0], "Tree.skilltree");
  await new Promise((r) => setTimeout(r, 530));
  assert.equal(
    document.querySelector(".bt-note-hover-content")?.textContent,
    "Содержимое заметки",
  );
  v.renderGraph();
  assert.equal(document.querySelector(".bt-note-hover"), null);
  const lookup = app.vault.getAbstractFileByPath,
    read = app.vault.cachedRead;
  try {
    app.vault.getAbstractFileByPath = () =>
      Object.assign(new mock.TFile(), { path: "Attached.md" });
    app.vault.cachedRead = async () => "Текст из файла";
    v.doc.nodes[0].note = "Attached.md";
    circle = v.contentEl.querySelector(".bt-circle");
    v.hover.show(circle, v.doc.nodes[0], "Tree.skilltree");
    await new Promise((r) => setTimeout(r, 530));
    assert.equal(
      document.querySelector(".bt-note-hover-content")?.textContent,
      "Текст из файла",
    );
    v.hover.leave();
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(document.querySelector(".bt-note-hover"), null);
  } finally {
    v.hover.hide();
    app.vault.getAbstractFileByPath = lookup;
    app.vault.cachedRead = read;
  }
});

test("export toolbar opens a modal with separate PNG and PDF choices without replacing Modal.doc", async () => {
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  v.contentEl.querySelector('[aria-label="Экспорт PNG / PDF"]').click();
  assert.equal(lastModal.doc, win.document);
  assert.match(lastModal.contentEl.textContent, /Экспорт дерева/);
  assert.deepEqual(
    [...lastModal.contentEl.querySelectorAll(".bt-export-formats button")].map(
      (b: any) => b.textContent,
    ),
    ["Скачать как PNG", "Скачать как PDF"],
  );
  assert.equal(
    lastModal.contentEl.querySelector("input[type=checkbox]").checked,
    true,
  );
});

test("tree settings remain independent, survive reload and layout switches without changing parents", async () => {
  storedConfig = undefined;
  const a = await view(),
    b = await view();
  a.setViewData(JSON.stringify(fresh()), true);
  b.setViewData(JSON.stringify(fresh()), true);
  a.contentEl.querySelector('[aria-label="Настройки дерева"]').click();
  const input = lastModal.contentEl.querySelector(
    '[aria-label="Размер пункта, px"]',
  );
  input.value = "128";
  input.dispatchEvent(new win.Event("change"));
  assert.equal(a.config.size, 128);
  assert.equal(b.config.size, 80);
  assert.equal(a.plugin.config.size, 80);
  a.add(a.doc.nodes[0].id);
  const parents = a.doc.nodes.map((n: any) => n.parent);
  a.contentEl.querySelector(".bt-layout-toggle").click();
  assert.equal(a.doc.layout, "radial");
  const reload = await view();
  reload.setViewData(a.getViewData(), true);
  assert.equal(reload.config.size, 128);
  assert.equal(reload.doc.layout, "radial");
  assert.deepEqual(
    reload.doc.nodes.map((n: any) => n.parent),
    parents,
  );
  a.contentEl.querySelector(".bt-layout-toggle").click();
  assert.deepEqual(
    a.doc.nodes.map((n: any) => n.parent),
    parents,
  );
});
test("new tree asks for a name shared by filename and root, copying defaults", async () => {
  const lookup = app.vault.getAbstractFileByPath,
    create = app.vault.create,
    leaf = app.workspace.getLeaf;
  let saved: any;
  app.vault.getAbstractFileByPath = () => null;
  app.vault.create = async (path: string, text: string) => {
    saved = { path, doc: JSON.parse(text) };
    return { path };
  };
  app.workspace.getLeaf = () => ({ openFile: async () => {} });
  try {
    const plugin = new module.exports.default();
    await plugin.onload();
    plugin.config.layout = "radial";
    const pending = plugin.createTree("Projects");
    lastModal.contentEl.querySelector("input").value = "Мой проект";
    lastModal.contentEl.querySelector("button").click();
    await pending;
    assert.equal(saved.path, "Projects/Мой проект.skilltree");
    assert.equal(saved.doc.nodes[0].title, "Мой проект");
    assert.equal(saved.doc.layout, "radial");
    assert.deepEqual(saved.doc.settings, plugin.config);
  } finally {
    app.vault.getAbstractFileByPath = lookup;
    app.vault.create = create;
    app.workspace.getLeaf = leaf;
  }
});
test("tree links navigate on click and Alt-click retains access to node settings", async () => {
  const v = await view(),
    d = fresh();
  d.nodes[0].tree = "Another.skilltree";
  d.nodes[0].body = "Внутри";
  v.setViewData(JSON.stringify(d), true);
  const calls: any[] = [];
  app.workspace.openLinkText = async (...args: any[]) => calls.push(args);
  v.contentEl.querySelector(".bt-circle").click();
  assert.equal(calls[0][0], "Another.skilltree");
  assert.ok(v.contentEl.querySelector(".bt-linked"));
  v.contentEl
    .querySelector(".bt-circle")
    .dispatchEvent(
      new win.MouseEvent("click", { bubbles: true, altKey: true }),
    );
  assert.ok(
    v.contentEl.querySelector('[aria-label="Убрать ссылку на дерево"]'),
  );
  v.contentEl.querySelector('[aria-label="Убрать ссылку на дерево"]').click();
  assert.equal(v.doc.nodes[0].tree, undefined);
  assert.ok(v.contentEl.querySelector(".bt-has-body"));
});

test("graph undo and redo handle Russian keyboard layout and focus outside removed buttons", async () => {
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  v.add(v.doc.nodes[0].id);
  const input = v.contentEl.querySelector(".bt-rename");
  input.dispatchEvent(
    new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  assert.equal(document.activeElement?.classList.contains("bt-title"), true);
  const key = (target: any, code: string, shiftKey = false) =>
    target.dispatchEvent(
      new win.KeyboardEvent("keydown", {
        key: code === "KeyZ" ? "я" : "н",
        code,
        ctrlKey: true,
        shiftKey,
        bubbles: true,
        cancelable: true,
      }),
    );
  key(document.body, "KeyZ");
  assert.equal(v.doc.nodes.length, 1);
  key(document.body, "KeyZ", true);
  assert.equal(v.doc.nodes.length, 2);
  key(document.body, "KeyZ");
  key(document.body, "KeyY");
  assert.equal(v.doc.nodes.length, 2);
  v.contentEl.querySelector(".bt-circle").click();
  const text = v.noteEditor.view.contentDOM;
  const before = JSON.stringify(v.doc);
  key(text, "KeyZ");
  assert.equal(
    JSON.stringify(v.doc),
    before,
    "editor shortcut must not undo graph structure",
  );
  app.workspace.getActiveViewOfType = () => null;
  key(document.body, "KeyZ");
  assert.equal(v.doc.nodes.length, 2, "inactive tree must not handle undo");
});
test("undo immediately after adding a node works in unchanged rename input", async () => {
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  v.add(v.doc.nodes[0].id);
  v.contentEl.querySelector(".bt-rename").dispatchEvent(
    new win.KeyboardEvent("keydown", {
      key: "я",
      code: "KeyZ",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(v.doc.nodes.length, 1);
});

test("comments, completion and one-click layout persist and support undo", async () => {
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  const root = v.doc.nodes[0].id;
  v.contentEl
    .querySelector(".bt-add")
    .dispatchEvent(
      new win.MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
  const comment = v.doc.nodes[1];
  assert.equal(comment.comment, true);
  assert.ok(
    v.contentEl
      .querySelector(`[data-id="${comment.id}"]`)
      .classList.contains("bt-comment"),
  );
  v.add(comment.id);
  const child = v.doc.nodes[2];
  assert.ok(
    v.contentEl
      .querySelector(`[data-id="${child.id}"]`)
      .classList.contains("bt-comment"),
  );
  v.contentEl.querySelector(`[data-id="${root}"] .bt-complete`).click();
  assert.equal(v.doc.nodes[0].completed, true);
  v.undo();
  assert.ok(!v.doc.nodes[0].completed);
  v.redo();
  assert.equal(v.doc.nodes[0].completed, true);
  v.contentEl.querySelector(".bt-comments-toggle").click();
  assert.equal(v.doc.hideComments, true);
  assert.ok(!v.positions.has(comment.id));
  assert.equal(v.doc.nodes.length, 3);
  const v2 = await view();
  v2.setViewData(v.getViewData(), true);
  assert.equal(v2.doc.nodes[0].completed, true);
  assert.equal(v2.positions.size, 1);
  v2.contentEl.querySelector(".bt-comments-toggle").click();
  assert.equal(v2.positions.size, 3);
  const mode = v2.doc.layout;
  v2.contentEl.querySelector(".bt-layout-toggle").click();
  assert.notEqual(v2.doc.layout, mode);
  v2.contentEl.querySelector(".bt-layout-toggle").click();
  assert.equal(v2.doc.layout, mode);
});

test("selected nodes switch comment state including inherited comments, with undo and reload", async () => {
  const v = await view();
  const d = fresh();
  const parent = addNode(d, d.nodes[0].id);
  parent.comment = true;
  const child = addNode(d, parent.id);
  child.body = "note";
  v.setViewData(JSON.stringify(d), true);
  v.contentEl.querySelector(`[data-id="${child.id}"] .bt-circle`).click();
  const toggle = () => v.contentEl.querySelector(".bt-comment-toggle");
  assert.equal(toggle().getAttribute("aria-pressed"), "true");
  toggle().click();
  assert.equal(v.doc.nodes.find((n: any) => n.id === child.id).comment, false);
  assert.ok(
    !v.contentEl
      .querySelector(`[data-id="${child.id}"]`)
      .classList.contains("bt-comment"),
  );
  v.undo();
  assert.ok(
    v.contentEl
      .querySelector(`[data-id="${child.id}"]`)
      .classList.contains("bt-comment"),
  );
  v.redo();
  const reloaded = await view();
  reloaded.setViewData(v.getViewData(), true);
  assert.equal(
    reloaded.doc.nodes.find((n: any) => n.id === child.id).comment,
    false,
  );
  toggle().click();
  assert.equal(v.doc.nodes.find((n: any) => n.id === child.id).comment, true);
  assert.ok(
    v.contentEl.querySelector(
      '.bt-panel-tools > [aria-label="Связать с другим деревом"]',
    ),
  );
});

test("search remains open, opens collapsed results, and supports importance and task filters", async () => {
  const v = await view(),
    d = fresh(),
    a = addNode(d, d.nodes[0].id),
    b = addNode(d, a.id);
  a.collapsed = true;
  b.title = "Найти меня";
  b.task = true;
  b.important = true;
  v.setViewData(JSON.stringify(d), true);
  v.contentEl.querySelector('[aria-label="Поиск и списки узлов"]').click();
  const input = v.contentEl.querySelector('[aria-label="Поиск по узлам"]');
  input.value = "Найти";
  input.dispatchEvent(new win.Event("input"));
  v.contentEl.querySelector(".bt-search-results button").click();
  assert.equal(v.selected, b.id);
  assert.equal(v.navigatorEl.hidden, false);
  assert.equal(v.doc.nodes.find((n: any) => n.id === a.id).collapsed, false);
  assert.ok(v.contentEl.querySelector(`[data-id="${b.id}"].is-selected`));
  v.contentEl.querySelector('[aria-label="Невыполненные задачи"]').click();
  assert.equal(
    v.contentEl.querySelectorAll(".bt-search-results button").length,
    1,
  );
  v.contentEl.querySelector(`[data-id="${b.id}"] .bt-complete`).click();
  assert.equal(
    v.contentEl.querySelectorAll(".bt-search-results button").length,
    0,
  );
  assert.ok(
    v.contentEl.querySelector(`[data-id="${b.id}"].bt-task .bt-important`),
  );
});

test("focus displays only the subtree without changing parents, and expand-all restores hidden branches", async () => {
  const v = await view(),
    d = fresh(),
    a = addNode(d, d.nodes[0].id),
    b = addNode(d, a.id);
  addNode(d, d.nodes[0].id);
  a.collapsed = true;
  v.setViewData(JSON.stringify(d), true);
  v.contentEl.querySelector('[aria-label="Раскрыть всё дерево"]').click();
  assert.equal(v.positions.size, 4);
  v.contentEl.querySelector('[aria-label="Вернуть свёрнутые ветки"]').click();
  assert.equal(v.positions.size, 3);
  v.contentEl.querySelector(`[data-id="${a.id}"] .bt-circle`).click();
  const before = JSON.stringify(v.doc.nodes);
  v.contentEl
    .querySelector('[aria-label="Сосредоточиться на этом узле"]')
    .click();
  assert.deepEqual([...v.positions.keys()], [a.id]);
  assert.equal(JSON.stringify(v.doc.nodes), before);
  v.contentEl
    .querySelector('[aria-label="Выйти из режима сосредоточения"]')
    .click();
  assert.equal(v.positions.size, 3);
  assert.ok(v.contentEl.querySelector(".bt-minimap svg circle"));
  for (let i = 0; i < 25; i++) v.zoom(0.8);
  assert.ok(v.doc.camera.zoom < 0.15);
});

test("embedded tools keep selection, insert links and tables, and use theme-compatible strong markup", async () => {
  const v = await view(),
    d = fresh();
  d.nodes[0].body = "**Жирный текст**";
  v.setViewData(JSON.stringify(d), true);
  v.contentEl.querySelector(".bt-circle").click();
  assert.ok(v.contentEl.querySelector("strong.cm-strong"));
  const ed = v.noteEditor.view;
  ed.dispatch({ selection: { anchor: ed.state.doc.length } });
  const tools = v.contentEl.querySelector(".bt-editor-tools");
  tools.querySelector('[aria-label="Текст ссылки"]').value = "Ссылка";
  tools.querySelector('[aria-label="Адрес ссылки"]').value = "Другая заметка";
  [...tools.querySelectorAll("button")]
    .find((b: any) => b.textContent === "Вставить ссылку")
    .click();
  assert.ok(v.doc.nodes[0].body.includes("[[Другая заметка|Ссылка]]"));
  [...tools.querySelectorAll("button")]
    .find((b: any) => b.textContent === "Вставить / заменить таблицу")
    .click();
  assert.ok(v.doc.nodes[0].body.includes("| --- | --- |"));
  assert.ok(v.doc.nodes[0].updatedAt);
  assert.equal(v.contentEl.querySelector(".bt-editor-tools"), tools);
});

test("PDF attachments render a file card without reading binary as markdown", async () => {
  const lookup = app.vault.getAbstractFileByPath,
    read = app.vault.cachedRead;
  try {
    const file = Object.assign(new mock.TFile(), {
      path: "report.pdf",
      name: "report.pdf",
      extension: "pdf",
      stat: { size: 3072 },
    });
    app.vault.getAbstractFileByPath = () => file;
    app.vault.cachedRead = () => {
      throw Error("binary should not be rendered as markdown");
    };
    const calls: any[] = [];
    app.workspace.openLinkText = async (...args: any[]) => calls.push(args);
    const v = await view(),
      d = fresh();
    d.nodes[0].note = file.path;
    v.setViewData(JSON.stringify(d), true);
    v.contentEl.querySelector(".bt-circle").click();
    const card = v.contentEl.querySelector(".bt-file-card");
    assert.match(card.textContent, /report.pdf.*3 КБ/);
    card.click();
    assert.equal(calls[0][0], "report.pdf");
  } finally {
    app.vault.getAbstractFileByPath = lookup;
    app.vault.cachedRead = read;
  }
});

test("emoji replaces Lucide and middle-click retains subtree deletion confirmation", async () => {
  const v = await view(),
    d = fresh(),
    a = addNode(d, d.nodes[0].id);
  a.emoji = "🦊";
  addNode(d, a.id);
  v.setViewData(JSON.stringify(d), true);
  const c = v.contentEl.querySelector(`[data-id="${a.id}"] .bt-circle`);
  assert.equal(c.querySelector(".bt-emoji").textContent, "🦊");
  c.dispatchEvent(
    new win.MouseEvent("auxclick", {
      button: 1,
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(v.doc.nodes.length, 3);
  assert.match(lastModal.contentEl.textContent, /Удал/);
  const confirm = [...lastModal.contentEl.querySelectorAll("button")].find(
    (b: any) => b.textContent.includes("Удалить"),
  ) as any;
  confirm.click();
  assert.equal(v.doc.nodes.length, 1);
  v.undo();
  assert.equal(v.doc.nodes.length, 3);
});

test("camera movement keeps minimap geometry intact", async () => {
  const v = await view();
  const d = fresh();
  for (let i = 0; i < 100; i++) addNode(d, d.nodes[0].id);
  v.setViewData(JSON.stringify(d), true);
  const svg = v.minimap.querySelector("svg"),
    node = svg.querySelector("circle");
  for (let i = 0; i < 50; i++) {
    v.doc.camera.x += 2;
    v.transform();
  }
  assert.equal(v.minimap.querySelector("svg"), svg);
  assert.equal(svg.querySelector("circle"), node);
});

test("global minimap switch remains visible and persists through other settings redraws", async () => {
  storedConfig = undefined;
  const v = await view();
  settingsTab.display();
  const toggle = settingsTab.containerEl.querySelector("input[type=checkbox]");
  assert.ok(toggle);
  toggle.checked = false;
  toggle.dispatchEvent(new win.Event("change"));
  await Promise.resolve();
  assert.equal(v.plugin.config.showMinimap, false);
  v.setViewData(JSON.stringify(fresh()), true);
  assert.equal(v.minimap.hidden, true);
  settingsTab.display();
  assert.equal(
    settingsTab.containerEl.querySelector("input[type=checkbox]").checked,
    false,
  );
  storedConfig = undefined;
});
test("emoji catalog supports bilingual search and right-click favorites persist", async () => {
  storedConfig = undefined;
  const v = await view(),
    d = fresh();
  d.nodes[0].emoji = "🫎";
  v.setViewData(JSON.stringify(d), true);
  v.contentEl.querySelector(".bt-circle").click();
  v.contentEl.querySelector('[aria-label="Иконка узла"]').click();
  const picker = lastModal;
  const search = picker.contentEl.querySelector("input[role=searchbox]");
  search.value = "moose";
  search.dispatchEvent(new win.Event("input"));
  const moose = [
    ...picker.contentEl.querySelectorAll(".bt-emoji-grid button"),
  ].find((b: any) => b.textContent === "🫎") as any;
  assert.ok(moose);
  moose.dispatchEvent(
    new win.MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
  );
  assert.ok(v.plugin.config.emojiFavorites.includes("🫎"));
  assert.match(picker.contentEl.textContent, /Избранное/);
  const reload = await view();
  assert.ok(reload.plugin.config.emojiFavorites.includes("🫎"));
  storedConfig = undefined;
});

test("search divider sits outside scrollable results and multiple filters intersect", async () => {
  const v = await view(),
    d = fresh(),
    a = addNode(d, d.nodes[0].id),
    b = addNode(d, d.nodes[0].id);
  a.important = true;
  a.task = true;
  b.important = true;
  v.setViewData(JSON.stringify(d), true);
  v.contentEl.querySelector('[aria-label="Поиск и списки узлов"]').click();
  const resize = v.contentEl.querySelector(".bt-search-resize");
  assert.equal(resize.parentElement, v.navigatorEl.parentElement);
  assert.equal(resize.previousElementSibling, v.navigatorEl);
  v.contentEl.querySelector('.bt-search-filters [aria-label="Важные"]').click();
  assert.equal(v.contentEl.querySelectorAll(".bt-search-result").length, 2);
  v.contentEl.querySelector('.bt-search-filters [aria-label="Задачи"]').click();
  assert.equal(v.contentEl.querySelectorAll(".bt-search-result").length, 1);
  v.contentEl.querySelector('.bt-search-filters [aria-label="Важные"]').click();
  assert.equal(v.searchFilters.has("task"), true);
});
test("emoji picker bounds initial DOM and exposes tone variants on hover", async () => {
  const v = await view(),
    d = fresh();
  d.nodes[0].emoji = "😀";
  v.setViewData(JSON.stringify(d), true);
  v.contentEl.querySelector(".bt-circle").click();
  v.contentEl.querySelector('[aria-label="Иконка узла"]').click();
  const picker = lastModal;
  assert.ok(
    picker.contentEl.querySelectorAll(".bt-emoji-choice").length <= 180,
  );
  const input = picker.contentEl.querySelector("input[role=searchbox]");
  input.value = "thumbs up";
  input.dispatchEvent(new win.Event("input"));
  const wrap = picker.contentEl.querySelector(".bt-emoji-choice");
  assert.ok(wrap);
  wrap.onpointerenter();
  assert.ok(wrap.querySelectorAll(".bt-tones button").length >= 5);
});
test("node controls have accessible names without hover labels and insertion stays in note", async () => {
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  const action = v.contentEl.querySelector(".bt-add");
  assert.equal(action.hasAttribute("aria-label"), false);
  assert.ok(action.getAttribute("aria-labelledby"));
  v.contentEl.querySelector(".bt-circle").click();
  const tools = v.contentEl.querySelector(".bt-editor-tools");
  assert.equal(tools.hidden, true);
  v.contentEl.querySelector('[aria-label="Расширенная вставка"]').click();
  assert.equal(tools.hidden, false);
  assert.equal(
    tools.parentElement,
    v.contentEl.querySelector(".bt-note-surface"),
  );
});

test("emoji viewport scrolls through full catalog without paging or keyword tooltips", async () => {
  const v = await view(),
    d = fresh();
  d.nodes[0].emoji = "😀";
  v.setViewData(JSON.stringify(d), true);
  v.contentEl.querySelector(".bt-circle").click();
  v.contentEl.querySelector('[aria-label="Иконка узла"]').click();
  const modal = lastModal;
  document.body.appendChild(modal.contentEl);
  const list = modal.contentEl.querySelector(".bt-icon-categories");
  assert.equal(list.querySelector(".bt-emoji-pager"), null);
  const initial = list.querySelector(".bt-emoji-choice button").textContent;
  list.scrollTop = 4400;
  list.dispatchEvent(new win.Event("scroll"));
  await new Promise((r) => setTimeout(r, 40));
  assert.ok(list.querySelectorAll(".bt-emoji-choice").length <= 180);
  assert.notEqual(
    list.querySelector(".bt-emoji-choice button").textContent,
    initial,
  );
  const b = list.querySelector(".bt-emoji-choice button");
  assert.equal(b.getAttribute("aria-label"), b.textContent);
  modal.contentEl.remove();
});

test("Ctrl+F reaches active tree before document shortcut capture, including Russian layout", async () => {
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  document.body.appendChild(v.contentEl);
  let intercepted = false;
  const blocker = (e: Event) => {
    intercepted = true;
    e.stopImmediatePropagation();
  };
  document.addEventListener("keydown", blocker, true);
  const event = new win.KeyboardEvent("keydown", {
    key: "а",
    code: "KeyF",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  v.contentEl.dispatchEvent(event);
  assert.equal(intercepted, false);
  assert.equal(event.defaultPrevented, true);
  assert.equal(v.navigatorEl.hidden, false);
  assert.equal(document.activeElement, v.navigatorEl.querySelector("input"));
  document.removeEventListener("keydown", blocker, true);
  v.contentEl.remove();
});

test("emoji category shortcuts jump directly while keeping bounded DOM", async () => {
  const v = await view(),
    d = fresh();
  d.nodes[0].emoji = "😀";
  v.setViewData(JSON.stringify(d), true);
  v.contentEl.querySelector(".bt-circle").click();
  v.contentEl.querySelector('[aria-label="Иконка узла"]').click();
  const content = lastModal.contentEl;
  const button = content.querySelector(
    '.bt-emoji-navigation [aria-label="животные и природа"]',
  );
  assert.ok(button);
  button.click();
  const list = content.querySelector(".bt-icon-categories");
  assert.ok(list.scrollTop > 0);
  assert.match(list.textContent, /животные и природа/);
  assert.ok(list.querySelectorAll(".bt-emoji-choice").length <= 180);
});

test("Lucide favorites toggle with right click and survive plugin reload", async () => {
  storedConfig = undefined;
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  v.contentEl.querySelector(".bt-circle").click();
  v.contentEl.querySelector('[aria-label="Иконка узла"]').click();
  const picker = lastModal.contentEl;
  picker
    .querySelector('button[aria-label="circle-help"]')
    .dispatchEvent(
      new win.MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(
    picker.querySelector(".bt-icon-categories h4").textContent,
    "★ Избранное",
  );
  const reloaded = await view();
  assert.ok(reloaded.plugin.config.lucideFavorites.includes("circle-help"));
  storedConfig = undefined;
});

test("old trees see shared palettes while keeping own selection", async () => {
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  v.doc.settings = structuredClone(v.plugin.config);
  const old = v.config.palette;
  await v.plugin.updateConfig({
    ...v.plugin.config,
    palettes: { ...v.plugin.config.palettes, Added: ["#123456"] },
    palette: "Added",
  });
  assert.deepEqual(v.config.palettes.Added, ["#123456"]);
  assert.equal(v.config.palette, old);
});
test("panel title commits and undo restores title", async () => {
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  v.contentEl.querySelector(".bt-circle").click();
  const old = v.doc.nodes[0].title;
  const input = v.contentEl.querySelector(".bt-panel-title");
  input.value = "Новое имя";
  input.onblur();
  assert.equal(v.doc.nodes[0].title, "Новое имя");
  v.undo();
  assert.equal(v.doc.nodes[0].title, old);
});

test("custom palette removal persists and old tree copies cannot resurrect it", async () => {
  storedConfig = { palette: "Bad", palettes: { Bad: ["#123456"] } };
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  v.doc.settings = structuredClone(v.plugin.config);
  settingsTab.display();
  const card = settingsTab.containerEl.querySelector('[aria-label="Bad"]');
  card.dispatchEvent(
    new win.MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
  );
  lastMenu.items.find((i: any) => i.title === "Удалить").run();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(v.config.palettes.Bad, undefined);
  assert.notEqual(v.config.palette, "Bad");
  const reloaded = await view();
  assert.equal(reloaded.plugin.config.palettes.Bad, undefined);
  storedConfig = undefined;
});
test("panel title is a wrapping textarea with no tooltip label", async () => {
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  v.contentEl.querySelector(".bt-circle").click();
  const title = v.contentEl.querySelector("textarea.bt-panel-title");
  assert.ok(title);
  assert.equal(title.hasAttribute("aria-label"), false);
  assert.ok(title.getAttribute("aria-labelledby"));
});

test("built-in presets support edit, duplicate, delete and stay deleted after reload", async () => {
  storedConfig = undefined;
  const v = await view();
  settingsTab.display();
  const root = settingsTab.containerEl;
  root
    .querySelector('[aria-label="Loop Hero"]')
    .dispatchEvent(new win.MouseEvent("contextmenu", { cancelable: true }));
  assert.deepEqual(
    lastMenu.items.map((i: any) => i.title),
    ["Редактировать", "Дублировать", "Удалить"],
  );
  lastMenu.items.find((i: any) => i.title === "Дублировать").run();
  const edit = root.querySelector(".bt-preset-editor");
  assert.equal(edit.open, true);
  assert.equal(edit.querySelector("input").value, "Loop Hero — копия");
  [...edit.querySelectorAll("button")]
    .find((b: any) => b.textContent === "Сохранить и включить")
    .click();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(
    v.plugin.config.palettes["Loop Hero — копия"],
    v.plugin.config.palettes["Loop Hero"],
  );
  root
    .querySelector('[aria-label="Loop Hero"]')
    .dispatchEvent(new win.MouseEvent("contextmenu", { cancelable: true }));
  lastMenu.items.find((i: any) => i.title === "Удалить").run();
  root
    .querySelector('[aria-label="Вопрос"]')
    .dispatchEvent(new win.MouseEvent("contextmenu", { cancelable: true }));
  lastMenu.items.find((i: any) => i.title === "Удалить").run();
  await new Promise((r) => setTimeout(r, 0));
  const reload = await view();
  assert.equal(reload.plugin.config.palettes["Loop Hero"], undefined);
  assert.equal(reload.plugin.config.iconSets["Вопрос"], undefined);
  storedConfig = undefined;
});
test("mixed preset produces real emoji and image nodes and survives reload", async () => {
  storedConfig = {
    icons: "Mixed",
    iconSets: { Mixed: ["emoji:🫎", "image:pictures/test.png"] },
  };
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  const random = Math.random;
  try {
    Math.random = () => 0;
    v.add(v.doc.nodes[0].id);
    Math.random = () => 0.99;
    v.add(v.doc.nodes[0].id);
  } finally {
    Math.random = random;
  }
  assert.equal(v.doc.nodes[1].emoji, "🫎");
  assert.equal(v.doc.nodes[1].icon, "circle-help");
  assert.equal(v.doc.nodes[2].image, "pictures/test.png");
  const again = await view();
  again.setViewData(v.getViewData(), true);
  assert.equal(again.doc.nodes[1].emoji, "🫎");
  assert.equal(again.doc.nodes[2].image, "pictures/test.png");
  storedConfig = undefined;
});

test("mixed preset picker retains selection across Lucide, emoji and image tabs", async () => {
  storedConfig = undefined;
  await view();
  settingsTab.display();
  const editor =
    settingsTab.containerEl.querySelectorAll(".bt-preset-editor")[1];
  editor.querySelector("input").value = "Mixed UI";
  [...editor.querySelectorAll("button")]
    .find((b: any) => b.textContent === "Добавить иконку…")
    .click();
  const lucide = lastModal.contentEl,
    outer = lucide.parentElement.parentElement;
  lucide.querySelector('[aria-label="chess-knight"]').click();
  [...outer.querySelectorAll(".bt-icon-tabs button")]
    .find((b: any) => b.textContent === "Эмоджи")
    .click();
  const search = outer.querySelector("input[role=searchbox]");
  search.value = "moose";
  search.dispatchEvent(new win.Event("input"));
  [...outer.querySelectorAll(".bt-emoji-grid button")]
    .find((b: any) => b.textContent === "🫎")
    .click();
  const oldFiles = app.vault.getFiles,
    oldAbstract = app.vault.getAbstractFileByPath,
    oldResource = app.vault.getResourcePath;
  const file = { path: "icons/test.png", extension: "png" };
  app.vault.getFiles = () => [file];
  app.vault.getAbstractFileByPath = () => file;
  app.vault.getResourcePath = () => "https://localhost/test.png";
  try {
    [...outer.querySelectorAll(".bt-icon-tabs button")]
      .find((b: any) => b.textContent === "Изображения")
      .click();
    outer.querySelector('[aria-label="icons/test.png"]').click();
    [...outer.querySelectorAll(".bt-icon-tabs button")]
      .find((b: any) => b.textContent === "Lucide")
      .click();
    assert.equal(
      outer
        .querySelector('[aria-label="chess-knight"]')
        .getAttribute("aria-pressed"),
      "true",
    );
    [...outer.querySelectorAll("button")]
      .find((b: any) => b.textContent === "Подтвердить выбор")
      .click();
    [...editor.querySelectorAll("button")]
      .find((b: any) => b.textContent === "Сохранить и включить")
      .click();
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(storedConfig.iconSets["Mixed UI"], [
      "chess-knight",
      "emoji:🫎",
      "image:icons/test.png",
    ]);
  } finally {
    app.vault.getFiles = oldFiles;
    app.vault.getAbstractFileByPath = oldAbstract;
    app.vault.getResourcePath = oldResource;
    storedConfig = undefined;
  }
});

test("graph clipboard copies descendants and pastes under active node with new ids", async () => {
  const v = await view(),
    d = fresh(),
    a = addNode(d, d.nodes[0].id),
    child = addNode(d, a.id),
    target = addNode(d, d.nodes[0].id);
  a.title = "Копия";
  child.body = "Внутри";
  child.emoji = "🫎";
  v.setViewData(JSON.stringify(d), true);
  document.body.appendChild(v.contentEl);
  v.selected = a.id;
  let text = "";
  const event = (type: string) => {
    const e = new win.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(e, "clipboardData", {
      value: {
        files: [],
        setData: (_: string, value: string) => (text = value),
        getData: () => text,
      },
    });
    v.contentEl.dispatchEvent(e);
    return e;
  };
  assert.equal(event("copy").defaultPrevented, true);
  v.selected = target.id;
  assert.equal(event("paste").defaultPrevented, true);
  assert.equal(v.doc.nodes.length, 6);
  const added = v.doc.nodes.slice(4);
  assert.equal(added[0].parent, target.id);
  assert.equal(added[1].parent, added[0].id);
  assert.equal(added[1].body, "Внутри");
  assert.equal(added[1].emoji, "🫎");
  assert.notEqual(added[0].id, a.id);
  v.undo();
  assert.equal(v.doc.nodes.length, 4);
  v.contentEl.remove();
});
test("delete confirmation suppression lasts for plugin session only", async () => {
  const v = await view(),
    d = fresh(),
    a = addNode(d, d.nodes[0].id),
    b = addNode(d, d.nodes[0].id);
  v.setViewData(JSON.stringify(d), true);
  v.remove(a.id);
  const modal = lastModal;
  modal.contentEl.querySelector("input[type=checkbox]").checked = true;
  [...modal.contentEl.querySelectorAll("button")]
    .find((b: any) => b.textContent === "Удалить")
    .click();
  assert.equal(v.plugin.skipDeleteConfirmation, true);
  v.remove(b.id);
  assert.equal(lastModal, modal);
  assert.equal(v.doc.nodes.length, 1);
  v.undo();
  assert.equal(v.doc.nodes.length, 2);
  const reload = await view();
  assert.equal(reload.plugin.skipDeleteConfirmation, false);
});
test("panel buttons reorder through context menu and persist", async () => {
  storedConfig = undefined;
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  v.contentEl.querySelector(".bt-circle").click();
  const tools = v.contentEl.querySelector(".bt-panel-tools");
  const buttons = tools.querySelectorAll("button");
  const first = buttons[0].dataset.command,
    second = buttons[1].dataset.command;
  buttons[1].dispatchEvent(
    new win.MouseEvent("contextmenu", { cancelable: true }),
  );
  lastMenu.items.find((i: any) => i.title === "Передвинуть влево").run();
  assert.equal(tools.querySelector("button").dataset.command, second);
  const reload = await view();
  assert.deepEqual(reload.plugin.config.buttonOrders.panel.slice(0, 2), [
    second,
    first,
  ]);
  storedConfig = undefined;
});

test("clipboard image creates child in hidden asset folder without changing parent", async () => {
  const v = await view(),
    d = fresh();
  v.setViewData(JSON.stringify(d), true);
  v.selected = d.nodes[0].id;
  document.body.appendChild(v.contentEl);
  const adapter = app.vault.adapter;
  let saved = "";
  app.vault.adapter = {
    exists: async () => true,
    writeBinary: async (path: string) => {
      saved = path;
    },
    getResourcePath: (path: string) => path,
  };
  try {
    const e = new win.Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(e, "clipboardData", {
      value: {
        files: [new Blob(["image"], { type: "image/png" })],
        getData: () => "",
      },
    });
    v.contentEl.dispatchEvent(e);
    assert.equal(e.defaultPrevented, true);
    await new Promise((r) => setTimeout(r, 10));
    assert.match(saved, /^\.skilltree_files\/.+\.png$/);
    assert.equal(v.doc.nodes[1].image, saved);
    assert.equal(v.doc.nodes[1].parent, d.nodes[0].id);
    assert.equal(v.doc.nodes[0].image, undefined);
    assert.ok(v.contentEl.querySelector(".bt-image-node img"));
  } finally {
    app.vault.adapter = adapter;
    v.contentEl.remove();
  }
});
test("toolbar restores left and right groups around the flexible counter", async () => {
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  const children = [...v.contentEl.querySelector(".bt-toolbar").children];
  const counter = children.findIndex((e: any) =>
    e.classList.contains("bt-count"),
  );
  assert.ok(counter > 1);
  assert.ok(
    children.every(
      (e: any, i: number) =>
        e.tagName !== "BUTTON" ||
        (e.dataset.side === "left" ? i < counter : i > counter),
    ),
  );
});
test("hidden images can be reattached, retain aspect ratio and open with Space", async () => {
  const v = await view(),
    d = fresh();
  v.setViewData(JSON.stringify(d), true);
  document.body.appendChild(v.contentEl);
  const previous = app.vault.adapter;
  const path = ".skilltree_files/saved.png";
  app.vault.adapter = {
    list: async () => ({ files: [path], folders: [] }),
    getResourcePath: (p: string) => p,
  };
  try {
    v.contentEl.querySelector(".bt-circle").click();
    v.contentEl.querySelector('[aria-label="Прикрепить изображение"]').click();
    await new Promise((r) => setTimeout(r, 0));
    const choice = lastModal.contentEl.querySelector(
      '[aria-label="' + path + '"]',
    );
    assert.ok(choice);
    choice.click();
    assert.equal(v.doc.nodes[0].image, path);
    const image = v.contentEl.querySelector(".bt-image-node img");
    Object.defineProperties(image, {
      naturalWidth: { value: 400 },
      naturalHeight: { value: 200 },
    });
    image.dispatchEvent(new win.Event("load"));
    const node = v.contentEl.querySelector(".bt-image-node");
    assert.equal(
      parseFloat(node.style.getPropertyValue("--image-width")),
      2 * parseFloat(node.style.getPropertyValue("--image-height")),
    );
    node.classList.add("is-hovered");
    const e = new win.KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      bubbles: true,
      cancelable: true,
    });
    v.contentEl.dispatchEvent(e);
    assert.equal(e.defaultPrevented, true);
    assert.equal(
      lastModal.contentEl.querySelector("img").getAttribute("src"),
      path,
    );
    assert.ok(v.contentEl.querySelector(".bt-image-expand"));
  } finally {
    app.vault.adapter = previous;
    v.contentEl.remove();
  }
});
test("controls switch sides, survive reload and image attachment shares the row", async () => {
  storedConfig = undefined;
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  v.contentEl.querySelector(".bt-circle").click();
  const tools = v.contentEl.querySelector(".bt-panel-tools"),
    button = tools.querySelector('[aria-label="Прикрепить изображение"]');
  assert.ok(button);
  assert.equal(
    tools.querySelector('[aria-label="Связать с другим деревом"]').dataset.side,
    "right",
  );
  button.dispatchEvent(new win.MouseEvent("contextmenu", { cancelable: true }));
  lastMenu.items.find((i: any) => i.title === "Закрепить справа").run();
  assert.equal(button.dataset.side, "right");
  const reload = await view();
  reload.setViewData(JSON.stringify(fresh()), true);
  reload.contentEl.querySelector(".bt-circle").click();
  assert.equal(
    reload.contentEl.querySelector('[aria-label="Прикрепить изображение"]')
      .dataset.side,
    "right",
  );
  storedConfig = undefined;
});
test("drag across spacer moves a control to the opposite side and clears feedback", async () => {
  const v = await view();
  v.setViewData(JSON.stringify(fresh()), true);
  const bar = v.contentEl.querySelector(".bt-toolbar"),
    button = bar.querySelector("button"),
    spacer = bar.querySelector(".bt-control-spacer");
  spacer.getBoundingClientRect = () => ({
    left: 100,
    right: 300,
    top: 0,
    width: 200,
    height: 30,
  });
  const dataTransfer = {
    setData() {},
    setDragImage() {},
    effectAllowed: "",
    dropEffect: "",
  };
  const event = (type: string, target: any, x: number) => {
    const e = new win.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
    });
    Object.defineProperty(e, "dataTransfer", { value: dataTransfer });
    target.dispatchEvent(e);
  };
  const original = [...bar.querySelectorAll("button")];
  event("dragstart", button, 10);
  assert.equal(bar.querySelector(".bt-insertion-marker"), null);
  assert.equal(button.classList.contains("bt-button-dragging"), false);
  event("dragover", bar, 10);
  assert.ok(bar.querySelector(".bt-insertion-marker"));
  assert.equal(bar.querySelector(".bt-insertion-marker").style.width, "30px");
  event("dragover", bar, 290);
  event("dragend", button, 290);
  assert.deepEqual([...bar.querySelectorAll("button")], original);
  assert.equal(bar.querySelector(".bt-insertion-marker"), null);
  event("dragstart", button, 10);
  event("dragover", bar, 290);
  assert.ok(bar.querySelector(".bt-insertion-marker"));
  event("drop", bar, 290);
  assert.equal(button.dataset.side, "right");
  assert.equal(bar.querySelector(".bt-insertion-marker"), null);
  assert.equal(bar.classList.contains("bt-controls-dragging"), false);
  storedConfig = undefined;
});
test("question badges and combined search follow titles without replacing icons", async () => {
  const v = await view(),
    d = fresh(),
    a = addNode(d, d.nodes[0].id),
    b = addNode(d, d.nodes[0].id),
    c = addNode(d, d.nodes[0].id);
  a.title = "Что?";
  a.icon = "timer";
  a.task = true;
  b.title = "Как? Почему?";
  c.title = "Утверждение";
  c.body = "Вопрос только в тексте?";
  v.setViewData(JSON.stringify(d), true);
  assert.equal(v.contentEl.querySelectorAll(".bt-question").length, 2);
  assert.equal(v.doc.nodes.find((n: any) => n.id === a.id).icon, "timer");
  v.contentEl.querySelector('[aria-label="Поиск и списки узлов"]').click();
  const filter = v.contentEl.querySelector(
    '.bt-search-filters [aria-label="Вопросы"]',
  );
  filter.click();
  assert.equal(filter.getAttribute("aria-pressed"), "true");
  assert.equal(v.contentEl.querySelectorAll(".bt-search-result").length, 2);
  assert.equal(
    v.contentEl.querySelectorAll('.bt-result-badges [aria-label="Вопрос"]')
      .length,
    2,
  );
  v.contentEl.querySelector('.bt-search-filters [aria-label="Задачи"]').click();
  assert.equal(v.contentEl.querySelectorAll(".bt-search-result").length, 1);
  v.change(() => {
    v.doc.nodes.find((n: any) => n.id === a.id).title = "Ответ";
  });
  v.refreshNavigatorResults();
  assert.equal(v.contentEl.querySelectorAll(".bt-question").length, 1);
  assert.equal(v.contentEl.querySelectorAll(".bt-search-result").length, 0);
  v.change(() => {
    v.doc.nodes.find((n: any) => n.id === c.id).title = "Новый вопрос?";
  });
  assert.equal(v.contentEl.querySelectorAll(".bt-question").length, 2);
});
