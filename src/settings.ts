import { NodeIconModal } from "./node-icons";
import { renderPresetIcon } from "./preset-icons";
import type { TreeNode } from "./model";
import { parsePalette } from "./palettes";
import { IconPicker } from "./icons";
import {
  App,
  Menu,
  Modal,
  Notice,
  PluginSettingTab,
  Plugin,
  getIconIds,
  FuzzySuggestModal,
  setIcon,
} from "obsidian";
import { Shape, shapes, shapeChoices } from "./shapes";
export { Shape, shapes } from "./shapes";
export interface Config {
  deletedPalettes?: string[];
  deletedIconSets?: string[];
  buttonOrders?: Record<string, string[]>;
  buttonSides?: Record<string, Record<string, "left" | "right">>;
  showMinimap?: boolean;
  emojiFavorites?: string[];
  lucideFavorites?: string[];
  layout: "vertical" | "radial";
  size: number;
  gapX: number;
  gapY: number;
  rootScale: number;
  shape: Shape;
  palette: string;
  palettes: Record<string, string[]>;
  icons: string;
  iconSets: Record<string, string[]>;
}
export const defaults: Config = {
  layout: "vertical",
  size: 80,
  gapX: 64,
  gapY: 88,
  rootScale: 1.2,
  shape: "circle",
  palette: "Яркая",
  palettes: {
    Яркая: [
      "#38bdf8",
      "#fb7185",
      "#4ade80",
      "#c084fc",
      "#fbbf24",
      "#2dd4bf",
      "#f472b6",
      "#a3e635",
      "#818cf8",
      "#fb923c",
      "#22d3ee",
      "#e879f9",
      "#34d399",
      "#f87171",
      "#60a5fa",
      "#facc15",
    ],
    Пастель: [
      "#a5b4fc",
      "#f9a8d4",
      "#99f6e4",
      "#fde68a",
      "#bfdbfe",
      "#d8b4fe",
      "#fecaca",
      "#bbf7d0",
    ],
    Лес: ["#84cc16", "#22c55e", "#10b981", "#14b8a6", "#d9b65d", "#a3be8c"],
    Неон: ["#00e5ff", "#ff4d94", "#be60ff", "#aaff00", "#ffb000", "#00ffb3"],
  },
  icons: "Вопрос",
  iconSets: {
    Техника: [
      "cpu",
      "circuit-board",
      "wrench",
      "cog",
      "plug",
      "zap",
      "radio",
      "satellite",
      "server",
      "hard-drive",
      "battery",
      "microchip",
    ],
    Программирование: [
      "code",
      "terminal",
      "braces",
      "brackets",
      "file-code",
      "git-branch",
      "git-commit-horizontal",
      "bug",
      "database",
      "binary",
      "regex",
      "workflow",
    ],
    Спорт: [
      "dumbbell",
      "bike",
      "trophy",
      "medal",
      "timer",
      "target",
      "goal",
      "person-standing",
      "footprints",
      "heart-pulse",
      "mountain",
      "flag",
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
      "variable",
      "triangle-right",
    ],
    Вопрос: ["circle-help"],
    Шахматы: [
      "chess-king",
      "chess-queen",
      "chess-rook",
      "chess-bishop",
      "chess-knight",
      "chess-pawn",
    ],
    Идеи: [
      "lightbulb",
      "book-open",
      "sparkles",
      "flask-conical",
      "compass",
      "puzzle",
    ],
  },
};

