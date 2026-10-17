import { readFile } from "node:fs/promises";

export function cubeLut() {
  return {
    name: "cube-lut",
    async load(id) {
      if (!id.endsWith(".cube")) return;

      const text = await readFile(id, "utf8");
      const size = Number(/LUT_3D_SIZE +(\d+)/.exec(text)?.[1]);
      if (!size) throw new Error(`${id}: missing LUT_3D_SIZE`);

      const rgb = Buffer.alloc(size ** 3 * 3);
      let i = 0;
      for (const [, r, g, b] of text.matchAll(
        /^([\d.e+-]+) +([\d.e+-]+) +([\d.e+-]+) *$/gm,
      )) {
        rgb[i++] = Number(r) * 255;
        rgb[i++] = Number(g) * 255;
        rgb[i++] = Number(b) * 255;
      }
      if (i !== rgb.length) throw new Error(`${id}: expected ${size}³ entries`);

      return `const rgb = Uint8Array.from(atob("${rgb.toString("base64")}"), (c) => c.charCodeAt(0));
const data = new Uint8Array(${size ** 3 * 4}).fill(255);
for (let i = 0; i < ${size ** 3}; i++) data.set(rgb.subarray(i * 3, i * 3 + 3), i * 4);
export default { size: ${size}, data };`;
    },
  };
}
