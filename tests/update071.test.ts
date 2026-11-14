import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePalette } from "../src/palettes";
import { noteLinks } from "../src/media";
import { fresh, addNode, parseDoc } from "../src/model";
import { treeArchive } from "../src/archive";
import { unzipSync, strToU8, strFromU8 } from "fflate";

test("malformed links do not freeze while editing and valid links preserve destinations", () => {
  const start = performance.now();
  for (let i = 0; i < 60; i++)
    noteLinks("[ссылка](https://example.com/" + "abc".repeat(2000));
  assert.ok(performance.now() - start < 1000);
  assert.equal(
    noteLinks("[Текст](https://example.com/a_(b))")[0].target,
    "https://example.com/a_(b)",
  );
  assert.equal(
    noteLinks("[[Заметка#Раздел|Название]]")[0].target,
    "Заметка#Раздел",
  );
});

test("large text palettes and modern Aseprite palette chunks import without a 16-color cap", () => {
  const list = Array.from(
    { length: 40 },
    (_, i) => "#" + i.toString(16).padStart(6, "0"),
  );
  assert.deepEqual(parsePalette(strToU8(list.join("\n")), "colors.hex"), list);
  const data = new Uint8Array(128 + 16 + 6 + 20 + 40 * 6),
    v = new DataView(data.buffer);
  v.setUint32(0, data.length, true);
  v.setUint16(4, 0xa5e0, true);
  v.setUint16(6, 1, true);
  v.setUint32(128, data.length - 128, true);
  v.setUint16(132, 0xf1fa, true);
  v.setUint16(134, 1, true);
  v.setUint32(144, data.length - 144, true);
  v.setUint16(148, 0x2019, true);
  v.setUint32(150, 40, true);
  v.setUint32(158, 39, true);
  for (let i = 0; i < 40; i++) {
    data[170 + 6 * i + 4] = i;
    data[170 + 6 * i + 5] = 255;
  }
  assert.deepEqual(parsePalette(data, "colors.aseprite", "palette"), list);
  assert.throws(() => parsePalette(data.slice(0, 180), "bad.aseprite"));
  assert.deepEqual(
    parsePalette(
      strToU8("GIMP Palette\n255 0 16 red\n0 128 240 blue"),
      "colors.gpl",
    ),
    ["#ff0010", "#0080f0"],
  );
});

test("timestamps, task markers and emoji roundtrip; legacy creation dates remain unknown", () => {
  const d = fresh(),
    n = addNode(d, d.nodes[0].id);
  n.emoji = "🌱";
  n.important = true;
  n.task = true;
  assert.ok(Number.isFinite(Date.parse(n.createdAt!)));
  assert.equal(parseDoc(JSON.stringify(d)).nodes[1].emoji, "🌱");
  delete d.nodes[0].createdAt;
  delete d.nodes[0].updatedAt;
  assert.equal(parseDoc(JSON.stringify(d)).nodes[0].createdAt, undefined);
  d.camera.zoom = 0.01;
  assert.equal(parseDoc(JSON.stringify(d)).camera.zoom, 0.01);
});

function archiveVault(entries: Record<string, string | Uint8Array>) {
  const files = Object.fromEntries(
    Object.entries(entries).map(([k, v]) => [
      k,
      typeof v === "string" ? strToU8(v) : v,
    ]),
  );
  const touched: string[] = [];
  const app: any = {
    metadataCache: { getFirstLinkpathDest: () => null },
    vault: {
      adapter: {
        exists: async (p: string) => {
          touched.push(p);
          return !!files[p];
        },
        stat: async (p: string) => ({ type: "file", size: files[p].length }),
        readBinary: async (p: string) => files[p].slice().buffer,
      },
    },
  };
  return { app, touched };
}

