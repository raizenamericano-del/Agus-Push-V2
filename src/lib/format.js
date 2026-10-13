/** Helper format kecil: ukuran file, waktu relatif, warna bahasa, dsb. */

export function fmtSize(bytes) {
  if (bytes == null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function timeAgo(iso) {
  if (!iso) return "-";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(1, Math.floor((now - then) / 1000));
  if (s < 60) return `${s} dtk lalu`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} hari lalu`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} bln lalu`;
  const y = Math.floor(mo / 12);
  return `${y} thn lalu`;
}

export function fmtDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function fmtNum(n) {
  if (n == null) return "0";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}jt`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}rb`;
  return `${n}`;
}

/* Warna dot bahasa pemrograman ala GitHub linguist */
const LANG_COLORS = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Go: "#00ADD8",
  Rust: "#dea584",
  PHP: "#4F5D95",
  Ruby: "#701516",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Shell: "#89e051",
  Dockerfile: "#384d54",
  "Jupyter Notebook": "#DA5B0B",
  R: "#198CE7",
  Lua: "#000080",
  Perl: "#0298c3",
  Haskell: "#5e5086",
  Elixir: "#6e4a7e",
  Scala: "#c22d40",
  Zig: "#ec915c",
  MDX: "#fcb32c",
};

export function langColor(lang) {
  if (!lang) return "#64748b";
  return LANG_COLORS[lang] || "#818cf8";
}

export function shortSha(sha) {
  return (sha || "").slice(0, 7);
}

export function truncate(str, n = 80) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

/** Kelompokkan bahasa dari daftar repo → [{lang, count}] teratas */
export function topLanguages(repos, limit = 6) {
  const map = {};
  repos.forEach((r) => {
    if (r.language) map[r.language] = (map[r.language] || 0) + 1;
  });
  return Object.entries(map)
    .map(([lang, count]) => ({ lang, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Ubah daftar repo menjadi CSV */
export function reposToCSV(repos) {
  const head = "name,full_name,url,private,language,stars,forks,open_issues,created_at,updated_at,description";
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = repos.map((r) =>
    [r.name, r.full_name, r.html_url, r.private, r.language || "", r.stargazers_count, r.forks_count, r.open_issues_count, r.created_at, r.updated_at, r.description || ""]
      .map(esc)
      .join(",")
  );
  return [head, ...rows].join("\n");
}

export function downloadTextFile(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
