import { treeArchive } from "./archive";
import { treeGeometry, textWidth } from "./labels";
import { App, Modal, Notice, setIcon, TFile } from "obsidian";
import { PDFDocument } from "pdf-lib";
import { TreeDoc, clone, layout, colorOf, edgePath, isComment } from "./model";
import type { Config } from "./settings";
import { shapeSVG } from "./shapes";
export const xml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function exportBounds(
  doc: TreeDoc,
  config: Config,
  all: boolean,
  measure = textWidth,
) {
  const d = clone(doc);
  if (all) for (const n of d.nodes) n.collapsed = false;
  const geometry = treeGeometry(d, config, true, measure);
  const positions = geometry.positions;
  const points = [...positions.values()];
  const pad = Math.max(
    120,
    (config.size * config.rootScale) / 2 + geometry.labelHeight + 24,
  );
  const x = Math.min(...points.map((p) => p.x)) - pad,
    y = Math.min(...points.map((p) => p.y)) - pad;
  const width = Math.ceil(Math.max(...points.map((p) => p.x)) - x + pad),
    height = Math.ceil(Math.max(...points.map((p) => p.y)) - y + pad);
  return {
    d,
    positions,
    x,
    y,
    width,
    height,
    labels: geometry.labels,
    labelWidth: geometry.labelWidth,
  };
}
function base64(bytes: ArrayBuffer) {
  let s = "";
  const a = new Uint8Array(bytes);
  for (let i = 0; i < a.length; i += 8192)
    s += String.fromCharCode(...a.subarray(i, i + 8192));
  return btoa(s);
}
export async function graphSVG(
  app: App,
  doc: TreeDoc,
  config: Config,
  all: boolean,
  background: string,
  foreground: string,
) {
  let measure = textWidth;
  if (!navigator.userAgent.includes("jsdom")) {
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.font = "12px Arial";
      measure = (text: string) => ctx.measureText(text).width;
    }
  }
  const bounds = exportBounds(doc, config, all, measure),
    { d, positions, x, y, width, height } = bounds;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}"><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${xml(background)}"/>`,
  ];
  for (const n of d.nodes) {
    const p = positions.get(n.id),
      a = n.parent ? positions.get(n.parent) : undefined;
    if (p && a)
      parts.push(
        `<path d="${edgePath(d, a, p)}" fill="none" stroke="${colorOf(d, n.id)}" stroke-width="2" opacity="${isComment(d, n.id) ? 0.3 : 1}" ${isComment(d, n.id) ? 'stroke-dasharray="5 4"' : ""}/>`,
      );
  }
  for (const n of d.nodes) {
    const p = positions.get(n.id);
    if (!p) continue;
    parts.push(`<g opacity="${isComment(d, n.id) ? 0.5 : 1}">`);
    const size = config.size * (n.parent === null ? config.rootScale : 1),
      color = colorOf(d, n.id);
    const shape = shapeSVG(n.shape ?? config.shape);
    shape.setAttribute("x", String(p.x - size / 2));
    shape.setAttribute("y", String(p.y - size / 2));
    shape.setAttribute("width", String(size));
    shape.setAttribute("height", String(size));
    shape.setAttribute("fill", background);
    shape.setAttribute("stroke", color);
    shape.setAttribute("stroke-width", "2");
    parts.push(new XMLSerializer().serializeToString(shape));
    const iconSize = size * 0.4;
    if (n.emoji)
      parts.push(
        `<text x="${p.x}" y="${p.y + iconSize * 0.35}" text-anchor="middle" font-size="${iconSize}">${xml(n.emoji)}</text>`,
      );
    else if (n.image) {
      const file = app.vault.getAbstractFileByPath(n.image);
      if (!(file instanceof TFile))
        throw Error("Не найдено изображение узла: " + n.image);
      const ext = file.extension.toLowerCase(),
        mime =
          ext === "svg"
            ? "image/svg+xml"
            : ext === "jpg"
              ? "image/jpeg"
              : "image/" + ext;
      const bytes = await app.vault.readBinary(file);
      parts.push(
        `<image x="${p.x - iconSize / 2}" y="${p.y - iconSize / 2}" width="${iconSize}" height="${iconSize}" href="data:${mime};base64,${base64(bytes)}"/>`,
      );
    } else {
      const el = document.createElement("span");
      setIcon(el, n.icon || "circle-help");
      const icon = el.querySelector("svg");
      if (icon) {
        icon.setAttribute("x", String(p.x - iconSize / 2));
        icon.setAttribute("y", String(p.y - iconSize / 2));
        icon.setAttribute("width", String(iconSize));
        icon.setAttribute("height", String(iconSize));
        icon.setAttribute("color", color);
        parts.push(new XMLSerializer().serializeToString(icon));
      }
    }
    const lines = bounds.labels.get(n.id)!;
    const labelY = p.y + size / 2 + 8,
      labelW = bounds.labelWidth,
      labelH = lines.length * 16 + 8;
    parts.push(
      `<rect x="${p.x - labelW / 2}" y="${labelY}" width="${labelW}" height="${labelH}" rx="6" fill="${xml(background)}" stroke="${color}"/><text text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="${xml(foreground)}">${lines.map((line, i) => `<tspan x="${p.x}" y="${labelY + 16 + i * 16}">${xml(line)}</tspan>`).join("")}</text>`,
    );
    if (n.title.includes("?"))
      parts.push(
        `<text x="${p.x - size / 2 - (n.important ? 23 : 6)}" y="${p.y - size / 2 + 5}" fill="${color}" font-family="Arial, sans-serif" font-weight="bold" font-size="18">?</text>`,
      );
    if (n.important)
      parts.push(
        `<text x="${p.x - size / 2 - 6}" y="${p.y - size / 2 + 5}" fill="#facc15" font-size="16">★</text>`,
      );
    if (n.task && !n.completed)
      parts.push(
        `<rect x="${p.x - 6}" y="${p.y + size / 2 - 9}" width="12" height="12" rx="2" fill="${xml(background)}" stroke="${color}"/>`,
      );
    if (n.completed)
      parts.push(
        `<text x="${p.x}" y="${p.y + size / 2 + 4}" text-anchor="middle" fill="${color}" font-size="18">✓</text>`,
      );
    parts.push("</g>");
  }
  parts.push("</svg>");
  return { svg: parts.join(""), width, height };
}
export async function rasterize(
  svg: string,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const scale = Math.min(
    2,
    12000 / width,
    12000 / height,
    Math.sqrt(24000000 / (width * height)),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw Error("Не удалось создать изображение");
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(
          Error("Не удалось отрисовать граф. Проверьте изображения узлов."),
        );
      image.src = url;
    });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error("Ошибка PNG"))),
        "image/png",
      ),
    );
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = canvas.height = 1;
  }
}
export async function pngPDF(png: Uint8Array, width: number, height: number) {
  const pdf = await PDFDocument.create();
  const scale = Math.min(0.75, 14000 / Math.max(width, height));
  const page = pdf.addPage([width * scale, height * scale]);
  const image = await pdf.embedPng(png);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
  });
  return pdf.save();
}
export class ExportModal extends Modal {
  constructor(
    app: App,
    private treeDoc: TreeDoc,
    private config: Config,
    private filename: string,
    private colors: { background: string; foreground: string },
    private sourcePath?: string,
  ) {
    super(app);
  }
  onOpen() {
    this.contentEl.createEl("h2", { text: "Экспорт дерева" });
    this.contentEl.createEl("p", {
      text: "Сохранить дерево целиком, независимо от масштаба камеры. Файлы появятся в папке «Skilltree exports» хранилища.",
    });
    const label = this.contentEl.createEl("label");
    const all = label.createEl("input", { type: "checkbox" });
    all.checked = true;
    label.append(" Включить свёрнутые ветки");
    this.contentEl.createEl("p", {
      cls: "bt-panel-hint",
      text: "PDF содержит изображение дерева на одной странице. Подписи сохраняются в виде плашек; текст заметок не включается.",
    });
    const status = this.contentEl.createEl("p");
    const buttons: HTMLButtonElement[] = [];
    const archive = this.contentEl.createEl("button", {
      text: "Скачать дерево с вложениями · ZIP",
    });
    archive.onclick = async () => {
      archive.disabled = true;
      status.setText("Сбор связанных файлов…");
      try {
        const bytes = await treeArchive(
          this.app,
          clone(this.treeDoc),
          this.sourcePath ?? this.filename + ".skilltree",
        );
        const folder = "Skilltree exports";
        if (!(await this.app.vault.adapter.exists(folder)))
          await this.app.vault.createFolder(folder);
        const path =
          folder +
          "/" +
          this.filename.replace(/[\\/:*?"<>|]/g, "_") +
          "-" +
          Date.now() +
          ".zip";
        await this.app.vault.createBinary(
          path,
          bytes.slice().buffer as ArrayBuffer,
        );
        status.setText("Архив сохранён: " + path);
      } catch (e) {
        status.setText(String(e));
      } finally {
        archive.disabled = false;
      }
    };
    const formats = this.contentEl.createDiv({ cls: "bt-export-formats" });
    for (const format of ["png", "pdf"] as const) {
      const b = formats.createEl("button", {
        text: "Скачать как " + format.toUpperCase(),
      });
      const icon = b.createSpan();
      setIcon(icon, format === "png" ? "camera" : "file-text");
      b.prepend(icon);
      buttons.push(b);
      b.onclick = async () => {
        buttons.forEach((b) => (b.disabled = true));
        status.setText("Подготовка…");
        try {
          const graph = await graphSVG(
            this.app,
            clone(this.treeDoc),
            this.config,
            all.checked,
            this.colors.background,
            this.colors.foreground,
          );
          const png = await rasterize(graph.svg, graph.width, graph.height);
          const bytes =
            format === "png"
              ? png
              : await pngPDF(png, graph.width, graph.height);
          const folder = "Skilltree exports";
          if (!this.app.vault.getAbstractFileByPath(folder)) {
            try {
              await this.app.vault.createFolder(folder);
            } catch (e) {
              if (!this.app.vault.getAbstractFileByPath(folder)) throw e;
            }
          }
          const name = this.filename.replace(/[\\/:*?"<>|]/g, "_");
          const path = `${folder}/${name}-${Date.now()}-${crypto.randomUUID().slice(0, 6)}.${format}`;
          const file = await this.app.vault.createBinary(
            path,
            bytes.slice().buffer as ArrayBuffer,
          );
          status.empty();
          const open = status.createEl("button", {
            text: "Открыть " + file.name,
          });
          open.onclick = () =>
            void this.app.workspace.getLeaf("tab").openFile(file);
          const download = status.createEl("button", { text: "Скачать копию" });
          download.onclick = () => {
            const url = URL.createObjectURL(
              new Blob([bytes.slice().buffer as ArrayBuffer], {
                type: format === "png" ? "image/png" : "application/pdf",
              }),
            );
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = file.name;
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
          };
          new Notice("Экспорт сохранён: " + path);
        } catch (e) {
          status.setText(String(e));
        } finally {
          buttons.forEach((b) => (b.disabled = false));
        }
      };
    }
  }
  onClose() {
    this.contentEl.empty();
  }
}
