import type { App } from "obsidian";
export const MEDIA_DIR = ".skilltree_files";
const extensions: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/bmp": "bmp",
};
export function imageExtension(type: string) {
  return extensions[type];
}
export function mediaPath(type: string) {
  const ext = imageExtension(type);
  if (!ext) throw Error("Неподдерживаемый формат изображения");
  return `${MEDIA_DIR}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}
export async function storeImage(app: App, path: string, file: Blob) {
  const a = app.vault.adapter;
  if (!(await a.exists(MEDIA_DIR))) {
    try {
      await a.mkdir(MEDIA_DIR);
    } catch (e) {
      if (!(await a.exists(MEDIA_DIR))) throw e;
    }
  }
  await a.writeBinary(path, await file.arrayBuffer());
}
export function hiddenImagePath(markdown: string): string | null {
  const match = markdown
    .trim()
    .match(
      /^!\[[^\]]*\]\(<?(\.skilltree_files\/[a-zA-Z0-9_-]+\.(?:png|jpg|webp|gif|avif|bmp))>?\)$/,
    );
  return match?.[1] ?? null;
}
export interface NoteLink {
  from: number;
  to: number;
  target: string;
  label: string;
}
export function noteLinks(text: string): NoteLink[] {
  const found: NoteLink[] = [];
  const re =
    /\[\[([^\]\n]+)\]\]|\[([^\]\n]+)\]\((<[^>\n]+>|(?:[^\s()]|\([^()]*\))+)(?:\s+"[^"]*")?\)|(?:https?:\/\/|obsidian:\/\/)[^\s<>\[\]]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (text[m.index - 1] === "!") continue;
    let target: string, label: string;
    if (m[1]) {
      const [path, ...alias] = m[1].split("|");
      target = path;
      label = alias.join("|") || path;
    } else if (m[2]) {
      target = m[3].replace(/^<|>$/g, "");
      label = m[2];
    } else {
      target = m[0].replace(/[.,;!?]+$/, "");
      label = target;
    }
    found.push({ from: m.index, to: m.index + m[0].length, target, label });
  }
  return found;
}
export async function openNoteLink(
  app: App,
  target: string,
  source: string,
  newLeaf = false,
) {
  if (/^(https?:|mailto:|obsidian:)/i.test(target)) {
    window.open(target, "_blank", "noopener");
    return;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(target))
    throw Error("Этот тип ссылки не поддерживается");
  let decoded = target;
  try {
    decoded = decodeURIComponent(target);
  } catch {}
  await app.workspace.openLinkText(decoded, source, newLeaf);
}
