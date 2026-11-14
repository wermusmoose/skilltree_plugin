import { App, Notice, Modal, setIcon } from "obsidian";
import { EditorView } from "@codemirror/view";
export function editorTools(host: HTMLElement, view: EditorView, app: App) {
  const launch = host
    .parentElement!.querySelector(".bt-note-header")!
    .createEl("button", { attr: { "aria-label": "Расширенная вставка" } });
  setIcon(launch, "circle-plus");
  const tools = host.parentElement!.createDiv({ cls: "bt-editor-tools" });
  host.before(tools);
  tools.hidden = true;
  launch.onclick = () => {
    tools.hidden = !tools.hidden;
    launch.setAttribute("aria-expanded", String(!tools.hidden));
  };
  const tabs = tools.createDiv({ cls: "bt-insert-tabs" });
  const links = tools.createDiv({ cls: "bt-insert-links" });
  const label = links.createEl("input", {
      attr: { placeholder: "Текст ссылки", "aria-label": "Текст ссылки" },
    }),
    target = links.createEl("input", {
      attr: {
        placeholder: "URL или путь в хранилище",
        "aria-label": "Адрес ссылки",
      },
    });
  const nameLabel = links.createEl("label", { text: "Название" });
  label.before(nameLabel);
  nameLabel.appendChild(label);
  const addressLabel = links.createEl("label", { text: "Адрес или заметка" });
  target.before(addressLabel);
  addressLabel.appendChild(target);
  const id = "bt-links-" + crypto.randomUUID();
  target.setAttribute("list", id);
  const suggestions = links.createEl("datalist", { attr: { id } });
  for (const file of app.vault.getFiles())
    suggestions.createEl("option", { value: file.path });
  const insert = (text: string) => {
    view.dispatch(view.state.replaceSelection(text));
    view.focus();
  };
  links.createEl("button", { text: "Вставить ссылку" }).onclick = () => {
    const path = target.value.trim();
    if (!path) return;
    const text =
      label.value.trim() ||
      view.state.sliceDoc(
        view.state.selection.main.from,
        view.state.selection.main.to,
      ) ||
      path;
    insert(
      /^[a-z]+:/i.test(path)
        ? `[${text.replaceAll("]", "\\]")}](<${path.replaceAll(">", "%3E")}>)`
        : `[[${path.replaceAll("]", "")}|${text.replaceAll("]", "")}]]`,
    );
  };
  const tables = tools.createDiv({ cls: "bt-insert-tables" });
  for (const [name, pane] of [
    ["Таблица", tables],
    ["Ссылка", links],
  ] as const) {
    const b = tabs.createEl("button", { text: name });
    b.onclick = () => {
      tables.hidden = pane !== tables;
      links.hidden = pane !== links;
      tabs
        .querySelectorAll("button")
        .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    };
  }
  links.hidden = true;

  let cells = [
      ["Заголовок 1", "Заголовок 2"],
      ["", ""],
    ],
    replace: { from: number; to: number } | null = null,
    loadedDocument = "";
  let activeRow = 1,
    activeColumn = 0;
  const alignment: string[] = [];
  const grid = tables.createDiv({ cls: "bt-table-tools" });
  const draw = () => {
    grid.empty();
    const table = grid.createEl("table");
    cells.forEach((row, i) => {
      const tr = table.createEl("tr");
      row.forEach((value, j) => {
        const input = tr.createEl("td").createEl("input", {
          attr: { "aria-label": `Ячейка ${i + 1}:${j + 1}` },
        });
        input.value = value;
        input.onfocus = () => {
          activeRow = i;
          activeColumn = j;
        };
        input.oninput = () => (cells[i][j] = input.value);
      });
    });
  };
  draw();
  const toolbar = tables.createDiv({ cls: "bt-table-toolbar" });
  tables.prepend(toolbar);
  const tool = (label: string, icon: string, run: () => void) => {
    const b = toolbar.createEl("button", { attr: { "aria-label": label } });
    setIcon(b, icon);
    b.onclick = run;
  };
  for (const [label, icon, value] of [
    ["Слева", "align-left", ":---"],
    ["По центру", "align-center", ":---:"],
    ["Справа", "align-right", "---:"],
  ])
    tool(label, icon, () => {
      alignment[activeColumn] = value;
    });
  tool("Строку вверх", "arrow-up", () => {
    if (activeRow > 1) {
      [cells[activeRow - 1], cells[activeRow]] = [
        cells[activeRow],
        cells[activeRow - 1],
      ];
      activeRow--;
      draw();
    }
  });
  tool("Строку вниз", "arrow-down", () => {
    if (activeRow < cells.length - 1 && activeRow > 0) {
      [cells[activeRow + 1], cells[activeRow]] = [
        cells[activeRow],
        cells[activeRow + 1],
      ];
      activeRow++;
      draw();
    }
  });
  tool("Сортировать строки", "arrow-down-a-z", () => {
    cells = [
      cells[0],
      ...cells
        .slice(1)
        .sort((a, b) => a[activeColumn].localeCompare(b[activeColumn])),
    ];
    draw();
  });
  tables.createEl("button", { text: "+ Строка" }).onclick = () => {
    cells.push(cells[0].map(() => ""));
    draw();
  };
  tables.createEl("button", { text: "+ Столбец" }).onclick = () => {
    cells.forEach((r) => r.push(""));
    draw();
  };
  tables.createEl("button", { text: "− Строка" }).onclick = () => {
    if (cells.length > 2)
      cells.splice(Math.max(1, Math.min(activeRow, cells.length - 1)), 1);
    draw();
  };
  tables.createEl("button", { text: "− Столбец" }).onclick = () => {
    if (cells[0].length > 1) {
      const i = Math.min(activeColumn, cells[0].length - 1);
      cells.forEach((r) => r.splice(i, 1));
      alignment.splice(i, 1);
    }
    draw();
  };
  tables.createEl("button", { text: "Загрузить выделенную таблицу" }).onclick =
    () => {
      const s = view.state.selection.main,
        text = view.state.sliceDoc(s.from, s.to);
      const lines = text
        .trim()
        .split("\n")
        .filter((l) => l.includes("|"));
      if (lines.length < 2) return;
      cells = lines
        .filter((l, i) => i !== 1 || !/^\s*\|?[\s:|-]+\|?\s*$/.test(l))
        .map((l) =>
          l
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((c) => c.trim()),
        );
      const width = Math.max(...cells.map((r) => r.length));
      cells = cells.map((r) =>
        Array.from({ length: width }, (_, i) => r[i] ?? ""),
      );
      replace = { from: s.from, to: s.to };
      loadedDocument = view.state.doc.toString();
      draw();
    };
  tables.createEl("button", { text: "Вставить / заменить таблицу" }).onclick =
    () => {
      const line = (r: string[]) =>
        "| " +
        r
          .map((c) => c.replaceAll("|", "&#124;").replaceAll("\n", "<br>"))
          .join(" | ") +
        " |";
      const text = [
        line(cells[0]),
        line(cells[0].map((_, i) => alignment[i] ?? "---")),
        ...cells.slice(1).map(line),
      ].join("\n");
      if (replace && loadedDocument !== view.state.doc.toString()) {
        new Notice(
          "Текст заметки изменился. Выделите и загрузите таблицу заново.",
        );
        return;
      }
      if (replace) {
        view.dispatch({ changes: { ...replace, insert: text } });
        replace = null;
        view.focus();
      } else insert("\n" + text + "\n");
    };
  const actions: Record<string, string> = {
    "+ Строка": "rows-3",
    "+ Столбец": "columns-3",
    "− Строка": "list-minus",
    "− Столбец": "minus",
    "Загрузить выделенную таблицу": "table-properties",
  };
  for (const button of Array.from(
    tables.querySelectorAll<HTMLButtonElement>(":scope > button"),
  )) {
    const name = button.textContent ?? "";
    if (actions[name]) {
      button.setAttribute("aria-label", name);
      button.textContent = "";
      setIcon(button, actions[name]);
      toolbar.appendChild(button);
    } else button.classList.add("mod-cta");
  }
}