test("archive recursively includes notes, hidden images, binaries and trees; preserves paths and cycles", async () => {
  const d = fresh(),
    other = fresh();
  d.nodes[0].note = "notes/A.md";
  d.nodes[0].body = "![[.skilltree_files/p.png]]";
  d.nodes[0].tree = "Other.skilltree";
  other.nodes[0].note = "notes/B.md";
  const binary = new Uint8Array([0, 255, 128, 0]);
  const { app } = archiveVault({
    "notes/A.md":
      "[[B.md]] ![image](<../.skilltree_files/p.png>)\n[Report](../files/report.pdf)",
    "notes/B.md": "[[A.md]]",
    "files/report.pdf": binary,
    ".skilltree_files/p.png": binary,
    "Other.skilltree": JSON.stringify(other),
  });
  const archive = unzipSync(await treeArchive(app, d, "Root.skilltree"));
  for (const path of [
    "Root.skilltree",
    "notes/A.md",
    "notes/B.md",
    "files/report.pdf",
    ".skilltree_files/p.png",
    "Other.skilltree",
    "SKILLTREE-IMPORT.txt",
  ])
    assert.ok(archive[path], path);
  assert.deepEqual(archive["files/report.pdf"], binary);
  assert.deepEqual(parseDoc(strFromU8(archive["Root.skilltree"])), d);
});

test("archive reports missing dependencies and never accesses paths outside vault", async () => {
  const d = fresh();
  d.nodes[0].note = "../../outside.md";
  const { app, touched } = archiveVault({});
  await assert.rejects(treeArchive(app, d, "Tree.skilltree"), /не найдены/);
  assert.deepEqual(touched, []);
  d.nodes[0].note = "missing.pdf";
  await assert.rejects(treeArchive(app, d, "Tree.skilltree"), /missing.pdf/);
});

test("Aseprite extracts actual RGB pixels rather than unused document palette", async () => {
  const { zlibSync } = await import("fflate");
  for (const compressed of [false, true]) {
    const raw = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 0, 0]);
    const payload = compressed ? zlibSync(raw) : raw;
    const data = new Uint8Array(202 + payload.length),
      v = new DataView(data.buffer);
    v.setUint16(4, 0xa5e0, true);
    v.setUint16(6, 1, true);
    v.setUint16(12, 32, true);
    v.setUint32(128, data.length - 128, true);
    v.setUint16(134, 2, true);
    v.setUint32(144, 32, true);
    v.setUint16(148, 0x2019, true);
    v.setUint32(150, 1, true);
    data[175] = 255;
    v.setUint32(176, 26 + payload.length, true);
    v.setUint16(180, 0x2005, true);
    data[188] = 255;
    v.setUint16(189, compressed ? 2 : 0, true);
    v.setUint16(198, 3, true);
    v.setUint16(200, 1, true);
    data.set(payload, 202);
    assert.deepEqual(parsePalette(data, "test.aseprite"), [
      "#ff0000",
      "#00ff00",
    ]);
    assert.deepEqual(parsePalette(data, "test.aseprite", "palette"), [
      "#000000",
    ]);
  }
});

test("Aseprite header depth is at byte 12; flags at 14 never act as pixel depth", () => {
  const data = new Uint8Array(174),
    v = new DataView(data.buffer);
  v.setUint16(4, 0xa5e0, true);
  v.setUint16(6, 1, true);
  v.setUint16(8, 1, true);
  v.setUint16(10, 1, true);
  v.setUint16(12, 32, true);
  v.setUint32(14, 1, true);
  v.setUint32(128, 46, true);
  v.setUint16(132, 0xf1fa, true);
  v.setUint16(134, 1, true);
  v.setUint32(144, 30, true);
  v.setUint16(148, 0x2005, true);
  data[156] = 255;
  v.setUint16(166, 1, true);
  v.setUint16(168, 1, true);
  data.set([255, 80, 170, 255], 170);
  assert.deepEqual(parsePalette(data, "actual-header.aseprite"), ["#ff50aa"]);
  data[173] = 0;
  assert.throws(
    () => parsePalette(data, "transparent.aseprite"),
    /не найдены непрозрачные пиксели/,
  );
  v.setUint16(12, 1, true);
  assert.throws(
    () => parsePalette(data, "invalid-depth.aseprite"),
    /глубина цвета/,
  );
});
