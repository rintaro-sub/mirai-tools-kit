import { rows, esc, heading, members, member, options, field, input, modal, api, statusSelect, bindStatuses, due, empty, state } from "../app.js";
let filter = "すべて";
const statuses = ["立案", "進行", "レビュー", "完了"];
export function renderKikaku(el) {
  const projects = rows("projects", "企画").filter((p) => filter === "すべて" || p.status === filter);
  el.innerHTML = heading("企画", "アイデアから開催まで、担当と次の一歩を明確に。") + `<div class="board-tools"><div class="tabs" aria-label="ステータスで絞り込み">${["すべて", ...statuses].map((s) => `<button aria-pressed="${s === filter}" data-filter="${s}">${s}</button>`).join("")}</div><button class="primary" id="new-project">＋ 新規企画</button></div><div class="card-grid">${projects.map((p) => `<article class="card pj-card"><h2>${esc(p.title)}</h2><p>${esc(p.description)}</p><div class="meta">担当 ${esc(member(p.assignee_id))}${due(p.due_date, p.status === "完了")}</div>${statusSelect("projects", p, statuses)}</article>`).join("") || empty()}</div>`;
  el.querySelectorAll("[data-filter]").forEach((button) => { button.onclick = () => { filter = button.dataset.filter; renderKikaku(el); }; });
  el.querySelector("#new-project").onclick = () => modal("新規企画", field("企画名", input("title")) + field("説明", '<textarea name="description" required rows="4"></textarea>') + field("担当", `<select name="assignee_id">${members(state.me.id)}</select>`) + field("期限", input("due_date", "date")), (data) => api("/api/projects", { method: "POST", body: { ...data, dept: "企画", status: "立案" } }));
  bindStatuses(el);
}
