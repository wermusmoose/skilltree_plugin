import type { App } from "obsidian";
import { zip, strToU8 } from "fflate";
import { TreeDoc, parseDoc } from "./model";
import { noteLinks } from "./media";

// Preserve vault-relative paths, so relative links and attachments keep working.
export async function treeArchive(app: App, doc: TreeDoc, source: string) {
  const files: Record<string, Uint8Array> = Object.create(null);
  const pending: { target: string; source: string }[] = [];
  const seen = new Set<string>(),
    missing = new Set<string>(),
    external = new Set<string>();
  let total = 0;
  const safe = (p: string) =>
    !!p &&
    !p.startsWith("/") &&
    !p.includes("\\") &&
    !p.includes("\0") &&
    !/^[a-z]:/i.test(p) &&
    !p.split("/").some((x) => x === ".." || x === "." || x === "");
  const relative = (target: string, from: string) => {
    if (
      target.startsWith("/") ||
      target.includes("\\") ||
      target.includes("\0")
    )
      return null;
    const parts = from.split("/").slice(0, -1);
    for (const part of target.split("/")) {
      if (part === "..") {
        if (!parts.length) return null;
        parts.pop();
      } else if (part && part !== ".") parts.push(part);
    }
    const result = parts.join("/");
    return safe(result) ? result : null;
  };
  const refs = (text: string, from: string) => {
    for (const l of noteLinks(text.replace(/!\[/g, "[")))
      pending.push({ target: l.target, source: from });
    for (const m of text.matchAll(/^\s*\[[^\]]+\]:\s*(?:<([^>]+)>|([^\s]+))/gm))
      pending.push({ target: m[1] ?? m[2], source: from });
    for (const m of text.matchAll(/(?:src|href)=["']([^"']+)["']/gi))
      pending.push({ target: m[1], source: from });
  };
  const tree = (d: TreeDoc, from: string) => {
    for (const n of d.nodes) {
      for (const target of [n.note, n.image, n.tree])
        if (target) pending.push({ target, source: from });
      refs(n.body, from);
    }
  };
  if (!safe(source)) throw Error("Сначала сохраните дерево в хранилище");
  files[source] = strToU8(JSON.stringify(doc, null, 2));
  seen.add(source);
  tree(doc, source);
  for (let i = 0; i < pending.length; i++) {
    const ref = pending[i];
    if (
      /^[a-z][a-z0-9+.-]*:/i.test(ref.target) ||
      ref.target.startsWith("//")
    ) {
      external.add(ref.target);
      continue;
    }
    let target = ref.target.split("|")[0].split("#")[0];
    try {
      target = decodeURIComponent(target);
    } catch {}
    if (!target) continue;
    if (
      target.startsWith("/") ||
      target.includes("\\") ||
      /^[a-z]:/i.test(target)
    ) {
      missing.add(ref.target);
      continue;
    }
    const resolved = app.metadataCache.getFirstLinkpathDest(target, ref.source);
    const candidates = [
      resolved?.path,
      relative(target, ref.source),
      safe(target) ? target : null,
    ];
    let path: string | undefined;
    for (const candidate of candidates)
      if (
        candidate &&
        safe(candidate) &&
        (await app.vault.adapter.exists(candidate))
      ) {
        path = candidate;
        break;
      }
    if (!path) {
      missing.add(ref.target + " ← " + ref.source);
      continue;
    }
    if (seen.has(path)) continue;
    seen.add(path);
    const stat = await app.vault.adapter.stat(path);
    if (stat?.type !== "file") {
      missing.add(path);
      continue;
    }
    total += stat.size;
    if (total > 250 * 1024 * 1024)
      throw Error("Архив превышает 250 МБ. Уменьшите число вложений.");
    const data = new Uint8Array(await app.vault.adapter.readBinary(path));
    files[path] = data;
    if (/\.md$/i.test(path)) refs(new TextDecoder().decode(data), path);
    if (/\.skilltree$/i.test(path)) {
      try {
        tree(parseDoc(new TextDecoder().decode(data)), path);
      } catch {
        throw Error("Не удалось прочитать связанное дерево " + path);
      }
    }
  }
  if (missing.size)
    throw Error(
      "Архив не создан: не найдены файлы:\n" + [...missing].join("\n"),
    );
  let instructions = "SKILLTREE-IMPORT.txt";
  while (files[instructions]) instructions = "_" + instructions;
  files[instructions] = strToU8(
    "Установите Branch Tree. Распакуйте содержимое архива в корень отдельного нового хранилища, сохраняя пути и скрытую папку .skilltree_files. Откройте " +
      source +
      ". Не перезаписывайте одноимённые файлы существующего хранилища.\nВнешние ссылки требуют доступа к сети:\n" +
      [...external].join("\n"),
  );
  return new Promise<Uint8Array>((resolve, reject) =>
    zip(files, { level: 6 }, (error, data) =>
      error ? reject(error) : resolve(data),
    ),
  );
}
