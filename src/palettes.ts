import { unzlibSync } from "fflate";
// Aseprite specification: https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md
export function parsePalette(
  bytes: Uint8Array,
  name: string,
  source: "pixels" | "palette" = "pixels",
): string[] {
  const hex = (r: number, g: number, b: number) =>
    "#" +
    [r, g, b]
      .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0"))
      .join("");
  const colors = new Map<number, string>();
  if (/\.(aseprite|ase)$/i.test(name)) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const need = (p: number, n: number, end = bytes.length) => {
      if (p < 0 || p + n > end) throw Error("Повреждён файл палитры");
    };
    need(0, 128);
    if (v.getUint16(4, true) !== 0xa5e0)
      throw Error("Ожидается файл Aseprite (.aseprite / .ase)");
    const pixelColors = new Set<string>();
    const depth = v.getUint16(12, true);
    if (source === "pixels" && ![8, 16, 32].includes(depth))
      throw Error("Неподдерживаемая глубина цвета Aseprite: " + depth);
    let frame = 128;
    for (let f = 0; f < v.getUint16(6, true); f++) {
      need(frame, 16);
      const end = frame + v.getUint32(frame, true);
      need(frame, end - frame);
      if (end <= frame + 15) throw Error("Некорректный кадр");
      let p = frame + 16;
      const count =
        v.getUint32(frame + 12, true) || v.getUint16(frame + 6, true);
      let modern = false;
      const cels: Uint8Array[] = [];
      for (let c = 0; c < count; c++) {
        need(p, 6, end);
        const chunkEnd = p + v.getUint32(p, true),
          type = v.getUint16(p + 4, true);
        if (chunkEnd <= p + 5) throw Error("Некорректный блок");
        need(p, chunkEnd - p, end);
        let q = p + 6;
        if (type === 0x2019) {
          modern = true;
          need(q, 20, chunkEnd);
          const first = v.getUint32(q + 4, true),
            last = v.getUint32(q + 8, true);
          if (last - first > 65535) throw Error("Слишком большая палитра");
          q += 20;
          for (let i = first; i <= last; i++) {
            need(q, 6, chunkEnd);
            const flags = v.getUint16(q, true);
            colors.set(i, hex(bytes[q + 2], bytes[q + 3], bytes[q + 4]));
            q += 6;
            if (flags & 1) {
              need(q, 2, chunkEnd);
              const len = v.getUint16(q, true);
              q += 2;
              need(q, len, chunkEnd);
              q += len;
            }
          }
        } else if ((type === 4 || type === 17) && !modern) {
          need(q, 2, chunkEnd);
          const packets = v.getUint16(q, true);
          q += 2;
          let index = 0;
          for (let k = 0; k < packets; k++) {
            need(q, 2, chunkEnd);
            index += bytes[q++];
            const n = bytes[q++] || 256;
            for (let i = 0; i < n; i++) {
              need(q, 3, chunkEnd);
              const scale = type === 17 ? 255 / 63 : 1;
              colors.set(
                index++,
                hex(
                  Math.round(bytes[q] * scale),
                  Math.round(bytes[q + 1] * scale),
                  Math.round(bytes[q + 2] * scale),
                ),
              );
              q += 3;
            }
          }
        }
        if (type === 0x2005 && source === "pixels") {
          const start = p + 6;
          need(start, 16, chunkEnd);
          const celType = v.getUint16(start + 7, true);
          if ((celType === 0 || celType === 2) && bytes[start + 6] > 0) {
            need(start + 16, 4, chunkEnd);
            const length =
              v.getUint16(start + 16, true) *
              v.getUint16(start + 18, true) *
              (depth / 8);
            if (length > 64 * 1024 * 1024)
              throw Error("Слишком большой слой для импорта палитры");
            const data = bytes.subarray(start + 20, chunkEnd);
            const pixels =
              celType === 2
                ? unzlibSync(data, { out: new Uint8Array(length) })
                : data;
            if (pixels.length !== length)
              throw Error("Повреждены пиксели Aseprite");
            cels.push(pixels);
          } else if (celType === 3)
            throw Error(
              "Для импорта цветов преобразуйте tilemap-слой в обычный слой",
            );
        }
        p = chunkEnd;
      }
      for (const pixels of cels) {
        for (let i = 0; i < pixels.length; i += depth / 8) {
          if (depth === 32 && pixels[i + 3] > 0)
            pixelColors.add(hex(pixels[i], pixels[i + 1], pixels[i + 2]));
          else if (depth === 16 && pixels[i + 1] > 0)
            pixelColors.add(hex(pixels[i], pixels[i], pixels[i]));
          else if (
            depth === 8 &&
            pixels[i] !== bytes[28] &&
            colors.has(pixels[i])
          )
            pixelColors.add(colors.get(pixels[i])!);
        }
      }
      frame = end;
    }
    if (source === "pixels") {
      if (pixelColors.size) return [...pixelColors];
      throw Error(
        "В изображении не найдены непрозрачные пиксели. Для импорта служебной палитры выберите «Палитра документа Aseprite».",
      );
    }
  } else {
    const text = new TextDecoder().decode(bytes);
    for (const m of text.matchAll(/#([\da-f]{6}|[\da-f]{3})\b/gi)) {
      const x = m[1];
      colors.set(
        colors.size,
        "#" +
          (x.length === 3
            ? [...x].map((c) => c + c).join("")
            : x
          ).toLowerCase(),
      );
    }
    if (!colors.size)
      for (const line of text.split("\n")) {
        const m = line.trim().match(/^[\da-f]{6}$/i);
        if (m) colors.set(colors.size, "#" + m[0].toLowerCase());
      }
    if (!colors.size)
      for (const l of text.split("\n")) {
        const m = l.match(
          /^\s*(\d{1,3})[\s,;]+(\d{1,3})[\s,;]+(\d{1,3})(?:\s|$)/,
        );
        if (m && m.slice(1).every((n) => +n <= 255))
          colors.set(colors.size, hex(+m[1], +m[2], +m[3]));
      }
  }
  const result = [
    ...new Set(
      [...colors.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v),
    ),
  ];
  if (!result.length)
    throw Error(
      "Цвета не найдены. Поддерживаются Aseprite, HEX/JSON/CSS и GPL/RGB-текст.",
    );
  return result;
}
