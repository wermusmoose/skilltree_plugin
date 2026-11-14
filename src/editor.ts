import {
  EditorState,
  Compartment,
  Range,
  StateField,
  StateEffect,
} from "@codemirror/state";
import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
  keymap,
  placeholder,
  WidgetType,
} from "@codemirror/view";
import { markdown, markdownKeymap } from "@codemirror/lang-markdown";
import {
  syntaxTree,
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";
import { history, historyKeymap, defaultKeymap } from "@codemirror/commands";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { editorTools } from "./editor-tools";
import { GFM } from "@lezer/markdown";
import { App, MarkdownRenderer, Component, Notice } from "obsidian";
import {
  imageExtension,
  mediaPath,
  storeImage,
  hiddenImagePath,
  noteLinks,
  openNoteLink,
} from "./media";
const mediaEffect = StateEffect.define<null>();
const mediaRevision = StateField.define<number>({
  create: () => 0,
  update: (v, tr) => (tr.effects.some((e) => e.is(mediaEffect)) ? v + 1 : v),
});
const focusEffect = StateEffect.define<boolean>();
const focusField = StateField.define<boolean>({
  create: () => false,
  update: (value, tr) => {
    for (const e of tr.effects) if (e.is(focusEffect)) value = e.value;
    return value;
  },
});
class MarkdownWidget extends WidgetType {
  private component?: Component;
  constructor(
    private app: App,
    private source: string,
    private path: string,
    private from: number,
    private revision = 0,
  ) {
    super();
  }
  eq(other: MarkdownWidget) {
    return (
      other.source === this.source &&
      other.path === this.path &&
      other.from === this.from &&
      other.revision === this.revision
    );
  }
  toDOM(view: EditorView) {
    const el = document.createElement("div");
    el.className = "bt-md-widget markdown-rendered";
    this.component = new Component();
    this.component.load();
    const hidden = hiddenImagePath(this.source);
    if (hidden) {
      const image = document.createElement("img");
      image.alt = "Вставленное изображение";
      const url = this.app.vault.adapter.getResourcePath(hidden);
      image.src = url + (url.includes("?") ? "&" : "?") + "bt=" + this.revision;
      el.appendChild(image);
    } else
      void MarkdownRenderer.render(
        this.app,
        this.source,
        el,
        this.path,
        this.component,
      )
        .then(() => {
          if (el.isConnected) view.requestMeasure();
        })
        .catch(() => {
          el.textContent = this.source;
        });
    el.addEventListener(
      "load",
      () => {
        if (el.isConnected) view.requestMeasure();
      },
      true,
    );
    el.onmousedown = (e) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (anchor) {
        e.preventDefault();
        return;
      }
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      view.dispatch({
        selection: { anchor: this.from },
        effects: focusEffect.of(true),
      });
      view.focus();
    };
    el.onclick = (e) => {
      const anchor = (e.target as HTMLElement).closest("a");
      const target =
        anchor?.getAttribute("data-href") ?? anchor?.getAttribute("href");
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        void openNoteLink(
          this.app,
          target,
          this.path,
          e.ctrlKey || e.metaKey,
        ).catch((err) => new Notice(String(err)));
      }
    };
    return el;
  }
  destroy() {
    this.component?.unload();
  }
  ignoreEvent() {
    return true;
  }
}
function blocks(app: App, path: string) {
  const make = (state: EditorState) => {
    const ranges: Range<Decoration>[] = [];
    const sel = state.selection.main;
    const focused = state.field(focusField);
    const activeFrom = state.doc.lineAt(sel.from).from,
      activeTo = state.doc.lineAt(sel.to).to;
    syntaxTree(state).iterate({
      enter(n) {
        if (!["Table", "FencedCode", "Image"].includes(n.name)) return;
        const first = state.doc.lineAt(n.from),
          last = state.doc.lineAt(n.to);
        if (first.from !== n.from || last.to !== n.to) return;
        if (focused && n.from <= activeTo && n.to >= activeFrom) return false;
        ranges.push(
          Decoration.replace({
            widget: new MarkdownWidget(
              app,
              state.doc.sliceString(n.from, n.to),
              path,
              n.from,
              state.field(mediaRevision),
            ),
            block: true,
          }).range(n.from, n.to),
        );
        return false;
      },
    });
    for (let i = 1; i <= state.doc.lines; i++) {
      const line = state.doc.line(i);
      if (
        /^!\[\[.+\]\]$/.test(line.text) &&
        !(focused && line.from <= activeTo && line.to >= activeFrom) &&
        !ranges.some((r) => line.from >= r.from && line.to <= r.to)
      )
        ranges.push(
          Decoration.replace({
            widget: new MarkdownWidget(
              app,
              line.text,
              path,
              line.from,
              state.field(mediaRevision),
            ),
            block: true,
          }).range(line.from, line.to),
        );
    }
    return Decoration.set(ranges, true);
  };
  return StateField.define<DecorationSet>({
    create: make,
    update: (value, tr) =>
      tr.docChanged ||
      tr.selection ||
      tr.effects.some((e) => e.is(focusEffect) || e.is(mediaEffect))
        ? make(tr.state)
        : value,
    provide: (f) => EditorView.decorations.from(f),
  });
}

