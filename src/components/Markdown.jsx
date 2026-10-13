import { useMemo } from "react";

/** Mini Markdown renderer tanpa dependency (cukup untuk README).
 *  Mendukung: heading, bold, italic, inline code, code fence,
 *  link, image (relative → raw.githubusercontent), list, quote, hr, tabel sederhana.
 */

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineMd(s) {
  let out = escapeHtml(s);
  // image ![alt](url)
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, alt, url) => {
    const u = url.startsWith("http") ? url : `__RELIMG__${url}`;
    return `<img src="${u}" alt="${alt}" loading="lazy" class="md-img" />`;
  });
  // link [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, t, url) => {
    const u = url.startsWith("http") || url.startsWith("#") || url.startsWith("mailto:") ? url : `__REL__${url}`;
    return `<a href="${u}" target="_blank" rel="noreferrer" class="md-link">${t}</a>`;
  });
  // inline code `x`
  out = out.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
  // bold **x** dan __x__
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // italic *x* dan _x_
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>").replace(/\b_([^_\n]+)_\b/g, "<em>$1</em>");
  // strikethrough ~~x~~
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return out;
}

function renderMarkdown(src, rawBase, blobBase) {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let i = 0;
  let inCode = false;
  let codeLang = "";
  let codeBuf = [];
  let inUl = false;
  let inOl = false;
  let inQuote = false;

  const closeLists = () => {
    if (inUl) { html += "</ul>"; inUl = false; }
    if (inOl) { html += "</ol>"; inOl = false; }
    if (inQuote) { html += "</blockquote>"; inQuote = false; }
  };

  const isTableSep = (l) => /^\s*\|?[\s:|-]+\|[\s:|-]*\|?\s*$/.test(l) && l.includes("-");

  while (i < lines.length) {
    const line = lines[i];

    // code fence
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      if (!inCode) {
        closeLists();
        inCode = true;
        codeLang = fence[1] || "";
        codeBuf = [];
      } else {
        inCode = false;
        html += `<pre class="md-pre"><div class="md-pre-lang">${escapeHtml(codeLang || "code")}</div><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`;
      }
      i++;
      continue;
    }
    if (inCode) { codeBuf.push(line); i++; continue; }

    // tabel sederhana
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      closeLists();
      const parseRow = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => inlineMd(c.trim()));
      const head = parseRow(line);
      html += '<div class="md-table-wrap"><table class="md-table"><thead><tr>' + head.map((c) => `<th>${c}</th>`).join("") + "</tr></thead><tbody>";
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        const cells = parseRow(lines[i]);
        html += "<tr>" + cells.map((c) => `<td>${c}</td>`).join("") + "</tr>";
        i++;
      }
      html += "</tbody></table></div>";
      continue;
    }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeLists();
      const lvl = h[1].length;
      html += `<h${lvl} class="md-h${lvl}">${inlineMd(h[2])}</h${lvl}>`;
      i++;
      continue;
    }

    // hr
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      closeLists();
      html += '<hr class="md-hr" />';
      i++;
      continue;
    }

    // quote
    const q = line.match(/^>\s?(.*)$/);
    if (q) {
      if (inUl || inOl) closeLists();
      if (!inQuote) { html += '<blockquote class="md-quote">'; inQuote = true; }
      html += `<p>${inlineMd(q[1])}</p>`;
      i++;
      continue;
    } else if (inQuote) { html += "</blockquote>"; inQuote = false; }

    // ul
    const ul = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (ul) {
      if (inOl) { html += "</ol>"; inOl = false; }
      if (!inUl) { html += '<ul class="md-ul">'; inUl = true; }
      const task = ul[2].match(/^\[([ xX])\]\s+(.*)$/);
      if (task) {
        html += `<li class="md-li">${task[1].toLowerCase() === "x" ? "☑" : "☐"} ${inlineMd(task[2])}</li>`;
      } else {
        html += `<li class="md-li">${inlineMd(ul[2])}</li>`;
      }
      i++;
      continue;
    }

    // ol
    const ol = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
    if (ol) {
      if (inUl) { html += "</ul>"; inUl = false; }
      if (!inOl) { html += '<ol class="md-ol">'; inOl = true; }
      html += `<li class="md-li">${inlineMd(ol[2])}</li>`;
      i++;
      continue;
    }

    if (line.trim() === "") { closeLists(); i++; continue; }

    closeLists();
    html += `<p class="md-p">${inlineMd(line)}</p>`;
    i++;
  }
  closeLists();
  if (inCode) {
    html += `<pre class="md-pre"><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`;
  }

  // resolve relative URL
  if (rawBase) html = html.split("__RELIMG__").join(rawBase);
  if (blobBase) html = html.split("__REL__").join(blobBase);
  return html;
}

export default function Markdown({ text, owner, repo, branch = "main" }) {
  const html = useMemo(() => {
    if (!text) return "";
    const rawBase = owner && repo ? `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/` : "";
    const blobBase = owner && repo ? `https://github.com/${owner}/${repo}/blob/${branch}/` : "";
    return renderMarkdown(text, rawBase, blobBase);
  }, [text, owner, repo, branch]);

  if (!text) return <p className="text-sm text-slate-500 italic">Tidak ada README.</p>;
  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
}
