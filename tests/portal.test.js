import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { JSDOM } = process.env.JSDOM_PATH ? require(process.env.JSDOM_PATH) : require("jsdom");
const root = resolve("public");
async function setup(saved) {
  const dom = new JSDOM(await readFile(`${root}/index.html`, "utf8"), { url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true });
  const win = dom.window;
  win.structuredClone = structuredClone;
  win.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  win.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  if (saved !== undefined) win.localStorage.setItem("mirai.portal.store", saved);
  const cache = new Map();
  async function load(path) {
    if (!cache.has(path)) cache.set(path, new vm.SourceTextModule(await readFile(path, "utf8"), { context: dom.getInternalVMContext(), identifier: path }));
    return cache.get(path);
  }
  const app = await load(`${root}/js/app.js`);
  await app.link((name, module) => load(resolve(dirname(module.identifier), name)));
  await app.evaluate();
  await tick();
  const document = win.document;
  const $ = (selector) => document.querySelector(selector);
  const click = async (selector) => { assert.ok($(selector), selector); $(selector).click(); await tick(); };
  const route = async (slug) => { win.location.hash = `#/${slug}`; await tick(); await app.namespace.render(); };
  const set = (name, value) => { const input = $(`#dialog [name="${name}"]`); assert.ok(input, name); input.value = value; input.dispatchEvent(new win.Event("input")); input.dispatchEvent(new win.Event("change")); };
  const submit = async () => { $("#dialog form").dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true })); await tick(); };
  return { dom, win, $, click, route, set, submit, app, data: () => JSON.parse(win.localStorage.getItem("mirai.portal.store")) };
}
const tick = () => new Promise((done) => setTimeout(done, 15));
test("主要導線・6部門の保存・履歴・データ保護", async () => {
  const t = await setup(); const { $, click, route, set, submit, win, data } = t;
  assert.equal(data().version, 1);
  for (const dept of t.app.namespace.DEPTS) {
    assert.ok(Object.values(data()).filter(Array.isArray).flat().filter((row) => row.dept === dept).length >= 10);
  }
  for (const table of Object.values(data()).filter(Array.isArray)) for (const row of table) for (const key of ["id", "dept", "title", "status", "created_at", "updated_at"]) assert.ok(row[key]);
  assert.equal($(".summary").children.length, 4);
  assert.equal(win.document.querySelectorAll(".dept-metrics").length, 6);
  const unreadBefore = data().notices.filter((n) => n.read_by.includes("members-1")).length;
  await click(".read-notice"); assert.equal(data().notices.filter((n) => n.read_by.includes("members-1")).length, unreadBefore + 1);
  await click(".task-open"); set("status", "完了"); await submit(); assert.ok(data().tasks.some((task) => task.completed_at && task.assignee_id === "members-1"));
  await route("policy");
  await click('[data-vote="賛成"]'); assert.equal(data().agendas[0].votes["members-1"], "賛成");
  await click('[data-vote="反対"]'); assert.equal(data().agendas[0].votes["members-1"], "反対");
  await click('[data-vote="反対"]'); assert.equal(data().agendas[0].votes["members-1"], undefined);
  const form = $("[data-comment]"); form.querySelector("textarea").value = '<img src=x onerror="alert(1)">'; form.dispatchEvent(new win.Event("submit", { cancelable: true })); await tick();
  assert.equal(data().agendas[0].comments.length, 1); assert.equal($("#app img"), null);
  const count = data().tasks.length; await click("[data-task]"); set("due_date", "2026-12-01"); await submit(); assert.equal(data().tasks.length, count + 1); assert.ok($("[data-task]").disabled);
  await click("#new-minutes"); set("agenda", "交通費支援"); set("content", "原案を見直す"); await submit(); assert.equal(data().minutes.filter((m) => m.dept === "政策立案").length, 1);
  await click("[data-minute-task]"); await submit(); assert.equal(data().tasks.length, count + 2);
  await click("#new-agenda"); set("title", "学生の参加支援"); set("category", "支援"); set("due_date", "2026-12-02"); await submit(); assert.ok(data().agendas.some((a) => a.title === "学生の参加支援"));
  await route("kikaku"); await click("#new-project"); set("title", "冬の交流会"); set("description", "参加者交流"); set("due_date", "2026-12-03"); await submit(); assert.ok(data().projects.some((p) => p.title === "冬の交流会"));
  const select = $("[data-table]"); const id = select.dataset.id; select.value = "完了"; select.dispatchEvent(new win.Event("change")); await tick(); assert.equal(data().projects.find((p) => p.id === id).status, "完了");
  await click('[data-filter="完了"]'); assert.ok(win.document.querySelectorAll(".pj-card").length); assert.ok([...win.document.querySelectorAll(".status-select")].every((s) => s.value === "完了"));
  await route("koho"); await click("#new-post"); set("title", "新規投稿"); set("content", "あ".repeat(141)); assert.equal($("#count").textContent, "141 / 140字"); assert.ok($('#dialog button[type="submit"]').disabled); set("channel", "Instagram"); assert.ok(!$('#dialog button[type="submit"]').disabled); set("content", "公開内容"); await submit();
  assert.ok(data().documents.some((d) => d.title === "新規投稿"));
  await click('[data-action="レビュー"]'); assert.equal(data().documents.find((d) => d.dept === "広報").status, "レビュー");
  await click("[data-return]"); set("review_note", "出典を追記"); await submit(); assert.equal(data().documents.find((d) => d.dept === "広報").status, "下書き");
  await click('[data-action="レビュー"]'); await click('[data-action="承認"]'); assert.equal(data().approvals.length, 1); await click('[data-action="公開予定"]'); assert.equal(data().documents.find((d) => d.dept === "広報").status, "公開予定");
  assert.equal(win.document.querySelectorAll(".calendar-day").length, 7); const calendar = $(".calendar").textContent; await click("#next"); assert.notEqual($(".calendar").textContent, calendar); await click("#this-week"); assert.equal($(".calendar").textContent, calendar);
  await route("engineer"); await click("#new-issue"); set("title", "キーボード操作を改善"); set("labels", "改善,UI"); await submit(); assert.ok(data().issues.some((i) => i.title === "キーボード操作を改善" && i.labels.length === 2)); await click("#release"); assert.match($('#dialog textarea').value, /# リリースノート/); assert.match($('#dialog textarea').value, /データ出力機能/); await click("#close");
  await route("jimu"); $("#search").value = "存在しない文字列"; $("#search").dispatchEvent(new win.Event("input")); assert.match($("#documents").textContent, /一致する文書はありません/); await click("#new-document"); set("title", "共有ガイド"); $("#template").value = "通知文"; await click("#insert"); assert.match($('#dialog [name="content"]').value, /【お知らせ】/); await submit(); assert.ok(data().documents.some((d) => d.title === "共有ガイド"));
  await route("yakuin"); await click("#new-note"); set("title", "新任部門長面談"); set("content", "引き継ぎを支援する"); await submit(); assert.ok(data().minutes.some((m) => m.title === "新任部門長面談")); await click("[data-task]"); await submit(); assert.ok(data().minutes.find((m) => m.dept === "役員会").task_id);
  assert.equal(win.document.querySelectorAll("[data-detail]").length, data().tasks.length);
  await route("policy"); await route("jimu"); win.history.back(); await tick(); assert.match($("h1").textContent, /政策立案/);
  await route("missing"); assert.match($("h1").textContent, /見つかりません/); await route("");
  $("#member").value = "members-2"; $("#member").dispatchEvent(new win.Event("change")); await tick(); assert.match($(".page-heading p").textContent, /高橋/);
  const saved = win.localStorage.getItem("mirai.portal.store"); const reloaded = await setup(saved); assert.equal(reloaded.win.localStorage.getItem("mirai.portal.store"), saved); reloaded.dom.window.close();
  const broken = await setup("{broken"); assert.equal(broken.win.localStorage.getItem("mirai.portal.store"), "{broken"); assert.match(broken.$("#toast").textContent, /上書きしません/); await assert.rejects(broken.app.namespace.api("/api/tasks", { method: "POST", body: {} })); broken.dom.window.close();
  const css = await readFile(`${root}/style.css`, "utf8"); assert.match(css, /@media\(max-width:600px\)/); assert.match(css, /grid-template-columns:1fr/); assert.match(css, /font-size:16px/);
  t.dom.window.close();
});