// Keep Markdown as the canonical document. Decorations never rewrite the source.
function liveDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const selection = view.state.selection.main;
  const activeFrom = view.state.doc.lineAt(selection.from).from,
    activeTo = view.state.doc.lineAt(selection.to).to;
  syntaxTree(view.state).iterate({
    enter(node) {
      const name = node.name;
      const active =
        view.hasFocus && node.from <= activeTo && node.to >= activeFrom;
      if (/^ATXHeading[1-6]$/.test(name))
        ranges.push(
          Decoration.line({ class: "bt-md-h" + name.slice(-1) }).range(
            view.state.doc.lineAt(node.from).from,
          ),
        );
      const cls: Record<string, string> = {
        StrongEmphasis: "bt-md-strong",
        Emphasis: "bt-md-em",
        Strikethrough: "bt-md-strike",
        InlineCode: "bt-md-code",
        Link: "bt-md-link",
        Blockquote: "bt-md-quote",
      };
      if (cls[name])
        ranges.push(
          Decoration.mark({
            class:
              cls[name] +
              " " +
              ({
                StrongEmphasis: "cm-strong",
                Emphasis: "cm-em",
                InlineCode: "cm-inline-code",
              }[name] ?? ""),
            tagName:
              {
                StrongEmphasis: "strong",
                Emphasis: "em",
                Strikethrough: "s",
                InlineCode: "code",
              }[name] ?? "span",
          }).range(node.from, node.to),
        );
      if (
        !active &&
        /^(HeaderMark|EmphasisMark|CodeMark|StrikethroughMark|QuoteMark)$/.test(
          name,
        )
      )
        ranges.push(Decoration.replace({}).range(node.from, node.to));
    },
  });
  for (const link of noteLinks(view.state.doc.toString())) {
    let syntax = syntaxTree(view.state).resolveInner(link.from, 1);
    let code = false;
    for (let n: typeof syntax | null = syntax; n; n = n.parent)
      if (["FencedCode", "CodeBlock", "InlineCode"].includes(n.name))
        code = true;
    if (!code)
      ranges.push(
        Decoration.mark({
          class: "bt-inline-link",
          attributes: {
            "data-bt-target": link.target,
            "aria-label": "Открыть " + link.label,
          },
        }).range(link.from, link.to),
      );
  }
  return Decoration.set(ranges, true);
}
const live = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = liveDecorations(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged || u.focusChanged)
        this.decorations = liveDecorations(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);
export class NoteEditor {
  private disposed = false;
  view: EditorView;
  private mode = new Compartment();
  source = false;
  private liveExtensions: any[];
  constructor(
    parent: HTMLElement,
    text: string,
    onChange: (value: string) => void,
    app: App,
    path: string,
  ) {
    parent.classList.add("markdown-source-view", "mod-cm6", "is-live-preview");
    this.liveExtensions = [blocks(app, path), live];
    this.view = new EditorView({
      parent,
      state: EditorState.create({
        doc: text,
        extensions: [
          markdown({ extensions: [GFM] }),
          focusField,
          mediaRevision,
          history(),
          closeBrackets(),
          keymap.of([
            ...closeBracketsKeymap,
            ...markdownKeymap,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.lineWrapping,
          placeholder("Запишите мысли…"),
          this.mode.of(this.liveExtensions),
          EditorView.domEventHandlers({
            paste: (event, v) => {
              const files = Array.from(event.clipboardData?.files ?? []).filter(
                (f) => !!imageExtension(f.type),
              );
              if (!files.length) return false;
              event.preventDefault();
              const pending = files.map((file) => ({
                file,
                path: mediaPath(file.type),
              }));
              const insert = pending
                .map((p) => `![Изображение](<${p.path}>)`)
                .join("\n");
              v.dispatch(v.state.replaceSelection("\n" + insert + "\n"));
              void Promise.all(
                pending.map((p) => storeImage(app, p.path, p.file)),
              )
                .then(() => {
                  if (!this.disposed)
                    v.dispatch({ effects: mediaEffect.of(null) });
                })
                .catch(
                  (err) =>
                    new Notice(
                      "Не удалось сохранить вставленное изображение. Повторите вставку. " +
                        String(err),
                    ),
                );
              return true;
            },
            mousedown: (event) => {
              if (
                !event.altKey &&
                (event.target as HTMLElement).closest(".bt-inline-link")
              ) {
                event.preventDefault();
                return true;
              }
              return false;
            },
            click: (event) => {
              if (event.altKey) return false;
              const target = (event.target as HTMLElement)
                .closest(".bt-inline-link")
                ?.getAttribute("data-bt-target");
              if (!target) return false;
              event.preventDefault();
              void openNoteLink(
                app,
                target,
                path,
                event.ctrlKey || event.metaKey,
              ).catch((err) => new Notice(String(err)));
              return true;
            },
            focus: (_, v) => {
              v.dispatch({ effects: focusEffect.of(true) });
            },
            blur: (_, v) => {
              v.dispatch({ effects: focusEffect.of(false) });
            },
          }),
          EditorView.contentAttributes.of({
            "aria-label": "Текст мини-заметки",
            class: "markdown-rendered",
          }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChange(u.state.doc.toString());
          }),
          EditorView.theme({
            "&": {
              backgroundColor: "transparent",
              color: "var(--text-normal)",
            },
            "&.cm-focused": { outline: "none" },
            ".cm-content": {
              minHeight: "240px",
              padding: "16px",
              fontFamily: "var(--font-text)",
            },
            ".cm-scroller": {
              fontFamily: "var(--font-text)",
              lineHeight: "1.65",
            },
            ".cm-cursor": { borderLeftColor: "var(--text-normal)" },
            ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
              backgroundColor: "var(--text-selection)",
            },
          }),
        ],
      }),
    });
    editorTools(parent, this.view, app);
  }
  toggleSource() {
    this.source = !this.source;
    this.view.dispatch({
      effects: this.mode.reconfigure(
        this.source
          ? syntaxHighlighting(defaultHighlightStyle)
          : this.liveExtensions,
      ),
    });
    this.view.dom.classList.toggle("bt-source-mode", this.source);
  }
  destroy() {
    this.disposed = true;
    this.view.destroy();
  }
}
