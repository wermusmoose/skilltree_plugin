import { App, Component, MarkdownRenderer, TFile, Notice } from "obsidian";
import { openNoteLink } from "./media";
import type { TreeNode } from "./model";

export class NoteHover {
  private timer?: ReturnType<typeof setTimeout>;
  private leaving?: ReturnType<typeof setTimeout>;
  private card?: HTMLElement;
  private component?: Component;
  private generation = 0;
  constructor(
    private app: App,
    private host: HTMLElement,
  ) {}
  hide() {
    clearTimeout(this.timer);
    clearTimeout(this.leaving);
    this.generation++;
    this.card?.remove();
    this.card = undefined;
    this.component?.unload();
    this.component = undefined;
  }
  leave() {
    clearTimeout(this.timer);
    this.leaving = setTimeout(() => this.hide(), 220);
  }
  show(anchor: HTMLElement, node: TreeNode, source: string) {
    this.hide();
    const generation = this.generation;
    this.timer = setTimeout(() => {
      void this.render(anchor, node, source, generation);
    }, 500);
  }
  private async render(
    anchor: HTMLElement,
    node: TreeNode,
    source: string,
    generation: number,
  ) {
    try {
      let text = node.body;
      if (node.note) {
        const file = this.app.vault.getAbstractFileByPath(node.note);
        if (!(file instanceof TFile)) return;
        if (file.extension !== "md") return;
        text = await this.app.vault.cachedRead(file);
        source = file.path;
      }
      if (generation !== this.generation || !anchor.isConnected || !text.trim())
        return;
      const card = this.host.ownerDocument.createElement("div");
      card.className = "bt-note-hover";
      card.setAttribute("role", "region");
      card.setAttribute("aria-label", "Предпросмотр заметки: " + node.title);
      const content = card.createDiv({
        cls: "bt-note-hover-content markdown-rendered",
      });
      const component = new Component();
      component.load();
      this.component = component;
      this.card = card;
      card.onpointerenter = () => clearTimeout(this.leaving);
      card.onpointerleave = () => this.leave();
      card.onkeydown = (e) => {
        if (e.key === "Escape") this.hide();
      };
      card.tabIndex = 0;
      card.onclick = (e) => {
        const a = (e.target as HTMLElement).closest("a");
        const target = a?.getAttribute("data-href") ?? a?.getAttribute("href");
        if (target) {
          e.preventDefault();
          e.stopPropagation();
          void openNoteLink(
            this.app,
            target,
            source,
            e.ctrlKey || e.metaKey,
          ).catch((err) => new Notice(String(err)));
        }
      };
      const limit = 12000;
      let excerpt = text.slice(0, limit);
      excerpt = excerpt.replace(
        /!\[([^\]]*)\]\(<?(\.skilltree_files\/[\w-]+\.(?:png|jpg|webp|gif|avif|bmp))>?\)/g,
        (_all, alt, path) =>
          `![${alt}](<${this.app.vault.adapter.getResourcePath(path)}>)`,
      );
      await MarkdownRenderer.render(
        this.app,
        excerpt,
        content,
        source,
        component,
      );
      if (generation !== this.generation) {
        component.unload();
        return;
      }
      if (text.length > limit)
        card.createDiv({
          cls: "bt-panel-hint",
          text: "Показано начало. Нажмите на пункт, чтобы открыть заметку целиком.",
        });
      this.host.ownerDocument.body.appendChild(card);
      const rect = anchor.getBoundingClientRect(),
        win = this.host.ownerDocument.defaultView!;
      const width = card.getBoundingClientRect().width,
        height = card.getBoundingClientRect().height;
      card.style.left =
        Math.max(
          8,
          Math.min(
            rect.left + rect.width / 2 - width / 2,
            win.innerWidth - width - 8,
          ),
        ) + "px";
      const above = rect.top - height - 10;
      card.style.top =
        Math.max(
          8,
          Math.min(
            above >= 8 ? above : rect.bottom + 10,
            win.innerHeight - height - 8,
          ),
        ) + "px";
    } catch {
      if (generation === this.generation) this.hide();
    }
  }
}
