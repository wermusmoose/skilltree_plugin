import { emojiCatalog } from "./emoji-catalog";
import { searchField } from "./search-field";
import { emojiNames, matchesEmoji, pastedEmoji } from "./emoji-search";
import { App, Modal, TFile, setIcon } from "obsidian";
import { IconPicker } from "./icons";
import type { TreeNode } from "./model";
const labels = new Map(emojiCatalog.map((row) => [row[0], row[2]]));
const baseEmoji = (e: string) => e.replace(/\p{Emoji_Modifier}/gu, "");
const variants = new Map<string, string[]>();
for (const [emoji] of emojiCatalog) {
  const key = baseEmoji(emoji);
  if (!variants.has(key)) variants.set(key, []);
  if (!variants.get(key)!.includes(emoji)) variants.get(key)!.push(emoji);
}
const basic = emojiCatalog.filter(([emoji]) => baseEmoji(emoji) === emoji);
export class NodeIconModal extends Modal {
  constructor(
    app: App,
    private node: TreeNode,
    private chosen: (kind: string, value: string) => void,
    private favorites: string[] = [],
    private saveFavorites: (values: string[]) => void = () => {},
    private multi?: { values: string[]; confirm: (values: string[]) => void },
  ) {
    super(app);
  }
  onOpen() {
    this.contentEl.addClass("bt-icon-picker");
    this.contentEl.createEl("h2", { text: "Иконка: " + this.node.title });
    const selected = new Set(this.multi?.values ?? []);
    if (this.multi)
      this.contentEl.createEl("button", {
        text: "Подтвердить выбор",
        cls: "mod-cta",
      }).onclick = () => {
        this.multi!.confirm([...selected]);
        this.close();
      };
    const tabs = this.contentEl.createDiv({ cls: "bt-icon-tabs" });
    const body = this.contentEl.createDiv();
    const choose = (k: string, v: string) => {
      if (this.multi) {
        const key = k === "lucide" ? v : k + ":" + v;
        selected.has(key) ? selected.delete(key) : selected.add(key);
        body
          .querySelectorAll<HTMLButtonElement>("button[data-choice]")
          .forEach((b) =>
            b.setAttribute(
              "aria-pressed",
              String(selected.has(b.dataset.choice!)),
            ),
          );
      } else {
        this.chosen(k, v);
        this.close();
      }
    };
    let activeKind = "";
    let hiddenImages: string[] = [];
    const render = (kind: string) => {
      activeKind = kind;
      body.empty();
      tabs
        .querySelectorAll("button")
        .forEach((b) =>
          b.setAttribute("aria-pressed", String(b.textContent === kind)),
        );
      if (kind === "Lucide") {
        const picker = new IconPicker(
          this.app,
          (id) => choose("lucide", id),
          this.node.icon,
          "",
          this.multi
            ? [...selected].filter((x) => !x.includes(":"))
            : undefined,
          this.multi ? () => {} : undefined,
          this.multi
            ? (values) => {
                for (const v of [...selected])
                  if (!v.includes(":")) selected.delete(v);
                for (const v of values) selected.add(v);
              }
            : undefined,
        );
        picker.onOpen();
        if (this.multi) picker.contentEl.querySelector(".mod-cta")?.remove();
        body.appendChild(picker.contentEl);
        return;
      }
      const search = body.createEl("input", {
        type: "search",
        attr: { placeholder: "Название RU / EN, категория или эмоджи" },
      });
      searchField(search);
      const navigation = body.createDiv({ cls: "bt-emoji-navigation" });
      const list = body.createDiv({ cls: "bt-icon-categories" });

      const draw = () => {
        list.empty();
        navigation.empty();
        const q = search.value.trim().toLocaleLowerCase();
        if (kind === "Эмоджи") {
          const pasted = pastedEmoji(search.value);
          if (pasted) {
            list.createEl("h4", { text: "Использовать вставленный эмоджи" });
            const button = list
              .createDiv({ cls: "bt-icon-grid bt-emoji-grid" })
              .createEl("button", {
                text: pasted,
                attr: { "aria-label": "Выбрать " + pasted },
              });
            button.onclick = () => choose("emoji", pasted);
            button.oncontextmenu = (e) => {
              e.preventDefault();
              this.favorites = this.favorites.includes(pasted)
                ? this.favorites.filter((x) => x !== pasted)
                : [...this.favorites, pasted];
              this.saveFavorites([...this.favorites]);
              draw();
            };
          }
          let count = 0;
          const allEntries = basic.filter(
            ([emoji, category, names]) =>
              !q || matchesEmoji(emoji, category + " " + names, q),
          );
          const entries = allEntries;
          const sections = new Map<string, string[]>();
          const pinned = this.favorites.filter(
            (e) =>
              !q || allEntries.some((row) => row[0] === e) || e.includes(q),
          );
          if (pinned.length) sections.set("★ Избранное", pinned);
          for (const [emoji, category] of entries) {
            if (!sections.has(category)) sections.set(category, []);
            sections.get(category)!.push(emoji);
          }
          const rows: { name?: string; emojis?: string[] }[] = [];
          for (const [name, emojis] of sections) {
            count += emojis.length;
            rows.push({ name });
            for (let i = 0; i < emojis.length; i += 10)
              rows.push({ emojis: emojis.slice(i, i + 10) });
          }
          const canvas = list.createDiv({ cls: "bt-emoji-canvas" });
          canvas.style.height = rows.length * 44 + "px";
          const windowEl = canvas.createDiv({ cls: "bt-emoji-window" });
          const renderRows = () => {
            const first = Math.max(0, Math.floor(list.scrollTop / 44) - 2),
              last = Math.min(
                rows.length,
                first + Math.ceil((list.clientHeight || 440) / 44) + 4,
              );
            windowEl.empty();
            windowEl.style.top = first * 44 + "px";
            for (const row of rows.slice(first, last)) {
              const line = windowEl.createDiv({ cls: "bt-emoji-row" });
              if (row.name) {
                line.createEl("h4", { text: row.name });
                continue;
              }
              const emojis = row.emojis!;
              const grid = line.createDiv({
                cls: "bt-icon-grid bt-emoji-grid",
              });
              for (const emoji of emojis) {
                const label = emoji;
                const wrap = grid.createDiv({ cls: "bt-emoji-choice" });
                const button = wrap.createEl("button", {
                  text: emoji,
                  attr: {
                    "aria-label": label,
                    "aria-pressed": String(this.favorites.includes(emoji)),
                  },
                });
                button.onclick = () => choose("emoji", emoji);
                const tones = variants.get(baseEmoji(emoji)) ?? [];
                if (tones.length > 1) {
                  button.classList.add("has-tones");
                  wrap.onpointerenter = () => {
                    if (wrap.querySelector(".bt-tones")) return;
                    const popup = wrap.createDiv({ cls: "bt-tones" });
                    for (const tone of tones) {
                      const item = popup.createEl("button", {
                        text: tone,
                        attr: { "aria-label": tone },
                      });
                      item.onclick = (e) => {
                        e.stopPropagation();
                        choose("emoji", tone);
                      };
                      item.oncontextmenu = (e) => {
                        e.preventDefault();
                        this.favorites = this.favorites.includes(tone)
                          ? this.favorites.filter((x) => x !== tone)
                          : [...this.favorites, tone];
                        this.saveFavorites([...this.favorites]);
                        draw();
                      };
                    }
                  };
                  wrap.onpointerleave = () =>
                    wrap.querySelector(".bt-tones")?.remove();
                }

                button.dataset.choice = "emoji:" + emoji;
                if (this.multi)
                  button.setAttribute(
                    "aria-pressed",
                    String(selected.has("emoji:" + emoji)),
                  );
                button.oncontextmenu = (e) => {
                  e.preventDefault();
                  this.favorites = this.favorites.includes(emoji)
                    ? this.favorites.filter((x) => x !== emoji)
                    : [...this.favorites, emoji];
                  this.saveFavorites([...this.favorites]);
                  draw();
                };
              }
            }
          };
          let queued = false;
          list.onscroll = () => {
            if (!queued) {
              queued = true;
              requestAnimationFrame(() => {
                queued = false;
                if (canvas.isConnected) renderRows();
              });
            }
          };
          renderRows();
          const categoryIcons: Record<string, string> = {
            "★ Избранное": "star",
            "смайлики и эмоции": "smile",
            "люди и тело": "person-standing",
            компонент: "palette",
            "животные и природа": "cat",
            "еда и напитки": "apple",
            "путешествия и местности": "car",
            занятия: "trophy",
            предметы: "lightbulb",
            символы: "hash",
            флаги: "flag",
          };
          rows.forEach((row, i) => {
            if (!row.name) return;
            const b = navigation.createEl("button", {
              attr: { "aria-label": row.name },
            });
            setIcon(b, categoryIcons[row.name] ?? "circle");
            b.onclick = () => {
              list.scrollTop = i * 44;
              renderRows();
            };
          });
          if (!count && !pasted)
            list.createEl("p", {
              text: "Ничего не найдено. Можно вставить эмоджи в поле поиска.",
            });
        } else {
          const grid = list.createDiv({ cls: "bt-icon-grid" });
          const paths = [
            ...new Set([
              ...this.app.vault.getFiles().map((f) => f.path),
              ...hiddenImages,
            ]),
          ];
          for (const path of paths.filter(
            (path) =>
              /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(path) &&
              path.toLocaleLowerCase().includes(q),
          )) {
            const f = this.app.vault.getAbstractFileByPath(path);
            const b = grid.createEl("button", {
              attr: { "aria-label": path },
            });
            b.createEl("img", {
              attr: {
                src:
                  f instanceof TFile
                    ? this.app.vault.getResourcePath(f)
                    : this.app.vault.adapter.getResourcePath(path),
              },
            });
            b.dataset.choice = "image:" + path;
            if (this.multi)
              b.setAttribute(
                "aria-pressed",
                String(selected.has("image:" + path)),
              );
            b.onclick = () => choose("image", path);
          }
        }
      };
      search.oninput = () => {
        list.scrollTop = 0;
        draw();
      };
      draw();
    };
    const adapter = this.app.vault.adapter;
    if (adapter?.list)
      void adapter
        .list(".skilltree_files")
        .then((result) => {
          hiddenImages = result.files;
          if (activeKind === "Изображения") render(activeKind);
        })
        .catch(() => {});
    for (const name of ["Lucide", "Эмоджи", "Изображения"])
      tabs.createEl("button", { text: name }).onclick = () => render(name);
    render(
      this.node.emoji ? "Эмоджи" : this.node.image ? "Изображения" : "Lucide",
    );
  }
}
