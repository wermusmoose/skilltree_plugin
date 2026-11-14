import { searchField } from "./search-field";
import { App, Modal, getIconIds, setIcon } from "obsidian";
export const iconCategories: Record<string, string[]> = {
  Знаки: [
    "circle-help",
    "triangle-alert",
    "circle-check",
    "circle-x",
    "sparkles",
    "star",
    "flag",
    "recycle",
    "shield",
    "award",
  ],
  "Здоровье и энергия": [
    "heart",
    "activity",
    "eye",
    "compass",
    "sun",
    "leaf",
    "cup-soda",
    "zap",
    "sparkles",
    "flame",
  ],
  "Спорт и активность": [
    "dumbbell",
    "bike",
    "trophy",
    "trending-up",
    "zap",
    "target",
    "medal",
    "flame",
    "timer",
    "flag",
  ],
  "Обучение и интеллект": [
    "book-open",
    "book",
    "file-text",
    "compass",
    "search",
    "graduation-cap",
    "lightbulb",
    "send",
    "star",
    "award",
  ],
  "Бизнес и карьера": [
    "briefcase",
    "building",
    "trending-up",
    "chart-no-axes-column",
    "clipboard",
    "layers",
    "users",
    "user",
    "wrench",
    "target",
  ],
  "Деньги и активы": [
    "dollar-sign",
    "credit-card",
    "chart-pie",
    "database",
    "gem",
    "award",
    "trending-up",
    "file-text",
    "package",
    "zap",
  ],
  "Люди и общение": [
    "users",
    "user",
    "heart",
    "message-circle",
    "phone",
    "mail",
    "globe",
    "baby",
    "award",
    "flag",
  ],
  Коммуникации: [
    "message-circle",
    "mail",
    "phone",
    "bell",
    "share-2",
    "link",
    "mic",
    "video",
    "globe",
    "users",
  ],
  "Транспорт и поездки": [
    "car",
    "plane",
    "send",
    "map",
    "compass",
    "globe",
    "flag",
    "package",
    "clock",
    "map-pin",
  ],
  "Дом и быт": [
    "house",
    "heart",
    "sun",
    "coffee",
    "wrench",
    "settings",
    "lock",
    "shopping-bag",
    "calendar",
    "clock",
  ],
  Технологии: [
    "monitor",
    "smartphone",
    "code",
    "wifi",
    "camera",
    "video",
    "watch",
    "cloud",
    "lock",
    "database",
  ],
  Программирование: [
    "terminal",
    "braces",
    "brackets",
    "file-code",
    "git-branch",
    "bug",
    "binary",
    "regex",
    "workflow",
    "database",
  ],
  Математика: [
    "sigma",
    "pi",
    "radical",
    "infinity",
    "percent",
    "divide",
    "plus",
    "minus",
    "equal",
    "calculator",
  ],
  Шахматы: [
    "chess-king",
    "chess-queen",
    "chess-rook",
    "chess-bishop",
    "chess-knight",
    "chess-pawn",
  ],
  "Творчество и стиль жизни": [
    "palette",
    "film",
    "music",
    "mic",
    "camera",
    "sparkles",
    "sprout",
    "play",
    "coffee",
    "star",
  ],
  "Канцелярия и инструменты": [
    "pencil",
    "pen-tool",
    "file-text",
    "paperclip",
    "map-pin",
    "clipboard",
    "archive",
    "layers",
    "layout-grid",
    "wrench",
  ],
};
iconCategories["Знаки"].push(
  ...[
    "badge-check",
    "badge-alert",
    "circle-alert",
    "ban",
    "info",
    "octagon-alert",
    "check",
    "x",
    "asterisk",
    "hash",
  ],
);
iconCategories["Здоровье и энергия"].push(
  ...[
    "heart-pulse",
    "stethoscope",
    "pill",
    "syringe",
    "thermometer",
    "hospital",
    "brain",
    "moon",
    "droplets",
    "bed",
  ],
);
iconCategories["Спорт и активность"].push(
  ...[
    "footprints",
    "person-standing",
    "mountain",
    "swords",
    "goal",
    "gauge",
    "watch",
    "route",
    "tent",
    "waves",
  ],
);
iconCategories["Обучение и интеллект"].push(
  ...[
    "notebook-text",
    "library",
    "school",
    "brain",
    "languages",
    "pencil",
    "presentation",
    "microscope",
    "flask-conical",
    "atom",
  ],
);
iconCategories["Бизнес и карьера"].push(
  ...[
    "briefcase-business",
    "building-2",
    "handshake",
    "presentation",
    "calendar-check",
    "contact",
    "network",
    "chart-line",
    "chart-bar",
    "megaphone",
  ],
);
iconCategories["Деньги и активы"].push(
  ...[
    "wallet",
    "banknote",
    "coins",
    "landmark",
    "receipt",
    "piggy-bank",
    "bitcoin",
    "percent",
    "shopping-cart",
    "badge-dollar-sign",
  ],
);
iconCategories["Люди и общение"].push(
  ...[
    "contact",
    "user-plus",
    "user-check",
    "user-round",
    "users-round",
    "smile",
    "laugh",
    "hand",
    "handshake",
    "accessibility",
  ],
);
iconCategories["Коммуникации"].push(
  ...[
    "message-square",
    "messages-square",
    "mail-open",
    "inbox",
    "send",
    "at-sign",
    "radio",
    "podcast",
    "headphones",
    "megaphone",
  ],
);
iconCategories["Транспорт и поездки"].push(
  ...[
    "bus",
    "train-front",
    "tram-front",
    "ship",
    "sailboat",
    "bike",
    "rocket",
    "luggage",
    "ticket",
    "navigation",
  ],
);
iconCategories["Дом и быт"].push(
  ...[
    "bed",
    "bath",
    "sofa",
    "lamp",
    "armchair",
    "refrigerator",
    "washing-machine",
    "utensils",
    "key",
    "door-open",
  ],
);
iconCategories["Технологии"].push(
  ...[
    "cpu",
    "circuit-board",
    "server",
    "hard-drive",
    "usb",
    "plug",
    "battery",
    "bluetooth",
    "router",
    "printer",
  ],
);
iconCategories["Программирование"].push(
  ...[
    "code-xml",
    "git-commit-horizontal",
    "git-merge",
    "git-pull-request",
    "git-fork",
    "github",
    "folder-code",
    "file-json",
    "container",
    "webhook",
  ],
);
iconCategories["Математика"].push(
  ...[
    "square-root",
    "function-square",
    "variable",
    "superscript",
    "subscript",
    "parentheses",
    "ruler",
    "triangle",
    "diameter",
    "omega",
  ],
);
iconCategories["Творчество и стиль жизни"].push(
  ...[
    "brush",
    "paintbrush",
    "drama",
    "clapperboard",
    "guitar",
    "piano",
    "headphones",
    "scissors",
    "rainbow",
    "wand-sparkles",
  ],
);
iconCategories["Канцелярия и инструменты"].push(
  ...[
    "eraser",
    "ruler",
    "scissors",
    "notebook",
    "notepad-text",
    "sticky-note",
    "stamp",
    "highlighter",
    "hammer",
    "paintbrush",
  ],
);
let readFavorites: () => string[] = () => [];
let writeFavorites: (values: string[]) => Promise<void> = async () => {};
export function configureIconFavorites(
  read: () => string[],
  write: (values: string[]) => Promise<void>,
) {
  readFavorites = read;
  writeFavorites = write;
}
export class IconPicker extends Modal {
  constructor(
    app: App,
    private chosen: (id: string) => void,
    private current = "circle-help",
    private title = "Выбор иконки",
    private initial?: string[],
    private confirm?: (ids: string[]) => void,
    private selectionChanged?: (ids: string[]) => void,
  ) {
    super(app);
  }
  onOpen() {
    this.contentEl.addClass("bt-icon-picker");
    this.contentEl.createEl("h2", { text: this.title });
    const selected = new Set(this.initial ?? []);
    const choose = (id: string) => {
      if (this.confirm) {
        selected.has(id) ? selected.delete(id) : selected.add(id);
        this.selectionChanged?.([...selected]);
        this.contentEl.querySelectorAll("button[aria-label]").forEach((el) => {
          if (el.getAttribute("aria-label") === id)
            el.setAttribute("aria-pressed", String(selected.has(id)));
        });
      } else {
        this.chosen(id);
        this.close();
      }
    };
    if (this.confirm)
      this.contentEl.createEl("button", {
        text: "Подтвердить выбор",
        cls: "mod-cta",
      }).onclick = () => {
        this.confirm!([...selected]);
        this.close();
      };
    const search = this.contentEl.createEl("input", {
      type: "search",
      attr: {
        placeholder: "Поиск Lucide или категории…",
        "aria-label": "Поиск иконки",
      },
    });
    searchField(search);
    const list = this.contentEl.createDiv({ cls: "bt-icon-categories" });
    const available = [
      ...new Set(getIconIds().map((i) => i.replace(/^lucide-/, ""))),
    ];
    const ids = new Set(available);
    const favorite = (e: MouseEvent, id: string) => {
      e.preventDefault();
      const values = readFavorites();
      void writeFavorites(
        values.includes(id) ? values.filter((v) => v !== id) : [...values, id],
      ).then(() => render());
    };
    const section = (name: string, icons: string[]) => {
      if (!icons.length) return;
      list.createEl("h4", { text: name });
      const grid = list.createDiv({ cls: "bt-icon-grid" });
      for (const id of icons) {
        const button = grid.createEl("button", {
          attr: {
            "aria-label": id,
            "aria-pressed": String(
              this.confirm ? selected.has(id) : id === this.current,
            ),
          },
        });
        setIcon(button, id);
        button.oncontextmenu = (e) => favorite(e, id);
        button.classList.toggle(
          "bt-icon-favorite",
          readFavorites().includes(id),
        );
        button.onclick = () => {
          choose(id);
        };
      }
    };
    const render = () => {
      list.empty();
      const q = search.value.trim().toLocaleLowerCase();
      section(
        "★ Избранное",
        readFavorites().filter((id) => ids.has(id) && (!q || id.includes(q))),
      );
      for (const [name, icons] of Object.entries(iconCategories)) {
        section(
          name,
          icons.filter(
            (id) =>
              ids.has(id) &&
              (!q || name.toLocaleLowerCase().includes(q) || id.includes(q)),
          ),
        );
      }
      if (q)
        section(
          "Все совпадения Lucide",
          available.filter((id) => id.includes(q)),
        );
      else {
        const all = list.createEl("details");
        all.createEl("summary", { text: "Все иконки Lucide" });
        const grid = all.createDiv({ cls: "bt-icon-grid" });
        let loaded = false;
        all.ontoggle = () => {
          if (!all.open || loaded) return;
          loaded = true;
          for (const id of available) {
            const b = grid.createEl("button", {
              attr: {
                "aria-label": id,
                "aria-pressed": String(
                  this.confirm ? selected.has(id) : id === this.current,
                ),
              },
            });
            setIcon(b, id);
            b.oncontextmenu = (e) => favorite(e, id);
            b.onclick = () => {
              choose(id);
            };
          }
        };
      }
    };
    search.oninput = render;
    render();
    search.focus();
  }
  onClose() {
    this.contentEl.empty();
  }
}
