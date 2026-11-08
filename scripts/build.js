// public/ を正本として、既存の配信ディレクトリにも同じ成果物を配置する。
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
for (const directory of ["static", "docs"]) {
  await mkdir(directory, { recursive: true });
  for (const old of ["app.css", "app.js", "mirai.store.js"]) await rm(`${directory}/${old}`, { force: true });
  await cp("public", directory, { recursive: true });
  for (const slug of ["policy", "kikaku", "koho", "engineer", "jimu", "yakuin"]) {
    await writeFile(`${directory}/${slug}.html`, `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=./index.html#/${slug}"><title>運営ポータルへ移動</title><a href="./index.html#/${slug}">部門ツールへ移動</a></html>\n`);
  }
}
console.log("public/ を static/・docs/ に反映しました");
