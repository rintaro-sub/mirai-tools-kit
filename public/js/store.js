// ローカル保存を担当するデータ層。画面は api() を通じて読み書きする。
export const KEY = "mirai.portal.store";
export const DEPTS = ["政策立案", "企画", "広報", "エンジニア", "事務局", "役員会"];
const TABLES = ["members", "projects", "tasks", "meetings", "documents", "agendas", "approvals", "minutes", "issues", "faqs", "notices"];
const date = (offset = 0) => new Date(Date.now() + 9 * 3600000 + offset * 86400000).toISOString().slice(0, 10);
const now = () => new Date().toISOString();
function seed() {
  const data = { version: 1, ...Object.fromEntries(TABLES.map((key) => [key, []])) };
  const names = ["佐藤 葵", "高橋 陽", "田中 凛", "伊藤 悠", "山本 結", "中村 誠"];
  const subjects = [["通学費支援", "若者の政治参加", "学校の居場所", "奨学金制度"], ["新歓交流会", "政策勉強会", "地域対話イベント", "活動報告会"], ["新歓募集のお知らせ", "今週の活動レポート", "メンバー紹介", "政策提案の解説"], ["申込フォームの入力検証", "モバイル表示の改善", "読み上げラベルの修正", "データ出力機能"], ["新メンバー受入手順", "会計精算ガイド", "定例参加の案内", "名簿更新手順"], ["部門長との活動面談", "次期体制の検討", "予算配分の相談", "活動方針の確認"]];
  function add(table, dept, title, extra = {}) {
    const row = { id: `${table}-${data[table].length + 1}`, dept, title, status: "未着手", created_at: now(), updated_at: now(), ...extra };
    data[table].push(row); return row;
  }
  DEPTS.forEach((dept, i) => {
    const member = add("members", dept, names[i], { name: names[i], status: "在籍" });
    const project = add("projects", dept, `${dept}・11月運営改善`, { status: "進行", description: "担当と期限を揃え、定例で進捗を共有する。", assignee_id: member.id, due_date: date(7) });
    for (let j = 0; j < 4; j++) {
      add("tasks", dept, `${subjects[i][j]}の${["原案作成", "確認依頼", "資料整理", "振り返り"][j]}`, { assignee_id: j === 1 ? "members-1" : member.id, due_date: date(j - 1), priority: ["高", "中", "低"][j % 3], project_id: project.id, status: j === 3 ? "完了" : "未着手", completed_at: j === 3 ? now() : null });
      add("agendas", dept, subjects[i][j], { category: ["制度", "運営", "連携", "予算"][j], due_date: date(j + 2), status: j === 3 ? "決定" : "相談中", votes: {}, comments: [] });
    }
    add("meetings", dept, `${dept} 週次定例`, { date: date(-((new Date(`${date()}T00:00:00Z`).getUTCDay() + 6) % 7) + i), time: "20:00", project_id: project.id, attendees: [member.id], agenda_set: i % 2 === 0, materials_ready: i % 3 === 0, homework_count: i % 3, status: "予定" });
    add("notices", dept, `${dept}の週次報告を確認してください`, { status: "未読", read_by: [] });
    if (i === 1) subjects[i].forEach((title, j) => add("projects", dept, title, { description: "学生が参加しやすい時間と形式を検討し、開催準備を進める。", assignee_id: member.id, due_date: date(j + 3), status: ["立案", "進行", "レビュー", "完了"][j] }));
    if (i === 2) subjects[i].forEach((title, j) => add("documents", dept, title, { channel: ["X", "Instagram", "note", "X"][j], content: `${title}。活動の背景と参加方法をお届けします。`, publish_date: date(j), status: ["下書き", "レビュー", "承認", "公開予定"][j] }));
    if (i === 3) subjects[i].forEach((title, j) => add("issues", dept, title, { priority: ["高", "中", "低", "中"][j], assignee_id: member.id, labels: ["改善", "アクセシビリティ"], status: j === 3 ? "完了" : "未着手" }));
    if (i === 4) subjects[i].forEach((title) => { add("documents", dept, title, { category: "運営手順", content: "1. 担当者に連絡する\n2. 必要事項を確認する\n3. 定例で共有する", status: "公開" }); add("faqs", dept, `${title}はどこで確認できますか？`, { content: "事務局の文書一覧から確認できます。不明点は定例で担当者へご相談ください。", status: "公開" }); });
    if (i === 5) subjects[i].forEach((title) => add("minutes", dept, title, { date: date(-1), content: "活動負荷を確認。担当の偏りを次回定例で見直す。", attendees: [member.id], status: "未処理" }));
  });
  return data;
}
let db;
let storageError = "";
try {
  const raw = localStorage.getItem(KEY);
  db = raw ? JSON.parse(raw) : seed();
  if (db.version !== 1 || TABLES.some((key) => !Array.isArray(db[key]))) throw new Error("保存形式が異なります");
  if (!raw) localStorage.setItem(KEY, JSON.stringify(db));
} catch (error) { db = seed(); storageError = "保存データを利用できません。一時データで表示しています。元の保存内容は上書きしません。"; }
export function getStorageError() { return storageError; }
export function list(table) { if (!TABLES.includes(table)) throw new Error("不明なデータです"); return structuredClone(db[table]); }
export function mutate(table, id, body) {
  if (storageError) throw new Error("保存領域を利用できないため変更できません");
  const next = structuredClone(db);
  if (!TABLES.includes(table)) throw new Error("不明なデータです");
  let row;
  if (id) { row = next[table].find((item) => item.id === id); if (!row) throw new Error("データが見つかりません"); Object.assign(row, body, { id, updated_at: now() }); }
  else { row = { ...body, id: `${table}-${crypto.randomUUID()}`, created_at: now(), updated_at: now() }; if (!DEPTS.includes(row.dept) || !row.title?.trim() || !row.status) throw new Error("部門・タイトル・状態が必要です"); next[table].push(row); }
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { throw new Error("保存できません。ブラウザの空き容量・設定を確認してください"); }
  db = next; return structuredClone(row);
}
