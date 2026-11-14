import {
  copyBranches,
  pasteBranches,
  CLIPBOARD_PREFIX,
} from "./node-clipboard";
import { applyPresetIcon } from "./preset-icons";
import { searchField } from "./search-field";
import { NodeIconModal } from "./node-icons";
import { treeGeometry, displayTitle } from "./labels";
import { IconPicker, configureIconFavorites } from "./icons";
import { animateTitle } from "./title-motion";
import { NoteHover } from "./hover";
import { openNoteLink, mediaPath, storeImage } from "./media";
import { ExportModal } from "./export";
import { shapeSVG, shapeChoices } from "./shapes";
import { revealOffset, easeOut } from "./motion";
import {
  Plugin,
  Scope,
  TextFileView,
  WorkspaceLeaf,
  Notice,
  Modal,
  App,
  TFile,
  FileSystemAdapter,
  FuzzySuggestModal,
  MarkdownRenderer,
  Component,
  setIcon,
  getIconIds,
  normalizePath,
  Menu,
} from "obsidian";
import {
  Config,
  defaults,
  normalizeConfig,
  chooseIcon,
  ConfigModal,
  ConfigTab,
  shapes,
  Shape,
} from "./settings";
import { NoteEditor } from "./editor";
import {
  TreeDoc,
  TreeNode,
  Point,
  Side,
  fresh,
  parseDoc,
  clone,
  children,
  subtree,
  colorOf,
  addNode,
  moveNode,
  layout,
  edgePath,
  isComment,
} from "./model";
const VIEW = "branch-tree";
class Confirm extends Modal {
  constructor(
    app: App,
    private title: string,
    private message: string,
    private action: () => void,
    private suppress?: () => void,
  ) {
    super(app);
  }
  onOpen() {
    this.contentEl.createEl("h2", { text: this.title });
    this.contentEl.createEl("p", { text: this.message });
    let skip: HTMLInputElement | undefined;
    if (this.suppress) {
      const label = this.contentEl.createEl("label", {
        cls: "bt-session-confirm",
      });
      skip = label.createEl("input", { type: "checkbox" });
      label.createSpan({
        text: "Больше не показывать до перезапуска Obsidian",
      });
    }
    const row = this.contentEl.createDiv({ cls: "bt-modal-actions" });
    const cancel = row.createEl("button", { text: "Отмена" });
    cancel.onclick = () => this.close();
    const ok = row.createEl("button", { text: "Удалить", cls: "mod-warning" });
    ok.onclick = () => {
      this.close();
      if (skip?.checked) this.suppress?.();
      this.action();
    };
    cancel.focus();
  }
  onClose() {
    this.contentEl.empty();
  }
}
class PickFile extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private mode: "note" | "image" | "tree",
    private chosen: (f: TFile) => void,
  ) {
    super(app);
    this.setPlaceholder(
      mode === "tree"
        ? "Выберите дерево"
        : mode === "note"
          ? "Выберите файл из хранилища"
          : "Выберите изображение из хранилища",
    );
  }
  getItems() {
    return this.app.vault
      .getFiles()
      .filter((f) =>
        this.mode === "tree"
          ? f.extension === "skilltree"
          : this.mode === "note"
            ? true
            : /^(png|jpe?g|gif|webp|svg|avif)$/i.test(f.extension),
      );
  }
  getItemText(f: TFile) {
    return f.path;
  }
  onChooseItem(f: TFile) {
    this.chosen(f);
  }
}
class TreeNameModal extends Modal {
  private settled = false;
  constructor(
    app: App,
    private initial: string,
    private done: (name: string | null) => void,
  ) {
    super(app);
  }
  onOpen() {
    this.contentEl.createEl("h2", { text: "Новое дерево" });
    const input = this.contentEl.createEl("input", {
      type: "text",
      attr: { "aria-label": "Название дерева" },
    });
    input.value = this.initial;
    input.style.width = "100%";
    const hint = this.contentEl.createEl("p", {
      text: "Имя файла и главного узла. Позже их можно переименовать независимо.",
    });
    const save = this.contentEl.createEl("button", {
      text: "Создать",
      cls: "mod-cta",
    });
    const submit = () => {
      const name = input.value.trim().replace(/\.skilltree$/i, "");
      if (
        !name ||
        /[\\/:*?"<>|]/.test(name) ||
        /[. ]$/.test(name) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
      ) {
        hint.setText("Введите имя без запрещённых символов пути.");
        return;
      }
      this.settled = true;
      this.done(name);
      this.close();
    };
    save.onclick = submit;
    input.onkeydown = (e) => {
      if (e.key === "Enter") submit();
    };
    input.focus();
    input.select();
  }
  onClose() {
    if (!this.settled) this.done(null);
    this.contentEl.empty();
  }
}
export default class BranchTreePlugin extends Plugin {
  skipDeleteConfirmation = false;
  config: Config = structuredClone(defaults);
  listeners = new Set<() => void>();
  async updateConfig(c: Config) {
    this.config = c;
    await this.saveData(c);
    for (const refresh of this.listeners) refresh();
  }
  async onload() {
    this.config = normalizeConfig(await this.loadData());
    configureIconFavorites(
      () => this.config.lucideFavorites ?? [],
      async (values) => {
        this.config.lucideFavorites = values;
        await this.saveData(this.config);
      },
    );
    this.addSettingTab(new ConfigTab(this.app, this, this));
    this.registerView(VIEW, (leaf) => new TreeView(leaf, this));
    this.registerExtensions(["skilltree"], VIEW);
    this.addRibbonIcon(
      "workflow",
      "Создать дерево заметок",
      () => void this.createTree(),
    );
    this.addCommand({
      id: "create-tree",
      name: "Создать дерево заметок",
      callback: () => void this.createTree(),
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFile) return;
        menu.addItem((item) =>
          item
            .setTitle("Новое дерево заметок")
            .setIcon("workflow")
            .onClick(() => void this.createTree(file.path)),
        );
      }),
    );
  }
  async createTree(folder = "", seed?: TreeNode, config = this.config) {
    const name = await new Promise<string | null>((resolve) =>
      new TreeNameModal(
        this.app,
        seed?.title ?? "Новое дерево",
        resolve,
      ).open(),
    );
    if (!name) return;
    try {
      let i = 1,
        path: string;
      do {
        path = normalizePath(
          (folder ? folder + "/" : "") +
            name +
            (i === 1 ? "" : " " + i) +
            ".skilltree",
        );
        i++;
      } while (this.app.vault.getAbstractFileByPath(path));
      const doc = fresh();
      doc.settings = clone(config);
      doc.layout = config.layout;
      doc.nodes[0].title = path
        .split("/")
        .pop()!
        .replace(/\.skilltree$/, "");
      applyPresetIcon(
        doc.nodes[0],
        seed?.icon ?? chooseIcon(config, getIconIds()),
      );
      if (seed) {
        doc.nodes[0].body = seed.body;
        doc.nodes[0].note = seed.note;
        doc.nodes[0].image = seed.image;
        doc.nodes[0].shape = seed.shape;
        doc.nodes[0].color = seed.color;
      }
      const file = await this.app.vault.create(
        path,
        JSON.stringify(doc, null, 2),
      );
      await this.app.workspace.getLeaf("tab").openFile(file);
      return file;
    } catch (e) {
      new Notice("Не удалось создать дерево: " + String(e));
    }
  }
}
class TreeView extends TextFileView {
  doc: TreeDoc = fresh();
  get config(): Config {
    const own = this.doc.settings ?? this.plugin.config;
    const deletedPalettes = this.plugin.config.deletedPalettes ?? [];
    const palettes = { ...own.palettes, ...this.plugin.config.palettes };
    for (const name of deletedPalettes) delete palettes[name];
    const deletedIconSets = this.plugin.config.deletedIconSets ?? [];
    const iconSets = { ...own.iconSets, ...this.plugin.config.iconSets };
    for (const name of deletedIconSets) delete iconSets[name];
    return {
      ...own,
      deletedPalettes,
      deletedIconSets,
      icons: Object.hasOwn(iconSets, own.icons)
        ? own.icons
        : Object.keys(iconSets)[0],
      palette: Object.hasOwn(palettes, own.palette)
        ? own.palette
        : Object.keys(palettes)[0],
      palettes,
      iconSets,
    };
  }
  private selectedNodes = new Set<string>();
  private invalid: string | null = null;
  private raw = "";
  private stage!: HTMLElement;
  private world!: HTMLElement;
  private panel!: HTMLElement;
  private divider!: HTMLElement;
  private toolbar!: HTMLElement;
  private positions = new Map<string, Point>();
  private selected: string | null = null;
  private focusId: string | null = null;
  private navigatorOpen = false;
  private searchQuery = "";
  private searchFilters = new Set<string>();
  private navigatorEl?: HTMLElement;
  private minimap?: HTMLElement;
  private collapseRestore: Map<string, boolean> | null = null;
  private past: TreeDoc[] = [];
  private future: TreeDoc[] = [];
  private preview = new Component();
  private hover: NoteHover;
  private editing: string | null = null;
  private appearing: string | null = null;
  private layoutFrame = 0;
  private cameraFrame = 0;
  private reducedMotion() {
    return (
      this.contentEl.ownerDocument.defaultView?.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches ?? false
    );
  }
  private stopCamera() {
    cancelAnimationFrame(this.cameraFrame);
    this.cameraFrame = 0;
  }
  private panelGeneration = 0;
  private loaded = false;
  private observer?: ResizeObserver;
  private noteEditor?: NoteEditor;
  constructor(
    leaf: WorkspaceLeaf,
    private plugin: BranchTreePlugin,
  ) {
    super(leaf);
    this.hover = new NoteHover(this.app, this.contentEl);
    this.register(() => this.hover.hide());
    this.addChild(this.preview);
    this.register(() => this.observer?.disconnect());
    this.register(() => {
      cancelAnimationFrame(this.layoutFrame);
      this.stopCamera();
    });
    this.register(() => this.noteEditor?.destroy());
    const refresh = () => {
      if (this.loaded && !this.invalid) this.renderGraph();
    };
    this.plugin.listeners.add(refresh);
    this.register(() => this.plugin.listeners.delete(refresh));
  }
  getViewType() {
    return VIEW;
  }
  getDisplayText() {
    return this.file?.basename ?? "Дерево заметок";
  }
  getIcon() {
    return "workflow";
  }
  getViewData() {
    return this.invalid ? this.raw : JSON.stringify(this.doc, null, 2);
  }
  setViewData(data: string, clear: boolean) {
    if (this.loaded && !clear && data === this.getViewData()) return;
    this.raw = data;
    try {
      this.doc = parseDoc(data);
      const legacy = !this.doc.settings;
      this.doc.settings = normalizeConfig(
        this.doc.settings ?? this.plugin.config,
      );
      this.doc.settings.layout = this.doc.layout;
      if (legacy) this.requestSave();
      this.invalid = null;
    } catch (e) {
      this.invalid = String(e);
    }
    if (clear) {
      this.past = [];
      this.future = [];
      this.selected = null;
      this.focusId = null;
      this.collapseRestore = null;
    }
    this.loaded = true;
    this.render();
  }
  clear() {
    this.hover.hide();
    this.noteEditor?.destroy();
    this.noteEditor = undefined;
    this.loaded = false;
    this.doc = fresh();
    this.selected = null;
    this.past = [];
    this.future = [];
    this.invalid = null;
    this.contentEl.empty();
  }
  async onOpen() {
    this.scope = new Scope(this.app.scope);
    this.scope.register(["Mod"], "f", () => {
      this.navigatorOpen = true;
      this.renderNavigator();
      this.navigatorEl?.querySelector("input")?.focus();
      return false;
    });
    this.contentEl.addClass("bt-view");
    this.contentEl.tabIndex = 0;
    this.registerDomEvent(
      this.contentEl.ownerDocument.defaultView!,
      "keydown",
      (e: KeyboardEvent) => {
        const t = e.target as HTMLElement;
        if (!this.loaded || this.invalid) return;
        const active = this.app.workspace.getActiveViewOfType(TreeView);
        if (active !== this) return;
        if (
          (e.ctrlKey || e.metaKey) &&
          (e.code === "KeyF" || e.key.toLowerCase() === "f")
        ) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.navigatorOpen = true;
          this.renderNavigator();
          this.navigatorEl?.querySelector("input")?.focus();
          return;
        }
        if (
          t.closest?.(
            "input,textarea,[contenteditable=true],.modal-container,.modal",
          )
        )
          return;
        if (e.code === "Space" || e.key === " ") {
          const hovered = this.world?.querySelector<HTMLElement>(
            ".bt-image-node.is-hovered",
          );
          const node = this.doc.nodes.find((n) => n.id === hovered?.dataset.id);
          if (node?.image) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.previewImage(node);
            return;
          }
        }
        const key =
          e.code === "KeyZ"
            ? "z"
            : e.code === "KeyY"
              ? "y"
              : e.key.toLowerCase();
        if (
          (e.ctrlKey || e.metaKey) &&
          !e.altKey &&
          (key === "z" || key === "y")
        ) {
          e.preventDefault();
          e.stopImmediatePropagation();
          key === "y" || e.shiftKey ? this.redo() : this.undo();
        } else if (e.key === "Escape" && this.contentEl.contains(t)) {
          this.selected = null;
          this.renderPanel();
        }
      },
      true,
    );
    const graphClipboard = (e: ClipboardEvent) =>
      this.loaded &&
      !this.invalid &&
      this.app.workspace.getActiveViewOfType(TreeView) === this &&
      !!this.selected &&
      !(e.target as HTMLElement)?.closest?.(
        "input,textarea,[contenteditable=true],.modal,.modal-container",
      );
    this.registerDomEvent(
      this.contentEl.ownerDocument.defaultView!,
      "copy",
      (e: ClipboardEvent) => {
        if (!graphClipboard(e) || !e.clipboardData) return;
        const nodes = copyBranches(
          this.doc,
          this.selectedNodes.size ? [...this.selectedNodes] : [this.selected!],
        );
        if (!nodes.length) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        e.clipboardData.setData(
          "text/plain",
          CLIPBOARD_PREFIX + JSON.stringify(nodes),
        );
      },
      true,
    );
    this.registerDomEvent(
      this.contentEl.ownerDocument.defaultView!,
      "paste",
      (e: ClipboardEvent) => {
        if (!graphClipboard(e) || !e.clipboardData) return;
        const target = this.selected!;
        const image = Array.from(e.clipboardData.files).find((f) =>
          f.type.startsWith("image/"),
        );
        if (image) {
          e.preventDefault();
          e.stopImmediatePropagation();
          const path = mediaPath(image.type);
          void storeImage(this.app, path, image)
            .then(() => {
              if (!this.loaded || !this.doc.nodes.some((n) => n.id === target))
                return;
              this.change(() => {
                const node = addNode(this.doc, target);
                node.image = path;
                node.title = "Изображение";
                this.doc.nodes.find((n) => n.id === target)!.collapsed = false;
              });
            })
            .catch(
              (error) =>
                new Notice("Не удалось вставить изображение: " + String(error)),
            );
          return;
        }
        const text = e.clipboardData.getData("text/plain");
        if (!text.startsWith(CLIPBOARD_PREFIX)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        try {
          const nodes = JSON.parse(text.slice(CLIPBOARD_PREFIX.length));
          if (!Array.isArray(nodes) || !nodes.length || nodes.length > 10000)
            throw Error("Некорректная ветка");
          const root = { ...fresh().nodes[0], id: "clipboard-root" };
          const checked = parseDoc(
            JSON.stringify({
              ...fresh(),
              nodes: [
                root,
                ...nodes.map((n) => ({ ...n, parent: n.parent ?? root.id })),
              ],
            }),
          );
          const payload = checked.nodes
            .filter((n) => n.id !== root.id)
            .map((n) => ({
              ...n,
              parent: n.parent === root.id ? null : n.parent,
            }));
          this.change(() => pasteBranches(this.doc, target, payload));
        } catch (error) {
          new Notice("Не удалось вставить узлы: " + String(error));
        }
      },
      true,
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, old) => {
        if (!this.loaded || this.invalid) return;
        let changed = false;
        for (const n of this.doc.nodes)
          for (const key of ["note", "image", "tree"] as const)
            if (n[key] === old || n[key]?.startsWith(old + "/")) {
              n[key] = file.path + n[key]!.slice(old.length);
              changed = true;
            }
        if (changed) {
          this.requestSave();
          this.render();
        }
      }),
    );
  }
  private snapshot() {
    this.past.push(clone(this.doc));
    if (this.past.length > 80) this.past.shift();
    this.future = [];
  }
  private change(fn: () => void) {
    if (this.invalid) return;
    this.snapshot();
    fn();
    const prior = new Map(
      this.past.at(-1)!.nodes.map((n) => [n.id, JSON.stringify(n)]),
    );
    for (const n of this.doc.nodes)
      if (prior.get(n.id) !== JSON.stringify(n))
        n.updatedAt = new Date().toISOString();
    this.requestSave();
    this.renderGraph();
    this.renderToolbar();
    this.refreshNavigatorResults();
  }
  private undo() {
    if (!this.past.length) return;
    this.future.push(clone(this.doc));
    this.doc = this.past.pop()!;
    this.requestSave();
    this.render();
    this.contentEl.focus({ preventScroll: true });
  }
  private redo() {
    if (!this.future.length) return;
    this.past.push(clone(this.doc));
    this.doc = this.future.pop()!;
    this.requestSave();
    this.render();
    this.contentEl.focus({ preventScroll: true });
  }
  private button(
    parent: HTMLElement,
    label: string,
    icon: string,
    action: () => void,
    cls = "",
  ) {
    const b = parent.createEl("button", {
      cls,
      attr: { "aria-label": label },
    });
    b.dataset.command = cls || icon || label;
    setIcon(b, icon);
    if (cls.includes("bt-action")) {
      b.removeAttribute("aria-label");
      const text = b.createSpan({ cls: "bt-sr-only", text: label });
      text.id = "bt-action-" + crypto.randomUUID();
      b.setAttribute("aria-labelledby", text.id);
    }
    if (!cls.includes("bt-circle") && !cls.includes("bt-action")) {
      let tip: HTMLElement | undefined;
      const hide = () => {
        tip?.remove();
        tip = undefined;
      };
      b.addEventListener("pointerenter", () => {
        hide();
        if (b.closest(".bt-controls-dragging")) return;
        tip = document.body.createDiv({
          cls: "tooltip bt-instant-tooltip",
          text: b.getAttribute("aria-label") ?? label,
        });
        const r = b.getBoundingClientRect();
        tip.style.left = Math.min(r.left, window.innerWidth - 240) + "px";
        tip.style.top = r.bottom + 6 + "px";
      });
      b.addEventListener("pointerleave", hide);
      b.addEventListener("click", hide);
      b.addEventListener("blur", hide);
    }

    b.onclick = (e) => {
      e.stopPropagation();
      action();
    };
    return b;
  }
  private render() {
    this.hover.hide();
    cancelAnimationFrame(this.layoutFrame);
    this.stopCamera();
    this.noteEditor?.destroy();
    this.noteEditor = undefined;
    this.observer?.disconnect();
    this.panelGeneration++;
    this.contentEl.empty();
    if (this.invalid) {
      this.contentEl.createEl("h3", { text: "Не удалось открыть дерево" });
      this.contentEl.createEl("p", { text: this.invalid });
      this.contentEl.createEl("p", {
        text: "Исходный файл не изменён. Проверьте JSON и версию формата.",
      });
      return;
    }
    this.toolbar = this.contentEl.createDiv({ cls: "bt-toolbar" });
    const body = this.contentEl.createDiv({ cls: "bt-body" });
    this.navigatorEl = body.createDiv({ cls: "bt-navigator" });
    this.renderNavigator();
    this.stage = body.createDiv({ cls: "bt-stage" });
    this.world = this.stage.createDiv({ cls: "bt-world" });
    this.minimap = this.stage.createDiv({
      cls: "bt-minimap",
      attr: { "aria-label": "Миникарта дерева" },
    });
    this.divider = body.createDiv({
      cls: "bt-panel-divider",
      attr: {
        role: "separator",
        "aria-label": "Ширина панели заметки",
        "aria-orientation": "vertical",
        tabindex: "0",
      },
    });
    this.panel = body.createDiv({ cls: "bt-panel" });
    this.bindPanelResize();
    this.renderToolbar();
    this.renderGraph();
    this.renderPanel();
    this.bindStage();
  }
  private renderToolbar() {
    if (!this.toolbar) return;
    this.toolbar.empty();
    this.toolbar.createSpan({ cls: "bt-brand", text: "BRANCH TREE" });
    const exportButton = this.button(
      this.toolbar,
      "Экспорт PNG / PDF",
      "download",
      () => {
        try {
          const style = getComputedStyle(this.contentEl);
          new ExportModal(
            this.app,
            this.doc,
            this.config,
            this.file?.basename ?? "Дерево",
            {
              background:
                style.getPropertyValue("--background-primary").trim() ||
                "#181820",
              foreground:
                style.getPropertyValue("--text-normal").trim() || "#eeeeee",
            },
            this.file?.path,
          ).open();
        } catch (error) {
          new Notice("Не удалось открыть экспорт: " + String(error));
        }
      },
    );

    this.button(this.toolbar, "Настройки дерева", "settings-2", () =>
      new ConfigModal(this.app, {
        scope: "tree",
        config: clone(this.config),
        updateConfig: async (c) => {
          this.change(() => {
            this.doc.settings = normalizeConfig(c);
            this.doc.layout = c.layout;
          });
          this.renderPanel();
          await this.plugin.updateConfig({
            ...this.plugin.config,
            deletedPalettes: c.deletedPalettes,
            deletedIconSets: c.deletedIconSets,
            palettes: c.palettes,
            iconSets: c.iconSets,
          });
        },
      }).open(),
    );
    this.button(
      this.toolbar,
      this.doc.layout === "radial"
        ? "Переключить на прямоугольную сетку"
        : "Переключить на круговую сетку",
      this.doc.layout === "radial" ? "circle-dot" : "workflow",
      () =>
        this.change(() => {
          this.doc.layout =
            this.doc.layout === "radial" ? "vertical" : "radial";
          this.doc.settings!.layout = this.doc.layout;
        }),
      "bt-layout-toggle",
    );
    const comments = this.button(
      this.toolbar,
      this.doc.hideComments ? "Показать комментарии" : "Скрыть комментарии",
      this.doc.hideComments ? "message-square-off" : "message-square",
      () =>
        this.change(() => {
          this.doc.hideComments = !this.doc.hideComments;
        }),
      "bt-comments-toggle",
    );
    comments.setAttribute("aria-pressed", String(!this.doc.hideComments));
    this.button(this.toolbar, "Поиск и списки узлов", "search", () => {
      this.navigatorOpen = !this.navigatorOpen;
      this.renderNavigator();
    });
    this.button(
      this.toolbar,
      this.collapseRestore ? "Вернуть свёрнутые ветки" : "Раскрыть всё дерево",
      this.collapseRestore ? "fold-vertical" : "unfold-vertical",
      () => {
        if (this.collapseRestore) {
          const restore = this.collapseRestore;
          this.collapseRestore = null;
          this.change(() => {
            for (const n of this.doc.nodes)
              if (restore.has(n.id)) n.collapsed = restore.get(n.id);
          });
        } else {
          this.collapseRestore = new Map(
            this.doc.nodes.map((n) => [n.id, !!n.collapsed]),
          );
          this.change(() =>
            this.doc.nodes.forEach((n) => (n.collapsed = false)),
          );
        }
      },
    );
    if (this.focusId)
      this.button(
        this.toolbar,
        "Выйти из режима сосредоточения",
        "maximize",
        () => {
          this.focusId = null;
          this.renderGraph();
          this.renderToolbar();
          this.fit();
        },
      );
    this.toolbar.createSpan({
      cls: "bt-count",
      text: `${this.doc.nodes.length} пунктов`,
    });
    this.button(this.toolbar, "Отменить · Ctrl+Z", "undo-2", () =>
      this.undo(),
    ).disabled = !this.past.length;
    this.button(this.toolbar, "Повторить · Ctrl+Shift+Z", "redo-2", () =>
      this.redo(),
    ).disabled = !this.future.length;
    this.button(this.toolbar, "Уменьшить", "minus", () => this.zoom(0.8));
    this.button(this.toolbar, "Увеличить", "plus", () => this.zoom(1.25));
    this.button(this.toolbar, "Показать всё дерево", "scan", () => this.fit());
    this.button(this.toolbar, "К центру", "locate-fixed", () => {
      this.doc.camera = { x: 0, y: 0, zoom: 1 };
      this.transform();
      this.requestSave();
    });
    this.arrangeButtons(this.toolbar, "toolbar");
  }
  private previewImage(node: TreeNode) {
    if (!node.image) return;
    const modal = new Modal(this.app);
    modal.modalEl.addClass("bt-image-preview-modal");
    modal.contentEl.createEl("h2", { text: node.title });
    const file = this.app.vault.getAbstractFileByPath(node.image);
    modal.contentEl.createEl("img", {
      attr: {
        alt: node.title,
        src:
          file instanceof TFile
            ? this.app.vault.getResourcePath(file)
            : this.app.vault.adapter.getResourcePath(node.image),
      },
    });
    modal.open();
  }
  private arrangeButtons(container: HTMLElement, group: string) {
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button[data-command]"),
    );
    const order = this.plugin.config.buttonOrders?.[group] ?? [];
    const sides = this.plugin.config.buttonSides?.[group] ?? {};
    for (const button of buttons) {
      const defaultRight =
        group === "toolbar"
          ? [
              "undo-2",
              "redo-2",
              "minus",
              "plus",
              "scan",
              "locate-fixed",
            ].includes(button.dataset.command!)
          : !!button.closest(".bt-tree-links");
      button.dataset.side =
        sides[button.dataset.command!] ?? (defaultRight ? "right" : "left");
    }
    buttons.sort((a, b) => {
      const ai = order.indexOf(a.dataset.command!),
        bi = order.indexOf(b.dataset.command!);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });
    const spacer =
      container.querySelector<HTMLElement>(".bt-count") ??
      container.createSpan({ cls: "bt-control-spacer" });
    spacer.classList.add("bt-control-spacer");
    for (const button of buttons.filter((b) => b.dataset.side === "left"))
      container.insertBefore(button, spacer);
    for (const button of buttons.filter((b) => b.dataset.side === "right"))
      container.appendChild(button);
    container
      .querySelectorAll(":scope > div:empty")
      .forEach((el) => el.remove());
    const save = () => {
      this.plugin.config.buttonOrders ??= {};
      this.plugin.config.buttonSides ??= {};
      const current = Array.from(
        container.querySelectorAll<HTMLButtonElement>("button[data-command]"),
      );
      this.plugin.config.buttonOrders[group] = current.map(
        (b) => b.dataset.command!,
      );
      this.plugin.config.buttonSides[group] = Object.fromEntries(
        current.map((b) => [
          b.dataset.command!,
          b.dataset.side as "left" | "right",
        ]),
      );
      void this.plugin.saveData(this.plugin.config);
    };
    let dragged: HTMLButtonElement | undefined;
    let target: Element | null = null;
    let side = "left";
    let marker: HTMLElement | undefined;
    const shiftSlot = (before: Element | null) => {
      if (!marker || marker.nextElementSibling === before) return;
      const positions = new Map(
        buttons
          .filter((b) => b !== dragged)
          .map((b) => [b, b.getBoundingClientRect().left]),
      );
      container.insertBefore(marker, before);
      if (
        container.ownerDocument.defaultView?.matchMedia?.(
          "(prefers-reduced-motion: reduce)",
        ).matches
      )
        return;
      for (const [button, previous] of positions) {
        const dx = previous - button.getBoundingClientRect().left;
        if (Math.abs(dx) > 0.5) {
          button.getAnimations?.().forEach((animation) => animation.cancel());
          button.animate?.(
            [{ translate: dx + "px 0" }, { translate: "0px 0" }],
            { duration: 160, easing: "ease-out" },
          );
        }
      }
    };
    const clear = () => {
      dragged?.classList.remove("bt-button-dragging");
      dragged = undefined;
      container.classList.remove("bt-controls-dragging");
      marker?.remove();
      marker = undefined;
    };
    container.ondragover = (e) => {
      if (!dragged) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      if (!marker) {
        const width = dragged.getBoundingClientRect().width || 30;
        marker = container.createDiv({ cls: "bt-insertion-marker" });
        marker.setAttribute("aria-hidden", "true");
        marker.style.width = width + "px";
        container.insertBefore(marker, dragged);
        dragged.classList.add("bt-button-dragging");
      }
      const slotRect = marker?.getBoundingClientRect();
      if (slotRect && e.clientX >= slotRect.left && e.clientX <= slotRect.right)
        return;
      const r = spacer.getBoundingClientRect();
      side = e.clientX < (r.left + r.right) / 2 ? "left" : "right";
      const peers = Array.from(
        container.querySelectorAll<HTMLButtonElement>("button[data-command]"),
      ).filter((b) => b !== dragged && b.dataset.side === side);
      target =
        peers.find((b) => {
          const r = b.getBoundingClientRect();
          return e.clientX < r.left + r.width / 2;
        }) ?? (side === "left" ? spacer : null);
      shiftSlot(target);
    };
    container.ondrop = (e) => {
      if (!dragged) return;
      e.preventDefault();
      e.stopPropagation();
      dragged.dataset.side = side;
      container.insertBefore(dragged, marker ?? target);
      save();
      clear();
    };
    for (const button of buttons) {
      button.draggable = true;
      button.ondragstart = (e) => {
        dragged = button;
        side = button.dataset.side!;
        target = button.nextElementSibling;
        container
          .querySelectorAll(".bt-instant-tooltip")
          .forEach((el) => el.remove());
        container.ownerDocument
          .querySelectorAll(".bt-instant-tooltip")
          .forEach((el) => el.remove());
        container.classList.add("bt-controls-dragging");
        e.stopPropagation();
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData(
            "application/x-branch-tree-button",
            button.dataset.command!,
          );
          e.dataTransfer.setDragImage(
            button,
            button.offsetWidth / 2,
            button.offsetHeight / 2,
          );
        }
      };
      button.ondragend = clear;
      button.oncontextmenu = (e) => {
        e.preventDefault();
        const menu = new Menu();
        for (const [value, label] of [
          ["left", "Закрепить слева"],
          ["right", "Закрепить справа"],
        ])
          menu.addItem((i) =>
            i.setTitle(label).onClick(() => {
              button.dataset.side = value;
              container.insertBefore(button, value === "left" ? spacer : null);
              save();
            }),
          );
        menu.addItem((i) =>
          i.setTitle("Передвинуть влево").onClick(() => {
            const prev = button.previousElementSibling;
            if (
              prev?.matches("button") &&
              (prev as HTMLElement).dataset.side === button.dataset.side
            ) {
              container.insertBefore(button, prev);
              save();
            }
          }),
        );
        menu.addItem((i) =>
          i.setTitle("Передвинуть вправо").onClick(() => {
            const next = button.nextElementSibling;
            if (
              next?.matches("button") &&
              (next as HTMLElement).dataset.side === button.dataset.side
            ) {
              container.insertBefore(next, button);
              save();
            }
          }),
        );
        menu.showAtPosition({ x: e.clientX, y: e.clientY });
      };
    }
  }
  private transform() {
    const c = this.doc.camera;
    this.updateMinimapCamera();
    this.world.style.transform = `translate(${this.stage.clientWidth / 2 + c.x}px,${this.stage.clientHeight / 2 + c.y}px) scale(${c.zoom})`;
    this.stage.style.backgroundSize = `${48 * c.zoom}px ${48 * c.zoom}px`;
    this.stage.style.backgroundPosition = `${this.stage.clientWidth / 2 + c.x}px ${this.stage.clientHeight / 2 + c.y}px`;
  }
  private zoom(factor: number) {
    this.stopCamera();
    this.doc.camera.zoom = Math.max(
      0.075,
      Math.min(3, this.doc.camera.zoom * factor),
    );
    this.transform();
    this.requestSave();
  }
  private fit() {
    this.stopCamera();
    const ps = [...this.positions.values()];
    if (!ps.length) return;
    const minX = Math.min(...ps.map((p) => p.x)) - 120,
      maxX = Math.max(...ps.map((p) => p.x)) + 120,
      minY = Math.min(...ps.map((p) => p.y)) - 100,
      maxY = Math.max(...ps.map((p) => p.y)) + 120;
    const zoom = Math.max(
      0.075,
      Math.min(
        1.25,
        this.stage.clientWidth / (maxX - minX),
        this.stage.clientHeight / (maxY - minY),
      ),
    );
    this.doc.camera = {
      zoom,
      x: (-(minX + maxX) / 2) * zoom,
      y: (-(minY + maxY) / 2) * zoom,
    };
    this.transform();
    this.requestSave();
  }
  private renderGraph() {
    this.hover.hide();
    if (!this.world) return;
    cancelAnimationFrame(this.layoutFrame);
    const previous = new Map<string, Point>();
    for (const el of Array.from(
      this.world.querySelectorAll<HTMLElement>(".bt-node:not(.bt-exiting)"),
    ))
      previous.set(el.dataset.id!, {
        x: parseFloat(el.style.left) + (parseFloat(el.style.translate) || 0),
        y:
          parseFloat(el.style.top) +
          (parseFloat(el.style.translate.split(" ")[1]) || 0),
      });
    const animateLayout = previous.size > 0 && !this.reducedMotion();
    const oldNodes = Array.from(
      this.world.querySelectorAll<HTMLElement>(".bt-node:not(.bt-exiting)"),
    ).map((el) => el.cloneNode(true) as HTMLElement);
    const oldEdges = Array.from(
      this.world.querySelectorAll<SVGPathElement>(
        ".bt-edges path:not(.bt-exiting)",
      ),
    ).map((el) => el.cloneNode(true) as SVGPathElement);
    const edgeStarts = new Map<string, Point>();
    for (const path of oldEdges) {
      const numbers = path
        .getAttribute("d")
        ?.match(/-?[0-9]+(?:\.[0-9]+)?/g)
        ?.map(Number);
      if (numbers?.length)
        edgeStarts.set(path.getAttribute("data-child")!, {
          x: numbers[0],
          y: numbers[1],
        });
    }

    this.world.empty();
    const config = this.config;
    let displayDoc = this.doc;
    if (this.focusId && !this.doc.nodes.some((n) => n.id === this.focusId))
      this.focusId = null;
    if (this.focusId) {
      const ids = subtree(this.doc, this.focusId);
      displayDoc = {
        ...this.doc,
        nodes: this.doc.nodes
          .filter((n) => ids.has(n.id))
          .map((n) =>
            n.id === this.focusId ? { ...n, parent: null, comment: false } : n,
          ),
      };
    }
    const geometry = treeGeometry(displayDoc, config);
    this.positions = geometry.positions;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("bt-edges");
    this.world.appendChild(svg);
    for (const n of this.doc.nodes) {
      const p = this.positions.get(n.id),
        a = n.parent ? this.positions.get(n.parent) : undefined;
      if (!p || !a) continue;
      const path = document.createElementNS(svg.namespaceURI, "path");
      path.setAttribute("d", edgePath(this.doc, a, p));
      path.setAttribute("stroke", colorOf(this.doc, n.id));
      if (n.id === this.appearing) path.classList.add("bt-edge-new");
      if (isComment(this.doc, n.id)) path.classList.add("bt-comment-edge");
      path.setAttribute("data-child", n.id);
      svg.appendChild(path);
    }
    for (const n of this.doc.nodes) {
      const p = this.positions.get(n.id);
      if (!p) continue;
      const el = this.world.createDiv({
        cls: "bt-node" + (this.selected === n.id ? " is-selected" : ""),
        attr: { "data-id": n.id },
      });
      if (n.id === this.appearing || (animateLayout && !previous.has(n.id)))
        el.classList.add("bt-node-new");
      el.classList.toggle("bt-multiselected", this.selectedNodes.has(n.id));
      el.classList.toggle("bt-image-node", !!n.image);
      el.classList.toggle("bt-comment", isComment(this.doc, n.id));
      el.classList.toggle("bt-completed", !!n.completed);
      el.style.left = p.x + "px";
      el.style.top = p.y + "px";
      el.style.setProperty("--branch-color", colorOf(this.doc, n.id));
      const size =
        config.size *
        (n.parent === null || n.id === this.focusId ? config.rootScale : 1);
      el.style.setProperty("--node-size", `${size}px`);
      el.style.setProperty("--title-width", `${geometry.labelWidth}px`);
      el.classList.toggle("bt-root", n.parent === null);
      const orbit = el.createDiv({ cls: "bt-orbit" });
      const circle = this.button(
        orbit,
        "Открыть: " + n.title,
        n.icon || "circle-help",
        () => {
          this.selected = n.id;
          this.renderGraph();
          this.renderPanel();
        },
        "bt-circle",
      );
      if (n.emoji) {
        circle.empty();
        circle.createSpan({ cls: "bt-emoji", text: n.emoji });
      }
      if (n.image) {
        const f = this.app.vault.getAbstractFileByPath(n.image);
        if (f instanceof TFile || n.image.startsWith(".skilltree_files/")) {
          circle.empty();
          const image = circle.createEl("img", {
            attr: {
              src:
                f instanceof TFile
                  ? this.app.vault.getResourcePath(f)
                  : this.app.vault.adapter.getResourcePath(n.image),
              alt: "",
            },
          });
        }
      }
      if (n.image) {
        const image = circle.querySelector("img");
        if (image)
          image.onload = () => {
            const longest = Math.max(
              image.naturalWidth,
              image.naturalHeight,
              1,
            );
            el.style.setProperty(
              "--image-width",
              (size * image.naturalWidth) / longest + "px",
            );
            el.style.setProperty(
              "--image-height",
              (size * image.naturalHeight) / longest + "px",
            );
          };
        this.button(
          orbit,
          "Рассмотреть изображение · Пробел",
          "maximize",
          () => this.previewImage(n),
          "bt-action bt-image-expand",
        );
      }
      if (n.tree) {
        const openPanel = () => {
          this.selected = n.id;
          this.renderGraph();
          this.renderPanel();
        };
        circle.onclick = (e) => {
          e.stopPropagation();
          if (e.altKey) {
            openPanel();
            return;
          }
          void this.app.workspace.openLinkText(
            n.tree!,
            this.file?.path ?? "",
            true,
          );
        };
        circle.oncontextmenu = (e) => {
          e.preventDefault();
          openPanel();
        };
      }
      circle.prepend(shapeSVG(n.shape ?? config.shape));
      if (this.selected === n.id) {
        const halo = shapeSVG(n.shape ?? config.shape);
        halo.classList.add("bt-selection-halo");
        halo.setAttribute("aria-hidden", "true");
        circle.prepend(halo);
      }
      circle.removeAttribute("aria-label");
      const accessibleLabel = circle.createSpan({
        cls: "bt-sr-only",
        text: "Открыть: " + n.title,
      });
      accessibleLabel.id = "bt-node-label-" + crypto.randomUUID();
      circle.setAttribute("aria-labelledby", accessibleLabel.id);
      const openCircle = circle.onclick;
      circle.onclick = (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.stopPropagation();
          if (!this.selectedNodes.size && this.selected)
            this.selectedNodes.add(this.selected);
          this.selectedNodes.has(n.id)
            ? this.selectedNodes.delete(n.id)
            : this.selectedNodes.add(n.id);
          this.selected = n.id;
          this.renderGraph();
          this.renderPanel();
        } else {
          this.selectedNodes.clear();
          openCircle?.call(circle, e);
        }
      };
      const activate = () => {
        for (const other of Array.from(
          this.world.querySelectorAll(".is-hovered"),
        ))
          other.classList.remove("is-hovered");
        el.classList.add("is-hovered");
      };
      circle.onpointerenter = () => {
        activate();
        this.hover.show(circle, n, this.file?.path ?? "");
      };
      el.addEventListener("focusin", activate);
      el.onpointerleave = () => {
        el.classList.remove("is-hovered");
        this.hover.leave();
      };
      circle.onauxclick = (e) => {
        if (e.button === 1) {
          e.preventDefault();
          this.remove(n.id);
        }
      };
      circle.addEventListener("mousedown", (e) => {
        if (e.button === 1) e.preventDefault();
      });
      this.bindDrag(circle, n.id);
      const addButton = this.button(
        orbit,
        "Добавить ответвление · ПКМ: комментарий",
        "plus",
        () => this.add(n.id),
        "bt-action bt-add",
      );
      addButton.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.add(n.id, true);
      };
      const done = this.button(
        orbit,
        n.completed ? "Отметить невыполненным" : "Отметить выполненным",
        n.completed ? "check-check" : n.task ? "square" : "check",
        () =>
          this.change(() => {
            n.completed = !n.completed;
          }),
        "bt-action bt-complete",
      );
      done.setAttribute("aria-pressed", String(!!n.completed));
      if (n.parent !== null)
        this.button(
          orbit,
          "Удалить ветку",
          "x",
          () => this.remove(n.id),
          "bt-action bt-delete",
        );
      if (children(this.doc, n.id).length)
        this.button(
          orbit,
          n.collapsed ? "Раскрыть ветку" : "Свернуть ветку",
          n.collapsed ? "chevrons-up-down" : "chevrons-down-up",
          () =>
            this.change(() => {
              n.collapsed = !n.collapsed;
            }),
          "bt-action bt-collapse",
        );
      const title = el.createEl("button", {
        cls: "bt-title",
        text: displayTitle(n.title, geometry.labelWidth),
        attr: { title: "Нажмите, чтобы переименовать", lang: "ru" },
      });
      title.onclick = () => this.rename(n.id, title);
      animateTitle(el, title);
      if (n.title.includes("?"))
        el.createSpan({
          cls: "bt-question",
          text: "?",
          attr: { "aria-label": "Вопрос" },
        });
      if (n.important) el.createSpan({ cls: "bt-important", text: "★" });
      el.classList.toggle("bt-task", !!n.task);
      if (n.collapsed)
        el.createSpan({
          cls: "bt-badge",
          text: `+${subtree(this.doc, n.id).size - 1}`,
        });
      if (n.tree)
        el.createSpan({
          cls: "bt-linked",
          text: "⇥",
          attr: { "aria-label": "Ссылка на дерево · Alt+клик для настроек" },
        });
      else if (n.note) el.createSpan({ cls: "bt-linked", text: "↗" });
      else if (n.body.trim()) this.bodyBadge(el);
    }
    if (animateLayout && previous.size) {
      const nodes = Array.from(
        this.world.querySelectorAll<HTMLElement>(".bt-node:not(.bt-exiting)"),
      );
      const edges = Array.from(
        this.world.querySelectorAll<SVGPathElement>(
          ".bt-edges path:not(.bt-exiting)",
        ),
      );
      const targets = new Map(this.positions);
      const paint = (t: number) => {
        const current = new Map<string, Point>();
        for (const [id, to] of targets) {
          const from = previous.get(id) ?? to;
          current.set(id, {
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
          });
        }
        for (const el of nodes) {
          const p = current.get(el.dataset.id!)!;
          el.style.left = p.x + "px";
          el.style.top = p.y + "px";
        }
        for (const edge of edges) {
          const node = this.doc.nodes.find(
            (n) => n.id === edge.getAttribute("data-child"),
          );
          if (!node?.parent) continue;
          const target = targets.get(node.parent),
            start = edgeStarts.get(node.id);
          const a =
              target && start
                ? {
                    x: start.x + (target.x - start.x) * t,
                    y: start.y + (target.y - start.y) * t,
                  }
                : current.get(node.parent),
            p = current.get(node.id);
          if (a && p) edge.setAttribute("d", edgePath(this.doc, a, p));
        }
      };
      paint(0);
      let start: number | undefined;
      const tick = (now: number) => {
        start ??= now;
        const progress = Math.min(
          1,
          (now - start) / (this.doc.layout === "radial" ? 460 : 280),
        );
        paint(
          this.doc.layout === "radial"
            ? progress * progress * (3 - 2 * progress)
            : easeOut(progress),
        );
        if (progress < 1) this.layoutFrame = requestAnimationFrame(tick);
        else this.layoutFrame = 0;
      };
      this.layoutFrame = requestAnimationFrame(tick);
    }
    if (animateLayout) {
      for (const el of oldNodes) {
        if (this.positions.has(el.dataset.id!)) continue;
        el.classList.remove("is-hovered", "bt-node-new");
        el.classList.add("bt-exiting");
        el.removeAttribute("data-id");
        this.world.appendChild(el);
        setTimeout(() => el.remove(), 240);
      }
      for (const edge of oldEdges) {
        if (this.positions.has(edge.getAttribute("data-child")!)) continue;
        edge.classList.remove("bt-edge-new");
        edge.classList.add("bt-exiting");
        edge.removeAttribute("data-child");
        svg.appendChild(edge);
        setTimeout(() => edge.remove(), 240);
      }
    }
    this.appearing = null;
    this.renderMinimap();
    this.transform();
  }
  private add(id: string, comment = false) {
    this.stopCamera();
    let created = "";
    this.change(() => {
      created = addNode(
        this.doc,
        id,
        this.config.palettes[this.config.palette],
        chooseIcon(this.config, getIconIds()),
      ).id;
      const createdNode = this.doc.nodes.find((n) => n.id === created)!;
      applyPresetIcon(createdNode, createdNode.icon);
      if (comment) {
        this.doc.nodes.find((n) => n.id === created)!.comment = true;
        this.doc.hideComments = false;
      }
      this.appearing = created;
    });
    const p = this.positions.get(created);
    if (p) {
      const c = this.doc.camera;
      const x = this.stage.clientWidth / 2 + c.x + p.x * c.zoom,
        y = this.stage.clientHeight / 2 + c.y + p.y * c.zoom;
      const dx = revealOffset(
        x,
        this.stage.clientWidth,
        (this.config.size / 2 + 45) * c.zoom,
      );
      const dy = revealOffset(
        y,
        this.stage.clientHeight,
        (this.config.size / 2 + 70) * c.zoom,
      );
      if (dx || dy) {
        const fromX = c.x,
          fromY = c.y;
        if (this.reducedMotion()) {
          c.x += dx;
          c.y += dy;
          this.transform();
          this.requestSave();
        } else {
          let start: number | undefined;
          const tick = (now: number) => {
            start ??= now;
            const progress = Math.min(1, (now - start) / 300),
              t = easeOut(progress);
            c.x = fromX + dx * t;
            c.y = fromY + dy * t;
            this.transform();
            if (progress < 1) this.cameraFrame = requestAnimationFrame(tick);
            else {
              this.cameraFrame = 0;
              this.requestSave();
            }
          };
          this.cameraFrame = requestAnimationFrame(tick);
        }
      }
    }
    const title = this.world.querySelector<HTMLElement>(
      `[data-id="${created}"] .bt-title`,
    );
    if (title) this.rename(created, title);
  }
  private rename(id: string, title: HTMLElement) {
    const n = this.doc.nodes.find((n) => n.id === id)!;
    this.editing = id;
    const input = document.createElement("input");
    input.className = "bt-title bt-rename";
    input.value = n.title;
    input.maxLength = 200;
    title.replaceWith(input);
    let done = false;
    const finish = (save: boolean) => {
      if (done) return;
      done = true;
      this.editing = null;
      if (save && input.value.trim() && input.value.trim() !== n.title) {
        this.snapshot();
        n.title = input.value.trim();
        n.updatedAt = new Date().toISOString();
        this.requestSave();
        this.renderToolbar();
      }
      // Keep adjacent action buttons mounted between pointerdown and click.
      title.textContent = displayTitle(
        n.title,
        parseFloat(
          input.parentElement?.style.getPropertyValue("--title-width") ?? "132",
        ) || 132,
      );
      const heldFocus = input === input.ownerDocument.activeElement;
      input.replaceWith(title);
      if (heldFocus) title.focus({ preventScroll: true });
    };
    input.onblur = () => finish(true);
    input.onkeydown = (e) => {
      e.stopPropagation();
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        (e.code === "KeyZ" || e.key.toLowerCase() === "z") &&
        input.value === n.title
      ) {
        e.preventDefault();
        finish(false);
        e.shiftKey ? this.redo() : this.undo();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      }
      if (e.key === "Escape") finish(false);
    };
    input.focus({ preventScroll: true });
    input.select();
  }
  private remove(id: string) {
    const n = this.doc.nodes.find((n) => n.id === id);
    if (!n || n.parent === null) return;
    const count = subtree(this.doc, id).size;
    const removeBranch = () => {
      this.change(() => {
        const ids = subtree(this.doc, id);
        this.doc.nodes = this.doc.nodes.filter((n) => !ids.has(n.id));
        for (const removed of ids) this.selectedNodes.delete(removed);
        if (this.selected && ids.has(this.selected)) this.selected = null;
      });
      this.renderPanel();
    };
    if (this.plugin.skipDeleteConfirmation) {
      removeBranch();
      return;
    }
    new Confirm(
      this.app,
      "Удалить ветку?",
      `«${n.title}»: будет удалено пунктов — ${count}, включая всех потомков. Связанные файлы заметок останутся в хранилище. Действие можно отменить Ctrl+Z.`,
      removeBranch,
      () => {
        this.plugin.skipDeleteConfirmation = true;
      },
    ).open();
  }
  private cameraDrawPending = false;
  private scheduleCameraDraw() {
    if (this.cameraDrawPending) return;
    this.cameraDrawPending = true;
    requestAnimationFrame(() => {
      this.cameraDrawPending = false;
      if (this.loaded) this.transform();
    });
  }
  private bindStage() {
    this.stage.onwheel = (e) => {
      this.hover.hide();
      this.stopCamera();
      e.preventDefault();
      const rect = this.stage.getBoundingClientRect();
      const c = this.doc.camera;
      const px = e.clientX - rect.left - this.stage.clientWidth / 2,
        py = e.clientY - rect.top - this.stage.clientHeight / 2;
      const old = c.zoom;
      const next = Math.max(
        0.075,
        Math.min(3, old * Math.exp(-e.deltaY * 0.001)),
      );
      c.x = px - ((px - c.x) * next) / old;
      c.y = py - ((py - c.y) * next) / old;
      c.zoom = next;
      this.scheduleCameraDraw();
      this.requestSave();
    };
    this.stage.onpointerdown = (e) => {
      this.hover.hide();
      this.stopCamera();
      if ((e.target as HTMLElement).closest(".bt-node") || e.button !== 0)
        return;
      const x = e.clientX,
        y = e.clientY,
        c = { ...this.doc.camera };
      this.stage.setPointerCapture(e.pointerId);
      this.stage.classList.add("is-panning");
      this.stage.onpointermove = (v) => {
        this.doc.camera.x = c.x + v.clientX - x;
        this.doc.camera.y = c.y + v.clientY - y;
        this.scheduleCameraDraw();
      };
      const end = () => {
        this.stage.onpointermove = null;
        this.stage.onpointerup = null;
        this.stage.onpointercancel = null;
        this.stage.classList.remove("is-panning");
        this.requestSave();
      };
      this.stage.onpointerup = end;
      this.stage.onpointercancel = end;
    };
    this.observer = new ResizeObserver(() => {
      this.applyPanelWidth();
      this.transform();
    });
    this.observer.observe(this.stage);
  }
  private bindDrag(circle: HTMLElement, id: string) {
    circle.onpointerdown = (e) => {
      this.hover.hide();
      this.stopCamera();
      if (this.layoutFrame) {
        cancelAnimationFrame(this.layoutFrame);
        this.layoutFrame = 0;
        for (const el of Array.from(
          this.world.querySelectorAll<HTMLElement>(".bt-node:not(.bt-exiting)"),
        ))
          this.positions.set(el.dataset.id!, {
            x: parseFloat(el.style.left),
            y: parseFloat(el.style.top),
          });
      }
      if (
        e.button !== 0 ||
        this.doc.nodes.find((n) => n.id === id)!.parent === null
      )
        return;
      e.stopPropagation();
      const x = e.clientX,
        y = e.clientY;
      let moved = false,
        target: string | null = null;
      const forbidden = subtree(this.doc, id);
      circle.setPointerCapture(e.pointerId);
      circle.onpointermove = (v) => {
        if (Math.hypot(v.clientX - x, v.clientY - y) < 7 && !moved) return;
        moved = true;
        this.stage.classList.add("is-dragging");
        const dx = (v.clientX - x) / this.doc.camera.zoom,
          dy = (v.clientY - y) / this.doc.camera.zoom;
        for (const el of Array.from(
          this.world.querySelectorAll<HTMLElement>(".bt-node:not(.bt-exiting)"),
        )) {
          el.classList.remove("bt-drop-target");
          if (forbidden.has(el.dataset.id!))
            el.style.translate = `${dx}px ${dy}px`;
        }
        for (const path of Array.from(
          this.world.querySelectorAll<SVGPathElement>(
            ".bt-edges path:not(.bt-exiting)",
          ),
        )) {
          const child = this.doc.nodes.find(
            (n) => n.id === path.getAttribute("data-child"),
          )!;
          const p = this.positions.get(child.id)!,
            a = this.positions.get(child.parent!)!;
          const px = p.x + (forbidden.has(child.id) ? dx : 0),
            py = p.y + (forbidden.has(child.id) ? dy : 0);
          const ax = a.x + (forbidden.has(child.parent!) ? dx : 0),
            ay = a.y + (forbidden.has(child.parent!) ? dy : 0);
          path.setAttribute(
            "d",
            edgePath(this.doc, { x: ax, y: ay }, { x: px, y: py }),
          );
        }
        const rect = this.stage.getBoundingClientRect(),
          c = this.doc.camera;
        const wx =
            (v.clientX - rect.left - this.stage.clientWidth / 2 - c.x) / c.zoom,
          wy =
            (v.clientY - rect.top - this.stage.clientHeight / 2 - c.y) / c.zoom;
        target = null;
        let best = this.config.size * 0.65;
        for (const [candidate, p] of this.positions) {
          const dist = Math.hypot(p.x - wx, p.y - wy);
          if (!forbidden.has(candidate) && dist < best) {
            target = candidate;
            best = dist;
          }
        }
        if (target)
          this.world
            .querySelector(`[data-id="${target}"]`)
            ?.classList.add("bt-drop-target");
      };
      const end = (v: PointerEvent, cancel = false) => {
        circle.onpointermove = null;
        circle.onpointerup = null;
        circle.onpointercancel = null;
        this.stage.classList.remove("is-dragging");
        if (!moved) return;
        circle.onclick = (event) => {
          event.stopPropagation();
          event.preventDefault();
        };
        if (cancel) {
          this.renderGraph();
          return;
        }
        const rect = this.stage.getBoundingClientRect(),
          c = this.doc.camera;
        const wx =
            (v.clientX - rect.left - this.stage.clientWidth / 2 - c.x) / c.zoom,
          wy =
            (v.clientY - rect.top - this.stage.clientHeight / 2 - c.y) / c.zoom;
        this.change(() => {
          const n = this.doc.nodes.find((n) => n.id === id)!;
          const parent = target ?? n.parent!;
          const peers = children(this.doc, parent).filter((n) => n.id !== id);
          const center = this.positions.get(parent) ?? { x: 0, y: 0 };
          const angle = (x: number, y: number) =>
            (Math.atan2(y - center.y, x - center.x) +
              Math.PI / 2 +
              Math.PI * 2) %
            (Math.PI * 2);
          const right = peers.find((n) => {
            const p = this.positions.get(n.id);
            return (
              p &&
              (this.doc.layout === "radial"
                ? angle(p.x, p.y) > angle(wx, wy)
                : p.x > wx)
            );
          });
          const idx = right ? peers.indexOf(right) : peers.length;
          peers.splice(idx, 0, n);
          moveNode(this.doc, id, parent, idx, wy < 0 ? -1 : 1);
          peers.forEach((p, i) => (p.order = i));
        });
        if (this.selected) this.renderPanel();
      };
      circle.onpointerup = (v) => end(v);
      circle.onpointercancel = (v) => end(v, true);
    };
  }
  private applyPanelWidth() {
    const available = this.panel.parentElement?.clientWidth ?? 0;
    const desired = this.doc.panelWidth ?? 420;
    const width =
      available > 0
        ? Math.min(desired, Math.max(180, available - 160))
        : desired;
    this.panel.style.width = `${width}px`;
    this.divider.setAttribute("aria-valuenow", String(Math.round(width)));
    this.divider.setAttribute("aria-valuemin", "260");
    this.divider.setAttribute("aria-valuemax", "900");
  }
  private bindPanelResize() {
    const setWidth = (width: number) => {
      const available = this.panel.parentElement?.clientWidth ?? 0;
      const max =
        available > 0 ? Math.max(260, Math.min(900, available - 160)) : 900;
      this.doc.panelWidth = Math.max(260, Math.min(max, width));
      this.applyPanelWidth();
      this.transform();
    };
    this.divider.onpointerdown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const start = e.clientX,
        width =
          this.panel.getBoundingClientRect().width ||
          this.doc.panelWidth ||
          420;
      const previous = this.doc.panelWidth;
      this.divider.setPointerCapture(e.pointerId);
      this.divider.classList.add("is-resizing");
      this.divider.onpointermove = (v) => setWidth(width + start - v.clientX);
      const end = (cancel: boolean) => {
        this.divider.onpointermove = null;
        this.divider.onpointerup = null;
        this.divider.onpointercancel = null;
        this.divider.classList.remove("is-resizing");
        if (cancel) {
          this.doc.panelWidth = previous;
          this.applyPanelWidth();
          this.transform();
        } else this.requestSave();
      };
      this.divider.onpointerup = () => end(false);
      this.divider.onpointercancel = () => end(true);
    };
    this.divider.onkeydown = (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      setWidth(
        (this.doc.panelWidth ?? 420) + (e.key === "ArrowLeft" ? 20 : -20),
      );
      this.requestSave();
    };
    this.divider.ondblclick = () => {
      setWidth(420);
      this.requestSave();
    };
    this.applyPanelWidth();
  }

  private renderNavigator() {
    const el = this.navigatorEl;
    if (!el) return;
    el.empty();
    el.parentElement?.querySelector(".bt-search-resize")?.remove();
    el.hidden = !this.navigatorOpen;
    if (!this.navigatorOpen) return;
    el.createEl("h3", { text: "Узлы дерева" });
    this.button(el, "Закрыть поиск", "x", () => {
      this.navigatorOpen = false;
      this.renderNavigator();
    });
    const input = el.createEl("input", {
      type: "search",
      attr: {
        placeholder: "Название или текст заметки",
        "aria-label": "Поиск по узлам",
      },
    });
    input.value = this.searchQuery;
    searchField(input);
    const resize = el.createDiv({
      cls: "bt-search-resize",
      attr: { role: "separator", "aria-label": "Ширина поиска", tabindex: "0" },
    });
    el.after(resize);
    const width = (v: number) => {
      el.style.width =
        Math.max(180, Math.min(this.contentEl.clientWidth * 0.6 || 600, v)) +
        "px";
    };
    resize.onpointerdown = (e) => {
      e.preventDefault();
      const start = e.clientX,
        initial = el.getBoundingClientRect().width;
      resize.setPointerCapture(e.pointerId);
      resize.onpointermove = (v) => {
        if (v.buttons === 1) width(initial + v.clientX - start);
      };
      resize.onpointerup = () => {
        resize.onpointermove = null;
      };
    };
    resize.onkeydown = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        width(
          el.getBoundingClientRect().width +
            (e.key === "ArrowRight" ? 20 : -20),
        );
      }
    };
    input.oninput = () => {
      this.searchQuery = input.value;
      this.refreshNavigatorResults();
    };
    const filters = el.createDiv({ cls: "bt-search-filters" });
    for (const [key, label, icon] of [
      ["important", "Важные", "star"],
      ["question", "Вопросы", "circle-help"],
      ["completed", "Выполненные", "circle-check"],
      ["task", "Задачи", "square-check"],
      ["pending", "Невыполненные задачи", "square"],
      ["files", "Прикреплённые файлы", "paperclip"],
      ["body", "Встроенные заметки", "notebook-text"],
      ["comments", "Комментарии", "message-square"],
    ]) {
      const button = this.button(filters, label, icon, () => {
        this.searchFilters.has(key)
          ? this.searchFilters.delete(key)
          : this.searchFilters.add(key);
        button.setAttribute(
          "aria-pressed",
          String(this.searchFilters.has(key)),
        );
        this.refreshNavigatorResults();
      });
      button.setAttribute("aria-pressed", String(this.searchFilters.has(key)));
    }
    el.createDiv({ cls: "bt-search-results" });
    this.refreshNavigatorResults();
  }
  private refreshNavigatorResults() {
    const results =
      this.navigatorEl?.querySelector<HTMLElement>(".bt-search-results");
    if (!results) return;
    results.empty();
    const q = this.searchQuery.toLocaleLowerCase(),
      filters = this.searchFilters;
    const found = this.doc.nodes.filter(
      (n) =>
        (n.title + " " + n.body).toLocaleLowerCase().includes(q) &&
        (!filters.size ||
          [...filters].every(
            (f) =>
              (f === "important" && n.important) ||
              (f === "question" && n.title.includes("?")) ||
              (f === "completed" && n.completed) ||
              (f === "task" && n.task) ||
              (f === "pending" && n.task && !n.completed) ||
              (f === "files" && (n.note || n.image || n.tree)) ||
              (f === "body" && n.body.trim()) ||
              (f === "comments" && isComment(this.doc, n.id)),
          )),
    );
    results.createEl("p", { text: "Найдено: " + found.length });
    for (const n of found) {
      const b = results.createEl("button", {
        text: (n.important ? "★ " : "") + (n.completed ? "✓ " : "") + n.title,
      });
      b.className = "bt-search-result tree-item-self";
      b.empty();
      b.style.setProperty("--result-color", colorOf(this.doc, n.id));
      const icon = b.createSpan({ cls: "bt-result-icon" });
      if (n.emoji) icon.setText(n.emoji);
      else if (n.image) {
        const file = this.app.vault.getAbstractFileByPath(n.image);
        if (file instanceof TFile)
          icon.createEl("img", {
            attr: { src: this.app.vault.getResourcePath(file) },
          });
      } else setIcon(icon, n.icon);
      const text = b.createSpan();
      text.createSpan({ text: n.title });
      const badges = b.createSpan({ cls: "bt-result-badges" });
      for (const [show, id, label] of [
        [!!n.body.trim(), "notebook-text", "Встроенная заметка"],
        [n.important, "star", "Важное"],
        [n.title.includes("?"), "circle-help", "Вопрос"],
        [n.completed, "circle-check", "Выполнено"],
        [n.task && !n.completed, "square", "Задача"],
        [!!(n.note || n.tree), "external-link", "Ссылка"],
        [isComment(this.doc, n.id), "message-square", "Комментарий"],
      ] as const) {
        if (show) {
          const badge = badges.createSpan({ attr: { "aria-label": label } });
          setIcon(badge, id);
        }
      }
      b.onclick = () => this.revealNode(n.id);
    }
  }
  private revealNode(id: string) {
    this.focusId = null;
    this.selected = id;
    this.stopCamera();
    this.change(() => {
      this.doc.hideComments = false;
      let n = this.doc.nodes.find((n) => n.id === id);
      while (n?.parent) {
        n = this.doc.nodes.find((p) => p.id === n!.parent);
        if (n) n.collapsed = false;
      }
    });
    this.selected = id;
    this.renderPanel();
    const p = this.positions.get(id);
    if (p) {
      this.doc.camera.x = -p.x * this.doc.camera.zoom;
      this.doc.camera.y = -p.y * this.doc.camera.zoom;
      this.transform();
      this.requestSave();
    }
  }
  private updateMinimapCamera() {
    const r = this.minimap?.querySelector("rect");
    if (!r) return;
    const c = this.doc.camera;
    for (const [k, v] of Object.entries({
      x: (-this.stage.clientWidth / 2 - c.x) / c.zoom,
      y: (-this.stage.clientHeight / 2 - c.y) / c.zoom,
      width: this.stage.clientWidth / c.zoom,
      height: this.stage.clientHeight / c.zoom,
    }))
      r.setAttribute(k, String(v));
  }
  private renderMinimap() {
    const el = this.minimap;
    if (!el || !this.positions.size) return;
    el.hidden = this.plugin.config.showMinimap === false;
    el.empty();
    if (el.hidden) return;
    const ps = [...this.positions.values()],
      minX = Math.min(...ps.map((p) => p.x)) - 80,
      minY = Math.min(...ps.map((p) => p.y)) - 80,
      w = Math.max(...ps.map((p) => p.x)) - minX + 80,
      h = Math.max(...ps.map((p) => p.y)) - minY + 80;
    const ns = "http://www.w3.org/2000/svg",
      svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", minX + " " + minY + " " + w + " " + h);
    svg.setAttribute("preserveAspectRatio", "none");
    const shape = (tag: string, attrs: Record<string, string>) => {
      const e = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      svg.appendChild(e);
      return e;
    };
    for (const n of this.doc.nodes) {
      const p = this.positions.get(n.id),
        a = n.parent ? this.positions.get(n.parent) : null;
      if (p && a)
        shape("line", {
          x1: String(a.x),
          y1: String(a.y),
          x2: String(p.x),
          y2: String(p.y),
          stroke: "var(--text-muted)",
          "stroke-width": String(Math.max(w, h) / 500),
        });
      if (p)
        shape("circle", {
          cx: String(p.x),
          cy: String(p.y),
          r: String(Math.max(w, h) / 100),
          fill: colorOf(this.doc, n.id),
          opacity: isComment(this.doc, n.id) ? "0.3" : "1",
        });
    }
    const c = this.doc.camera;
    shape("rect", {
      x: String((-this.stage.clientWidth / 2 - c.x) / c.zoom),
      y: String((-this.stage.clientHeight / 2 - c.y) / c.zoom),
      width: String(this.stage.clientWidth / c.zoom),
      height: String(this.stage.clientHeight / c.zoom),
      fill: "rgba(70,170,255,.18)",
      stroke: "#46aaff",
      "stroke-width": String(Math.max(w, h) / 80),
    });
    el.appendChild(svg);
    const pan = (e: PointerEvent) => {
      const c = this.doc.camera;
      const r = el.getBoundingClientRect();
      const x = minX + ((e.clientX - r.left) / r.width) * w,
        y = minY + ((e.clientY - r.top) / r.height) * h;
      this.stopCamera();
      c.x = -x * c.zoom;
      c.y = -y * c.zoom;
      this.transform();
    };
    el.onpointerdown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture?.(e.pointerId);
      pan(e);
    };
    el.onpointermove = (e) => {
      if (e.buttons === 1) {
        e.stopPropagation();
        pan(e);
      }
    };
    el.onpointerup = () => this.requestSave();
  }

  private async openAttachment(path: string) {
    try {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (
        file instanceof TFile &&
        !/^(md|pdf|skilltree|canvas|png|jpg|jpeg|gif|svg|webp|avif|mp3|wav|mp4|webm)$/i.test(
          file.extension,
        ) &&
        this.app.vault.adapter instanceof FileSystemAdapter
      ) {
        const error = await require("electron").shell.openPath(
          this.app.vault.adapter.getFullPath(path),
        );
        if (error) throw Error(error);
      } else
        await this.app.workspace.openLinkText(
          path,
          this.file?.path ?? "",
          true,
        );
    } catch (error) {
      new Notice("Не удалось открыть файл: " + String(error));
    }
  }
  private bodyBadge(el: HTMLElement) {
    const badge = el.createSpan({
      cls: "bt-linked bt-has-body",
      attr: { "aria-label": "Есть встроенная заметка" },
    });
    setIcon(badge, "notebook-text");
  }
  private renderPanel() {
    if (!this.panel) return;
    this.noteEditor?.destroy();
    this.noteEditor = undefined;
    const generation = ++this.panelGeneration;
    this.panel.empty();
    this.preview.unload();
    this.preview.load();
    const n = this.doc.nodes.find((n) => n.id === this.selected);
    this.panel.toggleClass("is-open", !!n);
    this.divider.toggleClass("is-open", !!n);
    this.applyPanelWidth();
    if (!n) return;
    const header = this.panel.createDiv({ cls: "bt-panel-header" });
    const titleLabel = header.createSpan({
      cls: "bt-sr-only",
      text: "Название узла",
    });
    titleLabel.id = "bt-panel-title-" + n.id;
    const title = header.createEl("textarea", {
      cls: "bt-panel-title inline-title",
      attr: {
        "aria-labelledby": titleLabel.id,
        maxlength: "200",
        rows: "1",
        spellcheck: "false",
      },
    });
    title.value = n.title;
    const commitTitle = () => {
      const value = title.value.trim();
      if (value && value !== n.title)
        this.change(() => {
          n.title = value;
          n.updatedAt = new Date().toISOString();
        });
      title.value = n.title;
    };
    title.onblur = commitTitle;
    title.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        title.blur();
      }
      if (e.key === "Escape") {
        title.value = n.title;
        title.blur();
      }
    };
    this.button(header, "Закрыть", "x", () => {
      this.selected = null;
      this.renderPanel();
      this.renderGraph();
    });
    const tools = this.panel.createDiv({ cls: "bt-panel-tools" });
    const treeLinks = tools.createDiv({ cls: "bt-tree-links" });
    this.button(treeLinks, "Связать с другим деревом", "workflow", () =>
      new PickFile(this.app, "tree", async (file) => {
        if (file.path === this.file?.path) {
          new Notice("Выберите другое дерево");
          return;
        }
        try {
          const other = parseDoc(await this.app.vault.cachedRead(file));
          const root = other.nodes.find((n) => n.parent === null)!;
          this.change(() => {
            n.tree = file.path;
            n.title = root.title;
            n.icon = root.icon;
          });
          this.renderPanel();
        } catch {
          new Notice("Не удалось прочитать дерево");
        }
      }).open(),
    );
    this.button(treeLinks, "Создать дерево из пункта", "file-plus-2", () => {
      void this.plugin
        .createTree(this.file?.parent?.path, n, this.config)
        .then((file) => {
          if (file) {
            this.change(() => (n.tree = file.path));
            this.renderPanel();
          }
        });
    });
    if (n.tree) {
      this.panel.createDiv({ cls: "bt-linked-path", text: n.tree });
      this.button(
        treeLinks,
        "Открыть связанное дерево",
        "external-link",
        () =>
          void this.app.workspace.openLinkText(
            n.tree!,
            this.file?.path ?? "",
            true,
          ),
      );
      this.button(treeLinks, "Убрать ссылку на дерево", "unlink", () => {
        this.change(() => delete n.tree);
        this.renderPanel();
      });
      this.panel.createEl("p", {
        cls: "bt-panel-hint",
        text: "Клик по узлу открывает дерево. Alt+клик или правая кнопка — настройки этого пункта.",
      });
    }
    const settings = tools.createDiv({ cls: "bt-settings" });
    this.button(settings, "Сосредоточиться на этом узле", "focus", () => {
      this.focusId = n.id;
      this.renderGraph();
      this.renderToolbar();
      this.fit();
    });
    this.button(
      settings,
      n.important ? "Убрать важность" : "Отметить важным",
      "star",
      () => {
        this.change(() => (n.important = !n.important));
        this.renderPanel();
      },
    );
    this.button(
      settings,
      n.task ? "Убрать признак задачи" : "Сделать задачей",
      "square-check",
      () => {
        this.change(() => (n.task = !n.task));
        this.renderPanel();
      },
    );
    for (const [label, active] of [
      [n.important ? "Убрать важность" : "Отметить важным", !!n.important],
      [n.task ? "Убрать признак задачи" : "Сделать задачей", !!n.task],
    ] as const) {
      settings
        .querySelector('[aria-label="' + label + '"]')
        ?.setAttribute("aria-pressed", String(active));
    }
    const dates = this.panel.createDiv({ cls: "bt-node-dates" });
    dates.setText(
      "Создан: " +
        (n.createdAt ? new Date(n.createdAt).toLocaleString() : "неизвестно") +
        " · Изменён: " +
        (n.updatedAt ? new Date(n.updatedAt).toLocaleString() : "неизвестно"),
    );
    if (n.parent !== null) {
      const comment = this.button(
        settings,
        isComment(this.doc, n.id)
          ? "Сделать обычным узлом"
          : "Сделать комментарием",
        "message-square",
        () => {
          this.change(() => {
            n.comment = !isComment(this.doc, n.id);
            if (n.comment) this.doc.hideComments = false;
          });
          this.renderPanel();
        },
        "bt-comment-toggle",
      );
      comment.setAttribute("aria-pressed", String(isComment(this.doc, n.id)));
    }
    this.button(settings, "Иконка узла", "shapes", () =>
      new NodeIconModal(
        this.app,
        n,
        (kind, value) => {
          this.change(() => {
            delete n.image;
            delete n.emoji;
            if (kind === "lucide") n.icon = value;
            else if (kind === "emoji") n.emoji = value;
            else n.image = value;
          });
          this.renderPanel();
        },
        this.plugin.config.emojiFavorites ?? [],
        (values) => {
          this.plugin.config.emojiFavorites = values;
          void this.plugin.saveData(this.plugin.config);
        },
      ).open(),
    );
    const controls = this.panel.createDiv({ cls: "bt-node-controls" });
    const colorMenu = controls.createDiv({ cls: "bt-color-menu" });
    colorMenu.hidden = true;
    const shapeMenu = controls.createDiv({ cls: "bt-shape-menu" });
    shapeMenu.hidden = true;
    const colorButton = this.button(
      settings,
      "Цвет ветки",
      "",
      () => {
        colorMenu.hidden = !colorMenu.hidden;
        shapeMenu.hidden = true;
        colorButton.setAttribute("aria-expanded", String(!colorMenu.hidden));
        shapeButton.setAttribute("aria-expanded", "false");
      },
      "bt-color-button",
    );
    colorButton.style.backgroundColor = colorOf(this.doc, n.id);
    colorButton.setAttribute("aria-expanded", "false");
    const shapeButton = this.button(
      settings,
      "Форма узла",
      "",
      () => {
        shapeMenu.hidden = !shapeMenu.hidden;
        colorMenu.hidden = true;
        shapeButton.setAttribute("aria-expanded", String(!shapeMenu.hidden));
        colorButton.setAttribute("aria-expanded", "false");
      },
      "bt-shape-button",
    );
    shapeButton.appendChild(shapeSVG(n.shape ?? this.config.shape));
    shapeButton.setAttribute("aria-expanded", "false");

    colorMenu.createEl("small", {
      text: "Палитра: " + this.config.palette,
    });
    const swatches = colorMenu.createDiv({ cls: "bt-color-swatches" });
    const picker = colorMenu.createEl("input", {
      type: "color",
      attr: { "aria-label": "Произвольный цвет" },
    });
    picker.value = colorOf(this.doc, n.id);
    const applyColor = (value?: string) => {
      this.snapshot();
      if (value) n.color = value;
      else delete n.color;
      this.requestSave();
      this.renderToolbar();
      for (const el of Array.from(
        this.world.querySelectorAll<HTMLElement>(".bt-node:not(.bt-exiting)"),
      ))
        el.style.setProperty(
          "--branch-color",
          colorOf(this.doc, el.dataset.id!),
        );
      for (const path of Array.from(
        this.world.querySelectorAll<SVGPathElement>(
          ".bt-edges path:not(.bt-exiting)",
        ),
      ))
        path.setAttribute(
          "stroke",
          colorOf(this.doc, path.getAttribute("data-child")!),
        );
      const current = colorOf(this.doc, n.id);
      picker.value = current;
      colorButton.style.backgroundColor = current;
      for (const sw of Array.from(swatches.querySelectorAll("button")))
        sw.setAttribute(
          "aria-pressed",
          String(sw.getAttribute("data-color") === current),
        );
    };
    for (const value of this.config.palettes[this.config.palette]) {
      const sw = swatches.createEl("button", {
        attr: {
          "aria-label": "Цвет " + value,
          "data-color": value,
          "aria-pressed": String(colorOf(this.doc, n.id) === value),
        },
      });
      sw.style.backgroundColor = value;
      sw.onclick = () => applyColor(value);
    }
    picker.onchange = () => applyColor(picker.value);
    if (n.parent) {
      const inherit = colorMenu.createEl("button", {
        text: "Наследовать цвет родителя",
      });
      inherit.onclick = () => applyColor();
    }
    const refreshShapes = () => {
      shapeMenu.empty();
      shapeMenu.createEl("small", { text: "Форма узла" });
      const reset = shapeMenu.createEl("button", {
        text: "Использовать форму из настроек",
      });
      reset.onclick = () => {
        this.change(() => delete n.shape);
        shapeButton.replaceChildren(shapeSVG(this.config.shape));
        refreshShapes();
      };
      shapeChoices(shapeMenu, n.shape ?? this.config.shape, (value) => {
        this.change(() => (n.shape = value));
        shapeButton.replaceChildren(shapeSVG(value));
        refreshShapes();
      });
    };
    refreshShapes();
    const imageActions = settings;
    this.button(
      imageActions,
      n.image ? "Заменить изображение" : "Прикрепить изображение",
      "image",
      () => {
        new NodeIconModal(
          this.app,
          { ...n, emoji: undefined, image: n.image || ".skilltree_files/" },
          (kind, value) => {
            this.change(() => {
              delete n.image;
              delete n.emoji;
              if (kind === "image") n.image = value;
              else if (kind === "emoji") n.emoji = value;
              else n.icon = value;
            });
            this.renderPanel();
          },
          this.plugin.config.emojiFavorites ?? [],
        ).open();
      },
    );
    if (n.image) {
      this.button(imageActions, "Рассмотреть изображение", "maximize", () =>
        this.previewImage(n),
      );
      this.panel.createEl("small", { text: n.image, cls: "bt-linked-path" });
      const reset = this.panel.createEl("button", {
        text: "Убрать изображение",
      });
      reset.onclick = () => {
        this.change(() => delete n.image);
        this.renderPanel();
      };
    }
    this.arrangeButtons(tools, "panel");
    const actions = this.panel.createEl("details", { cls: "bt-note-actions" });
    actions.createEl("summary", {
      text: n.note
        ? "Связанный файл · " + n.note
        : "Связать с файлом хранилища",
    });
    if (n.note) {
      const open = actions.createEl("button", {
        text: "Открыть прикреплённый файл ↗",
      });
      open.onclick = () => void this.openAttachment(n.note!);
      const unlink = actions.createEl("button", {
        text: "Вернуться к встроенной заметке",
      });
      unlink.onclick = () => {
        this.change(() => delete n.note);
        this.renderPanel();
      };
    }
    const link = actions.createEl("button", {
      text: n.note ? "Выбрать другой файл" : "Выбрать файл",
    });
    link.onclick = () =>
      new PickFile(this.app, "note", (f) => {
        this.change(() => (n.note = f.path));
        this.renderPanel();
      }).open();
    const note = this.panel.createDiv({ cls: "bt-note-surface" });
    const noteHeader = note.createDiv({ cls: "bt-note-header" });
    noteHeader.createSpan({
      text: n.note ? "ФАЙЛ ИЗ ХРАНИЛИЩА" : "ЗАМЕТКА",
    });
    if (n.note) {
      const preview = note.createDiv({ cls: "bt-markdown markdown-rendered" });
      const sourcePath = n.note;
      preview.addEventListener("click", (event) => {
        const anchor = (event.target as HTMLElement).closest("a");
        if (!anchor || !preview.contains(anchor)) return;
        const target =
          anchor.getAttribute("data-href") ?? anchor.getAttribute("href");
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        void openNoteLink(
          this.app,
          target,
          sourcePath,
          event.ctrlKey || event.metaKey,
        ).catch((error) => new Notice(String(error)));
      });
      const file = this.app.vault.getAbstractFileByPath(n.note);
      if (file instanceof TFile && file.extension !== "md") {
        const card = preview.createEl("button", {
          cls: "bt-file-card",
          text: `📎 ${file.name} · ${Math.ceil(file.stat.size / 1024)} КБ`,
        });
        card.onclick = () => void this.openAttachment(file.path);
      } else if (file instanceof TFile)
        void this.app.vault
          .cachedRead(file)
          .then((text) => {
            if (generation === this.panelGeneration)
              return MarkdownRenderer.render(
                this.app,
                text,
                preview,
                file.path,
                this.preview,
              );
          })
          .catch(() => {
            if (generation === this.panelGeneration)
              preview.setText("Не удалось прочитать заметку");
          });
      else preview.setText("Файл не найден. Выберите другую заметку.");
    } else {
      const host = note.createDiv({ cls: "bt-live-editor" });
      let session = false;
      this.noteEditor = new NoteEditor(
        host,
        n.body,
        (value) => {
          if (!session) {
            this.snapshot();
            session = true;
          }
          n.body = value;
          this.refreshNavigatorResults();
          n.updatedAt = new Date().toISOString();
          this.requestSave();
          const nodeEl = this.world.querySelector(`[data-id="${n.id}"]`);
          nodeEl?.querySelector(".bt-has-body")?.remove();
          if (n.body.trim() && !n.note && !n.tree && nodeEl)
            this.bodyBadge(nodeEl as HTMLElement);
          this.renderToolbar();
        },
        this.app,
        this.file?.path ?? "",
      );
      host.addEventListener("focusout", () => {
        session = false;
      });
      const mode = this.button(
        noteHeader,
        "Показать исходный текст",
        "code",
        () => {
          this.noteEditor!.toggleSource();
          mode.setAttribute(
            "aria-label",
            this.noteEditor!.source
              ? "Вернуть оформление Markdown"
              : "Показать исходный текст",
          );
          mode.setAttribute("aria-pressed", String(this.noteEditor!.source));
        },
      );
    }
  }
}