// Sixteen branch colors per built-in palette; user palettes remain untouched.
const legacyPalettes = structuredClone(defaults.palettes);
defaults.palettes["Пастель"].push(
  "#fed7aa",
  "#ddd6fe",
  "#a7f3d0",
  "#bae6fd",
  "#fbcfe8",
  "#d9f99d",
  "#e9d5ff",
  "#fecdd3",
);
defaults.palettes["Лес"].push(
  "#65a30d",
  "#4d7c0f",
  "#34d399",
  "#2dd4bf",
  "#86efac",
  "#bef264",
  "#6ee7b7",
  "#facc15",
  "#c4a35a",
  "#8fbc8f",
);
defaults.palettes["Неон"].push(
  "#ff5f1f",
  "#00bfff",
  "#ff1493",
  "#7fff00",
  "#ffff00",
  "#8a2be2",
  "#00ffff",
  "#ff6347",
  "#7b68ee",
  "#39ff14",
);
defaults.palettes["Catppuccin Mocha"] = [
  "#f5e0dc",
  "#f2cdcd",
  "#f5c2e7",
  "#cba6f7",
  "#f38ba8",
  "#eba0ac",
  "#fab387",
  "#f9e2af",
  "#a6e3a1",
  "#94e2d5",
  "#89dceb",
  "#74c7ec",
  "#89b4fa",
  "#b4befe",
  "#cdd6f4",
  "#bac2de",
];
// Replace only the previously shipped approximation, preserving user edits.
legacyPalettes["Loop Hero"] = [
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
];
// Exact HEX labels from the user's reference, read left-to-right, top-to-bottom.
defaults.palettes["Loop Hero"] = [
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

export function normalizeConfig(raw: any): Config {
  const c = structuredClone(defaults);
  c.buttonOrders = {};
  c.buttonSides = {};
  for (const key of ["toolbar", "panel"]) {
    c.buttonSides[key] = Object.fromEntries(
      Object.entries(raw?.buttonSides?.[key] ?? {}).filter(
        ([_, v]) => v === "left" || v === "right",
      ),
    ) as Record<string, "left" | "right">;
    if (Array.isArray(raw?.buttonOrders?.[key]))
      c.buttonOrders[key] = raw.buttonOrders[key].filter(
        (v: unknown) => typeof v === "string",
      );
  }
  c.showMinimap = raw?.showMinimap !== false;
  c.lucideFavorites = Array.isArray(raw?.lucideFavorites)
    ? raw.lucideFavorites.filter((v: unknown) => typeof v === "string")
    : [];
  c.emojiFavorites = Array.isArray(raw?.emojiFavorites)
    ? raw.emojiFavorites.filter((x: unknown) => typeof x === "string")
    : [];
  if (!raw || typeof raw !== "object") return c;
  for (const [key, min, max] of [
    ["size", 48, 160],
    ["gapX", 0, 240],
    ["gapY", 56, 320],
    ["rootScale", 1, 1.6],
  ] as const)
    if (Number.isFinite(raw[key]))
      c[key] = Math.min(max, Math.max(min, raw[key]));
  if (raw.layout === "radial") c.layout = "radial";
  if (Object.hasOwn(shapes, raw.shape)) c.shape = raw.shape;
  for (const key of ["palettes", "iconSets"] as const)
    if (raw[key] && typeof raw[key] === "object")
      for (const [name, values] of Object.entries(raw[key])) {
        if (
          ["__proto__", "constructor", "prototype"].includes(name) ||
          !Array.isArray(values)
        )
          continue;
        const valid = [
          ...new Set(
            values.filter(
              (v) =>
                typeof v === "string" &&
                (key === "palettes"
                  ? /^#[0-9a-f]{6}$/i.test(v)
                  : /^(?:[a-z0-9-]+|emoji:.+|image:.+)$/.test(v)),
            ),
          ),
        ] as string[];
        if (valid.length) {
          if (
            key === "palettes" &&
            legacyPalettes[name] &&
            JSON.stringify(valid) === JSON.stringify(legacyPalettes[name])
          )
            continue;
          c[key][name] = valid;
        }
      }
  for (const [collection, deleted, active] of [
    ["palettes", "deletedPalettes", "palette"],
    ["iconSets", "deletedIconSets", "icons"],
  ] as const) {
    c[deleted] = Array.isArray(raw[deleted])
      ? raw[deleted].filter((n: unknown) => typeof n === "string")
      : [];
    for (const name of c[deleted] ?? []) delete c[collection][name];
    if (!Object.keys(c[collection]).length) {
      c[collection] = structuredClone(defaults[collection]);
      c[deleted] = [];
    }
    c[active] = Object.hasOwn(c[collection], raw[active])
      ? raw[active]
      : Object.keys(c[collection])[0];
  }
  return c;
}
export interface SettingsHost {
  config: Config;
  scope?: "tree";
  updateConfig(c: Config): Promise<void>;
}
export function chooseIcon(c: Config, available: string[]): string {
  const ids = new Set(available.map((i) => i.replace(/^lucide-/, "")));
  const options = (c.iconSets[c.icons] ?? []).filter(
    (i) => ids.has(i) || i.startsWith("emoji:") || i.startsWith("image:"),
  );
  return options.length
    ? options[Math.floor(Math.random() * options.length)]
    : "circle-help";
}
export function settingsUI(el: HTMLElement, app: App, host: SettingsHost) {
  const opened = new Set(
    Array.from(
      el.querySelectorAll<HTMLDetailsElement>("details[data-section][open]"),
    ).map((e) => e.dataset.section),
  );
  el.empty();
  el.addClass("bt-config");
  el.createEl("h2", {
    text:
      host.scope === "tree"
        ? "Настройки этого дерева"
        : "Настройки новых деревьев",
  });
  el.createEl("p", {
    text:
      host.scope === "tree"
        ? "Сохраняются в этом .skilltree файле. Палитра и набор иконок используются для новых пунктов."
        : "Значения по умолчанию для новых деревьев. Существующие деревья сохраняют собственные настройки.",
    cls: "bt-panel-hint",
  });
  const save = () => {
    void host
      .updateConfig(normalizeConfig(host.config))
      .catch(() => new Notice("Не удалось сохранить настройки"));
  };
  const row = (label: string) => {
    const r = el.createDiv({ cls: "bt-config-row" });
    r.createEl("span", { text: label });
    return r;
  };
  for (const [key, label, min, max, step] of [
    ["size", "Размер пункта, px", 48, 160, 4],
    ["gapX", "Промежуток по горизонтали, px", 0, 240, 1],
    ["gapY", "Промежуток по вертикали, px", 56, 320, 8],
    ["rootScale", "Размер корня относительно остальных", 1, 1.6, 0.05],
  ] as const) {
    const input = row(label).createEl("input", {
      type: "number",
      attr: {
        min: String(min),
        max: String(max),
        step: String(step),
        "aria-label": label,
      },
    });
    input.value = String(host.config[key]);
    input.onchange = () => {
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      host.config[key] = Math.min(max, Math.max(min, value));
      input.value = String(host.config[key]);
      save();
    };
  }
  const sectionFor = (key: string, title: string) => {
    const section = el.createEl("details", {
      cls: "bt-settings-section",
      attr: { "data-section": key },
    });
    section.open = opened.has(key);
    section.createEl("summary", { text: title });
    return section;
  };
  const layoutSelect = row("Сетка по умолчанию").createEl("select");
  for (const [value, label] of [
    ["vertical", "Прямоугольная"],
    ["radial", "Круговая"],
  ])
    layoutSelect.createEl("option", { value, text: label });
  layoutSelect.value = host.config.layout;
  layoutSelect.onchange = () => {
    host.config.layout = layoutSelect.value as Config["layout"];
    save();
  };
  const shapeSection = sectionFor("shape", "Форма по умолчанию");
  shapeChoices(shapeSection, host.config.shape, (value) => {
    host.config.shape = value;
    save();
    settingsUI(el, app, host);
  });
  for (const mode of ["palettes", "iconSets"] as const) {
    const isColor = mode === "palettes",
      active = isColor ? "palette" : "icons";
    const section = sectionFor(
      mode,
      isColor
        ? "Палитры веток · " + host.config.palette
        : "Иконки новых пунктов · " + host.config.icons,
    );
    section.createEl("p", {
      cls: "bt-panel-hint",
      text: isColor
        ? "Нажмите, чтобы выбрать. ПКМ: редактировать, дублировать, удалить. Цвета используются для новых веток."
        : "Новые пункты получают случайную иконку из набора. ПКМ: редактировать, дублировать, удалить.",
    });
    let editExisting: string | undefined;
    const grid = section.createDiv({ cls: "bt-preset-grid" });
    for (const [name, items] of Object.entries(host.config[mode]).sort(
      ([a], [b]) =>
        !isColor ? (a === "Вопрос" ? -1 : b === "Вопрос" ? 1 : 0) : 0,
    )) {
      const card = grid.createEl("button", {
        cls: "bt-preset-card",
        attr: {
          "aria-label": name,
          "aria-pressed": String(host.config[active] === name),
        },
      });
      card.createSpan({ cls: "bt-preset-name", text: name });
      const swatches = card.createSpan({
        cls: isColor ? "bt-card-swatches" : "bt-card-icons",
      });
      for (const value of items.slice(0, 16)) {
        const item = swatches.createSpan();
        if (isColor) item.style.background = value;
        else renderPresetIcon(item, value, app);
      }
      card.oncontextmenu = (e) => {
        e.preventDefault();
        const menu = new Menu();
        const prepare = (duplicate: boolean) => {
          editExisting = duplicate ? undefined : name;
          let candidate = name + " — копия",
            counter = 2;
          while (Object.hasOwn(host.config[mode], candidate))
            candidate = name + " — копия " + counter++;
          nameInput.value = duplicate ? candidate : name;
          selected = [...items];
          draw();
          edit.open = true;
          edit.scrollIntoView?.({ block: "nearest" });
          nameInput.focus();
        };
        menu.addItem((i) =>
          i.setTitle("Редактировать").onClick(() => prepare(false)),
        );
        menu.addItem((i) =>
          i.setTitle("Дублировать").onClick(() => prepare(true)),
        );
        menu.addItem((i) =>
          i.setTitle("Удалить").onClick(() => {
            if (Object.keys(host.config[mode]).length <= 1) {
              new Notice("Оставьте хотя бы один набор.");
              return;
            }
            delete host.config[mode][name];
            const deleted = isColor ? "deletedPalettes" : "deletedIconSets";
            host.config[deleted] = [
              ...new Set([...(host.config[deleted] ?? []), name]),
            ];
            if (host.config[active] === name)
              host.config[active] = Object.keys(host.config[mode])[0];
            save();
            settingsUI(el, app, host);
            new Notice(
              "Набор удалён. Оформление существующих узлов сохранено.",
            );
          }),
        );
        menu.showAtPosition({ x: e.clientX, y: e.clientY });
      };
      card.onclick = () => {
        host.config[active] = name;
        save();
        settingsUI(el, app, host);
      };
    }
    const edit = section.createEl("details", { cls: "bt-preset-editor" });
    edit.createEl("summary", {
      text: isColor
        ? "＋ Создать свою палитру"
        : "＋ Создать свой набор иконок",
    });
    edit.createEl("p", {
      cls: "bt-panel-hint",
      text: isColor
        ? "Дайте палитре имя, добавьте цвета и нажмите «Сохранить и включить»."
        : "Дайте набору имя и добавьте иконки через поиск. Нажатие на выбранную иконку удаляет её из набора.",
    });
    const label = edit.createEl("label", {
      text: isColor ? "Название палитры" : "Название набора иконок",
    });
    const nameInput = label.createEl("input", {
      attr: {
        placeholder: isColor ? "Например, Мой закат" : "Например, Мои шахматы",
        "aria-label": isColor ? "Название палитры" : "Название набора иконок",
      },
    });
    let selected: string[] = isColor
      ? [...host.config.palettes[host.config.palette]]
      : [];
    const choices = edit.createDiv({ cls: "bt-custom-choices" });
    const draw = () => {
      choices.empty();
      selected.forEach((value, index) => {
        if (isColor) {
          const wrap = choices.createDiv({ cls: "bt-color-slot" });
          const input = wrap.createEl("input", {
            type: "color",
            attr: { "aria-label": "Цвет " + (index + 1) },
          });
          input.value = value;
          input.oninput = () => (selected[index] = input.value);
          const remove = wrap.createEl("button", {
            text: "×",
            attr: { "aria-label": "Убрать цвет " + (index + 1) },
          });
          remove.onclick = () => {
            selected.splice(index, 1);
            draw();
          };
        } else {
          const item = choices.createEl("button", {
            attr: { "aria-label": "Убрать " + value },
          });
          renderPresetIcon(item, value, app);
          item.onclick = () => {
            selected.splice(index, 1);
            draw();
          };
        }
      });
    };
    draw();
    const add = edit.createEl("button", {
      text: isColor ? "Добавить цвет" : "Добавить иконку…",
    });
    add.onclick = () => {
      if (isColor) {
        selected.push("#a5b4fc");
        draw();
      } else
        new NodeIconModal(
          app,
          { title: "Набор иконок", icon: "circle-help" } as TreeNode,
          () => {},
          host.config.emojiFavorites ?? [],
          (values) => {
            host.config.emojiFavorites = values;
            save();
          },
          {
            values: selected,
            confirm: (values) => {
              selected = values;
              draw();
            },
          },
        ).open();
    };
    if (isColor) {
      const importMode = edit.createEl("select", {
        attr: { "aria-label": "Источник цветов Aseprite" },
      });
      importMode.createEl("option", {
        text: "Цвета изображения Aseprite",
        value: "pixels",
      });
      importMode.createEl("option", {
        text: "Палитра документа Aseprite",
        value: "palette",
      });
      const upload = edit.createEl("input", {
        type: "file",
        attr: {
          accept: ".aseprite,.ase,.gpl,.hex,.txt,.json,.css",
          "aria-label": "Импорт палитры",
        },
      });
      upload.hidden = true;
      const importButton = edit.createEl("button", {
        text: "Импортировать палитру…",
        cls: "bt-import-palette",
      });
      importButton.onclick = () => upload.click();
      upload.onchange = () => {
        const file = upload.files?.[0];
        if (file)
          void file
            .arrayBuffer()
            .then((buffer) => {
              selected = parsePalette(
                new Uint8Array(buffer),
                file.name,
                importMode.value as "pixels" | "palette",
              );
              if (!nameInput.value)
                nameInput.value = file.name.replace(/\.[^.]+$/, "");
              draw();
            })
            .catch((e) => new Notice(String(e)));
      };
    }
    const saveButton = edit.createEl("button", {
      text: "Сохранить и включить",
      cls: "mod-cta",
    });
    saveButton.onclick = () => {
      const key = nameInput.value.trim();
      if (
        !key ||
        ["__proto__", "constructor", "prototype"].includes(key) ||
        !selected.length
      ) {
        new Notice("Введите название и добавьте хотя бы один элемент");
        return;
      }
      if (key !== editExisting && Object.hasOwn(host.config[mode], key)) {
        new Notice(
          "Такое имя уже есть. Выберите другое или откройте «Редактировать» через ПКМ.",
        );
        return;
      }
      const deleted = isColor ? "deletedPalettes" : "deletedIconSets";
      if (editExisting && editExisting !== key) {
        delete host.config[mode][editExisting];
        host.config[deleted] = [
          ...new Set([...(host.config[deleted] ?? []), editExisting]),
        ];
      }
      host.config[deleted] = (host.config[deleted] ?? []).filter(
        (n) => n !== key,
      );
      host.config[mode][key] = [...new Set(selected)];
      host.config[active] = key;
      save();
      settingsUI(el, app, host);
    };
  }
}

export class ConfigModal extends Modal {
  constructor(
    app: App,
    private host: SettingsHost,
  ) {
    super(app);
  }
  onOpen() {
    this.contentEl.addClass("bt-config-modal");
    settingsUI(this.contentEl, this.app, this.host);
  }
  onClose() {
    this.contentEl.empty();
  }
}
export class ConfigTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin,
    private host: SettingsHost,
  ) {
    super(app, plugin);
  }
  display() {
    this.containerEl.empty();
    // Let Obsidian own the settings page's scroll container and height.
    const content = this.containerEl.createDiv();
    settingsUI(content.createDiv(), this.app, this.host);
    const general = content.createEl("details", { cls: "bt-general-settings" });
    general.createEl("summary", { text: "Общие настройки" });
    const row = general.createDiv({ cls: "setting-item" });
    row.createSpan({ text: "Показывать миникарту" });
    const toggle = row.createEl("input", { type: "checkbox" });
    toggle.checked = this.host.config.showMinimap !== false;
    toggle.onchange = () => {
      this.host.config.showMinimap = toggle.checked;
      void this.host.updateConfig(this.host.config);
    };
  }
}
