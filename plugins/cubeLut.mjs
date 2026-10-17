import { readFile } from "node:fs/promises";

export function cubeLut() {
  return {
    name: "cube-lut",
    async load(id) {
      if (!id.endsWith(".cube")) return;

      const text = await readFile(id, "utf8");
      const size = Number(/LUT_3D_SIZE +(\d+)/.exec(text)[1]);
      const rgb = Buffer.from(
        [...text.matchAll(/^([\d.e+-]+) +([\d.e+-]+) +([\d.e+-]+) *$/gm)]
          .flatMap((match) => match.slice(1))
          .map((value) => value * 255),
      );

      return `const rgb = Uint8Array.from(atob("${rgb.toString("base64")}"), (c) => c.charCodeAt(0));
const data = new Uint8Array((rgb.length / 3) * 4).fill(255);
rgb.forEach((value, i) => (data[i + Math.floor(i / 3)] = value));
export default { size: ${size}, data };`;
    },
  };
}
