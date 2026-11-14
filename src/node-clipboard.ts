import { clone, subtree, children, colorOf, TreeDoc, TreeNode } from "./model";
export const CLIPBOARD_PREFIX = "branch-tree-nodes:v1\n";
export function copyBranches(doc: TreeDoc, selection: string[]): TreeNode[] {
  const selected = new Set(selection);
  const roots = doc.nodes.filter(
    (n) =>
      selected.has(n.id) &&
      !doc.nodes.some(
        (p) =>
          p.id !== n.id && selected.has(p.id) && subtree(doc, p.id).has(n.id),
      ),
  );
  const ids = new Set(roots.flatMap((n) => [...subtree(doc, n.id)]));
  return doc.nodes
    .filter((n) => ids.has(n.id))
    .map((n) => ({
      ...clone(n),
      parent: ids.has(n.parent ?? "") ? n.parent : null,
      ...(roots.some((r) => r.id === n.id)
        ? { color: colorOf(doc, n.id) }
        : {}),
    }));
}
export function pasteBranches(
  doc: TreeDoc,
  parent: string,
  nodes: TreeNode[],
): string[] {
  const target = doc.nodes.find((n) => n.id === parent);
  if (!target || !nodes.length) return [];
  const mapping = new Map(nodes.map((n) => [n.id, crypto.randomUUID()]));
  const order = children(doc, parent).reduce(
    (m, n) => Math.max(m, n.order + 1),
    0,
  );
  let index = 0;
  const now = new Date().toISOString();
  const added = nodes.map((n) => ({
    ...clone(n),
    id: mapping.get(n.id)!,
    parent: mapping.get(n.parent ?? "") ?? parent,
    order: mapping.has(n.parent ?? "") ? n.order : order + index++,
    createdAt: now,
    updatedAt: now,
  }));
  target.collapsed = false;
  doc.nodes.push(...added);
  return added.map((n) => n.id);
}
