import { App, setIcon } from "obsidian";
import type { TreeNode } from "./model";
export function applyPresetIcon(node: TreeNode, value: string) {
  delete node.emoji;
  delete node.image;
  node.icon = "circle-help";
  if (value.startsWith("emoji:")) node.emoji = value.slice(6);
  else if (value.startsWith("image:")) node.image = value.slice(6);
  else node.icon = value;
}
export function renderPresetIcon(el: HTMLElement, value: string, app: App) {
  if (value.startsWith("emoji:")) el.textContent = value.slice(6);
  else if (value.startsWith("image:")) {
    const path = value.slice(6),
      file = app.vault.getAbstractFileByPath(path);
    if (file)
      el.createEl("img", {
        attr: { src: app.vault.getResourcePath(file as any), alt: path },
      });
    else setIcon(el, "image-off");
  } else setIcon(el, value);
}
