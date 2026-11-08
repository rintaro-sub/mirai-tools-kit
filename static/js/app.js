// 起動・ハッシュルーティングと、lib.js と同じインターフェースの共通関数。
import { list, mutate, DEPTS, getStorageError } from "./store.js";
import { ico } from "./icons.js";
import { renderHome } from "./views/home.js";
import { renderPolicy } from "./views/policy.js";
import { renderKikaku } from "./views/kikaku.js";
import { renderKoho } from "./views/koho.js";
import { renderEngineer } from "./views/engineer.js";
import { renderJimu } from "./views/jimu.js";
import { renderYakuin } from "./views/yakuin.js";
export const state = { me: null, users: [], types: {}, showDoneTasks: false };
export const slugs = ["policy", "kikaku", "koho", "engineer", "jimu", "yakuin"];
export { DEPTS, ico };
export function esc(value) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
export function jstDateTime(ms = Date.now()) { return new Date(ms + 9 * 3600000).toISOString().slice(0, 16); }
export function todayStr() { return jstDateTime().slice(0, 10); }
export function addDays(date, days) { return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10); }
export function fmtDate(date) { if (!date) return "未設定"; const d = new Date(`${date.slice(0, 10)}T00:00:00Z`); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${"日月火水木金土"[d.getUTCDay()]}）`; }
export function avatar(user, size = "") { return user ? `<span class="avatar ${esc(size)}" title="${esc(user.name)}">${esc(user.name.slice(0, 1))}</span>` : ""; }
export async function api(path, { method = "GET", body } = {}) {
  const [table, id] = path.replace(/^\/api\//, "").split("/");
  return method === "GET" ? (id ? list(table).find((row) => row.id === id) : list(table)) : mutate(table, id, body);
}
export function rows(table, dept) { return list(table).filter((row) => !dept || row.dept === dept); }
export function member(id) { return state.users.find((user) => user.id === id)?.name || "未割り当て"; }
export function options(values, selected) { return values.map((value) => `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(value)}</option>`).join(""); }
export function members(selected) { return state.users.map((user) => `<option value="${esc(user.id)}" ${user.id === selected ? "selected" : ""}>${esc(user.name)}（${esc(user.dept)}）</option>`).join(""); }
export function field(label, input) { return `<label>${label}${input}</label>`; }
export function input(name, type = "text", value = "", required = true) { return `<input name="${name}" type="${type}" value="${esc(value)}" ${required ? "required" : ""}>`; }
export function heading(title, description) { return `<div class="page-heading left"><span class="eyebrow">OPERATIONS / TEAM MIRAI</span><h1>${title}</h1><p>${description}</p></div>`; }
export function badge(value, warn = false) { return `<span class="stage-pill ${warn ? "is-over" : ""}">${esc(value)}</span>`; }
export function due(date, done = false) { return `<span class="due ${!done && date < todayStr() ? "is-over" : ""}">${fmtDate(date)}${!done && date < todayStr() ? "・期限超過" : ""}</span>`; }
export function empty(text = "該当する項目はありません") { return `<p class="empty">${text}</p>`; }
export function toast(message) { const el = document.querySelector("#toast"); el.textContent = message; el.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, 4500); }
export function modal(title, html, submit) {
  const dialog = document.querySelector("#dialog");
  dialog.innerHTML = `<div class="row"><h2 id="dialog-title">${esc(title)}</h2><button type="button" id="close">閉じる</button></div><form>${html}${submit ? '<button class="primary" type="submit">保存する</button>' : ""}</form>`;
  dialog.querySelector("#close").onclick = () => dialog.close();
  if (submit) dialog.querySelector("form").onsubmit = async (event) => { event.preventDefault(); const button = event.submitter; if (button) button.disabled = true; try { await submit(Object.fromEntries(new FormData(event.target))); dialog.close(); await render(); toast("保存しました"); } catch (error) { toast(error.message); } finally { if (button) button.disabled = false; } };
  dialog.showModal();
}
export function statusSelect(table, row, statuses) { return `<label class="status-label">状態<select data-table="${table}" data-id="${row.id}" class="status-select">${options(statuses, row.status)}</select></label>`; }
export function bindStatuses(el) { el.querySelectorAll("[data-table]").forEach((select) => { select.onchange = async () => { try { await api(`/api/${select.dataset.table}/${select.dataset.id}`, { method: "PATCH", body: { status: select.value, ...(select.value === "完了" ? { completed_at: new Date().toISOString() } : {}) } }); toast("状態を更新しました"); } catch (error) { toast(error.message); } await render(); }; }); }
export function taskify(row, table) {
  if (row.task_id) { toast("タスク化済みです"); return; }
  modal("タスクにする", field("タスク名", input("title", "text", row.title)) + field("担当", `<select name="assignee_id">${members(state.me.id)}</select>`) + field("期限", input("due_date", "date", todayStr())) + field("優先度", `<select name="priority">${options(["高", "中", "低"], "中")}</select>`), async (data) => {
    // 先にタスクを保存。再操作時も source_id を使って重複を防ぐ。
    const existing = rows("tasks").find((task) => task.source_id === row.id);
    const task = existing || await api("/api/tasks", { method: "POST", body: { ...data, dept: row.dept, status: "未着手", project_id: "", source_id: row.id } });
    await api(`/api/${table}/${row.id}`, { method: "PATCH", body: { task_id: task.id } });
  });
}
export function taskDetail(id) { const task = rows("tasks").find((row) => row.id === id); if (!task) return; modal(task.title, `<p>${esc(task.dept)} · ${esc(member(task.assignee_id))}</p>` + field("期限", input("due_date", "date", task.due_date)) + field("優先度", `<select name="priority">${options(["高", "中", "低"], task.priority)}</select>`) + field("状態", `<select name="status">${options(["未着手", "進行", "完了"], task.status)}</select>`), (data) => api(`/api/tasks/${id}`, { method: "PATCH", body: { ...data, completed_at: data.status === "完了" ? new Date().toISOString() : null } })); }
const views = [renderPolicy, renderKikaku, renderKoho, renderEngineer, renderJimu, renderYakuin];
export async function render() {
  const route = location.hash.slice(1) || "/";
  document.querySelectorAll("#nav a").forEach((link) => { const active = link.getAttribute("href") === `#${route}`; link.classList.toggle("is-active", active); if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current"); });
  const el = document.querySelector("#app");
  const index = slugs.indexOf(route.slice(1));
  try { if (route === "/") await renderHome(el); else if (index >= 0) await views[index](el); else el.innerHTML = heading("ページが見つかりません", "ナビゲーションから部門を選んでください。") + '<a class="button" href="#/">ポータルへ</a>'; document.title = `${index >= 0 ? DEPTS[index] : "運営ポータル"} | 学生チーム`; } catch (error) { el.textContent = error.message; }
}
function boot() {
  state.users = rows("members"); state.me = state.users[0];
  const select = document.querySelector("#member"); select.innerHTML = members(state.me.id); select.onchange = () => { state.me = state.users.find((user) => user.id === select.value); render(); };
  document.querySelector("#nav").innerHTML = `<a href="#/">${ico("chart")}ポータル</a>` + DEPTS.map((dept, i) => `<a href="#/${slugs[i]}">${esc(dept)}</a>`).join("");
  window.addEventListener("hashchange", () => { const dialog = document.querySelector("#dialog"); if (dialog.open) dialog.close(); render(); });
  render(); if (getStorageError()) toast(getStorageError());
}
// 循環 import の初期化が完了してから起動する。
queueMicrotask(boot);
