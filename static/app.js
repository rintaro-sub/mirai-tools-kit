(() => {
  'use strict';
  const tools = [
    ['policy','政策立案ツール'],
    ['kikaku','企画ツール'],
    ['koho','広報ツール'],
    ['engineer','エンジニアツール'],
    ['jimu','事務局ツール'],
    ['yakuin','役員会ツール'],
  ];
  const app = document.getElementById('app');
  const h = (t, attrs, ...kids) => {
    const el = document.createElement(t);
    for (const [k,v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v; else el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat(Infinity).forEach(k => el.append(k.nodeType ? k : document.createTextNode(String(k))));
    return el;
  };
  const cards = tools.map(([slug,title]) => h('a', {class:'list-row', href:`./${slug}.html`, style:'text-decoration:none;color:inherit'}, h('div',{class:'grow'}, h('b',null,title), h('div',{class:'small muted'},'静的版の画面骨格')), h('span',{class:'chip'},'open')));
  app.append(h('div',{class:'card'}, cards));
})();
