import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "./Markdown.jsx";
import FileViewer from "./FileViewer.jsx";
import {
  getRepo, listBranches, getLanguages, getReadme, getTree, listCommits,
  isStarred, starRepo, unstarRepo, createBranch, deleteBranch, updateRepo,
  getFile, upsertFile, strToBase64, downloadRepoZip, triggerBlobDownload, deployUrls,
} from "../lib/github.js";
import { getToken } from "../lib/storage.js";
import { langColor, timeAgo, fmtDate, fmtSize, fmtNum, shortSha } from "../lib/format.js";
import { playClick, playSuccess, playError } from "../lib/sfx.js";

const TABS = [
  { id: "overview", icon: "📊", label: "Ringkasan" },
  { id: "files", icon: "📂", label: "File" },
  { id: "commits", icon: "🕘", label: "Commit" },
  { id: "branches", icon: "🌿", label: "Branch" },
];

/** Drawer detail repo full-screen */
export default function RepoDetail({ repo: initial, showToast, onClose, onEdit, onDelete, onChanged }) {
  const [tab, setTab] = useState("overview");
  const [repo, setRepo] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [curBranch, setCurBranch] = useState(initial.default_branch || "main");
  const [languages, setLanguages] = useState(null);
  const [readme, setReadme] = useState(null);
  const [readmeLoading, setReadmeLoading] = useState(false);
  const [starred, setStarred] = useState(false);
  const [starCount, setStarCount] = useState(initial.stargazers_count || 0);
  const [zipping, setZipping] = useState(false);

  // Files tab
  const [tree, setTree] = useState(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [fileQuery, setFileQuery] = useState("");
  const [viewFile, setViewFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPrefix, setUploadPrefix] = useState("");
  const fileInput = useRef(null);

  // Commits tab
  const [commits, setCommits] = useState(null);
  const [commitsLoading, setCommitsLoading] = useState(false);

  // Branches tab
  const [newBranch, setNewBranch] = useState("");
  const [branchBusy, setBranchBusy] = useState("");

  const owner = repo.owner.login;

  /* ---------- load overview ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const token = getToken();
      setLoading(true);
      try {
        const [full, brs, langs, star] = await Promise.all([
          getRepo(token, owner, initial.name).catch(() => initial),
          listBranches(token, owner, initial.name).catch(() => []),
          getLanguages(token, owner, initial.name).catch(() => ({})),
          isStarred(token, owner, initial.name).catch(() => false),
        ]);
        if (!alive) return;
        setRepo(full);
        setBranches(brs);
        if (full.default_branch) setCurBranch(full.default_branch);
        setLanguages(langs);
        setStarred(star);
        setStarCount(full.stargazers_count || 0);
      } catch (e) {
        if (alive) showToast({ type: "error", message: e.message });
      } finally {
        if (alive) setLoading(false);
      }
      // README terpisah (boleh gagal)
      setReadmeLoading(true);
      try {
        const rm = await getReadme(token, owner, initial.name, initial.default_branch);
        if (alive) setReadme(rm);
      } catch {}
      if (alive) setReadmeLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.full_name]);

  /* ---------- load tree ---------- */
  async function loadTree(branch) {
    setTreeLoading(true);
    try {
      const t = await getTree(getToken(), owner, repo.name, branch);
      setTree(t);
    } catch (e) {
      showToast({ type: "error", message: "Gagal memuat file: " + e.message });
      setTree(null);
    } finally {
      setTreeLoading(false);
    }
  }

  /* ---------- load commits ---------- */
  async function loadCommits(branch) {
    setCommitsLoading(true);
    try {
      const c = await listCommits(getToken(), owner, repo.name, branch, 30);
      setCommits(c);
    } catch (e) {
      showToast({ type: "error", message: "Gagal memuat commit: " + e.message });
    } finally {
      setCommitsLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "files" && !tree && !treeLoading) loadTree(curBranch);
    if (tab === "commits" && !commits && !commitsLoading) loadCommits(curBranch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function switchBranch(b) {
    setCurBranch(b);
    setTree(null);
    setCommits(null);
    setExpanded(new Set());
    if (tab === "files") loadTree(b);
    if (tab === "commits") loadCommits(b);
  }

  /* ---------- file tree builder ---------- */
  const fileRows = useMemo(() => {
    if (!tree?.tree) return [];
    const blobs = tree.tree.filter((t) => t.type === "blob");
    const dirs = new Set();
    blobs.forEach((b) => {
      const segs = b.path.split("/");
      for (let i = 1; i < segs.length; i++) dirs.add(segs.slice(0, i).join("/"));
    });
    let entries = [
      ...[...dirs].map((d) => ({ type: "tree", path: d, size: 0 })),
      ...blobs,
    ].sort((a, b) => a.path.localeCompare(b.path));

    if (fileQuery.trim()) {
      const q = fileQuery.toLowerCase();
      return entries.filter((e) => e.type === "blob" && e.path.toLowerCase().includes(q));
    }
    // filter collapse
    return entries.filter((e) => {
      const segs = e.path.split("/");
      for (let i = 1; i < segs.length; i++) {
        if (!expanded.has(segs.slice(0, i).join("/"))) return false;
      }
      return true;
    });
  }, [tree, expanded, fileQuery]);

  function toggleDir(path) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  /* ---------- aksi ---------- */
  async function toggleStar() {
    playClick();
    try {
      const token = getToken();
      if (starred) {
        await unstarRepo(token, owner, repo.name);
        setStarred(false);
        setStarCount((c) => Math.max(0, c - 1));
      } else {
        await starRepo(token, owner, repo.name);
        setStarred(true);
        setStarCount((c) => c + 1);
        playSuccess();
      }
    } catch (e) {
      showToast({ type: "error", message: e.message });
    }
  }

  function copyClone() {
    const url = `git clone ${repo.clone_url}`;
    navigator.clipboard.writeText(url)
      .then(() => { playClick(); showToast({ type: "success", message: "Perintah clone disalin 📋" }); })
      .catch(() => showToast({ type: "error", message: "Gagal menyalin." }));
  }

  async function downloadZip() {
    setZipping(true);
    try {
      const blob = await downloadRepoZip(getToken(), owner, repo.name, curBranch);
      triggerBlobDownload(blob, `${repo.name}-${curBranch}.zip`);
      playSuccess();
      showToast({ type: "success", message: "ZIP diunduh ⬇️" });
    } catch (e) {
      playError();
      showToast({ type: "error", message: e.message });
    } finally {
      setZipping(false);
    }
  }

  async function handleCreateBranch() {
    const name = newBranch.trim().replace(/\s+/g, "-");
    if (!name) return;
    setBranchBusy(name);
    const src = branches.find((b) => b.name === curBranch) || branches[0];
    if (!src) {
      showToast({ type: "error", message: "Tidak ada branch sumber." });
      return;
    }
    try {
      await createBranch(getToken(), owner, repo.name, name, src.commit.sha);
      playSuccess();
      showToast({ type: "success", message: `Branch "${name}" dibuat dari ${curBranch} 🌿` });
      setNewBranch("");
      const brs = await listBranches(getToken(), owner, repo.name);
      setBranches(brs);
    } catch (e) {
      playError();
      showToast({ type: "error", message: e.message });
    } finally {
      setBranchBusy("");
    }
  }

  async function handleDeleteBranch(name) {
    if (!window.confirm(`Hapus branch "${name}"?`)) return;
    setBranchBusy(name);
    try {
      await deleteBranch(getToken(), owner, repo.name, name);
      playSuccess();
      showToast({ type: "success", message: `Branch "${name}" dihapus 🗑️` });
      const brs = await listBranches(getToken(), owner, repo.name);
      setBranches(brs);
      if (curBranch === name && repo.default_branch) switchBranch(repo.default_branch);
    } catch (e) {
      playError();
      showToast({ type: "error", message: e.message });
    } finally {
      setBranchBusy("");
    }
  }

  async function handleSetDefault(name) {
    setBranchBusy(name);
    try {
      const updated = await updateRepo(getToken(), owner, repo.name, { default_branch: name });
      setRepo(updated);
      playSuccess();
      showToast({ type: "success", message: `"${name}" kini default branch 🌿` });
      onChanged?.();
    } catch (e) {
      playError();
      showToast({ type: "error", message: e.message });
    } finally {
      setBranchBusy("");
    }
  }

  async function handleUploadPicked(e) {
    const picked = [...(e.target.files || [])];
    e.target.value = "";
    if (picked.length === 0) return;
    setUploading(true);
    const token = getToken();
    const prefix = uploadPrefix.trim().replace(/^\/+|\/+$/g, "");
    let ok = 0;
    for (const f of picked) {
      try {
        const buf = await f.arrayBuffer();
        let bin = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const target = prefix ? `${prefix}/${f.name}` : f.name;
        // cek sha lama (toleran jika file baru)
        let sha = null;
        try {
          const existing = await getFile(token, owner, repo.name, target, curBranch);
          sha = existing.sha;
        } catch {}
        await upsertFile(token, owner, repo.name, target, btoa(bin), curBranch, `⬆️ Upload ${target} via Zip2Repo`, sha);
        ok++;
      } catch (err) {
        showToast({ type: "error", message: `Gagal upload ${f.name}: ${err.message}` });
      }
    }
    setUploading(false);
    if (ok > 0) {
      playSuccess();
      showToast({ type: "success", message: `${ok} file ter-upload ke ${curBranch} ⬆️` });
      loadTree(curBranch);
    }
  }

  async function handleMakeReadme() {
    try {
      const content = `# ${repo.name}\n\n${repo.description || "Deskripsi repo..."}\n\n## Tentang\n\nRepo ini dikelola dengan Zip2Repo ⚡\n`;
      await upsertFile(getToken(), owner, repo.name, "README.md", strToBase64(content), curBranch, "📝 Tambah README via Zip2Repo");
      playSuccess();
      showToast({ type: "success", message: "README.md dibuat 📝" });
      setReadmeLoading(true);
      const rm = await getReadme(getToken(), owner, repo.name, curBranch);
      setReadme(rm);
      setReadmeLoading(false);
      if (tree) loadTree(curBranch);
    } catch (e) {
      playError();
      showToast({ type: "error", message: e.message });
    }
  }

  const langEntries = useMemo(() => {
    if (!languages) return [];
    const total = Object.values(languages).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(languages)
      .map(([lang, bytes]) => ({ lang, bytes, pct: (bytes / total) * 100 }))
      .sort((a, b) => b.bytes - a.bytes);
  }, [languages]);

  const dl = deployUrls(repo.html_url);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-3xl flex-col border-l border-white/10 bg-night-800/95 backdrop-blur-2xl animate-drawer-in">
        {/* Header */}
        <div className="border-b border-white/10 p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xl">{repo.private ? "🔒" : "🌍"}</span>
                <h2 className="truncate text-xl font-extrabold text-white md:text-2xl">{repo.name}</h2>
              </div>
              <a href={repo.html_url} target="_blank" rel="noreferrer" className="mt-1 block truncate font-mono text-xs text-cyan-300 hover:underline">
                {repo.full_name} ↗
              </a>
              {repo.description && <p className="mt-2 text-sm text-slate-400">{repo.description}</p>}
              {repo.topics?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {repo.topics.map((t) => (
                    <span key={t} className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] text-indigo-200">#{t}</span>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onClose} className="btn-ghost shrink-0 !px-3 !py-2">✕</button>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { playClick(); setTab(t.id); }}
                className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  tab === t.id ? "bg-gradient-to-r from-indigo-500/40 to-cyan-500/30 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto thin-scroll p-5 md:p-6">
          {loading ? (
            <div className="space-y-3">
              <div className="shimmer-line h-6 w-1/2" />
              <div className="shimmer-line h-4 w-full" />
              <div className="shimmer-line h-4 w-5/6" />
              <div className="grid grid-cols-4 gap-2 pt-2">
                {[1, 2, 3, 4].map((i) => <div key={i} className="shimmer-line h-16" />)}
              </div>
            </div>
          ) : (
            <>
              {/* ===== OVERVIEW ===== */}
              {tab === "overview" && (
                <div className="animate-fade-up space-y-5">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["⭐", fmtNum(starCount), "Stars"],
                      ["⑂", fmtNum(repo.forks_count), "Forks"],
                      ["👁️", fmtNum(repo.watchers_count), "Watchers"],
                      ["❗", fmtNum(repo.open_issues_count), "Issues"],
                    ].map(([icon, v, l]) => (
                      <div key={l} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
                        <p className="text-lg">{icon}</p>
                        <p className="text-xl font-extrabold text-white">{v}</p>
                        <p className="text-[11px] uppercase tracking-wider text-slate-500">{l}</p>
                      </div>
                    ))}
                  </div>

                  {/* Info */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[11px] uppercase tracking-wider text-slate-500">Bahasa utama</p>
                      <p className="mt-1 font-semibold text-white flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ background: langColor(repo.language) }} />
                        {repo.language || "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[11px] uppercase tracking-wider text-slate-500">Ukuran</p>
                      <p className="mt-1 font-semibold text-white">{repo.size != null ? fmtSize(repo.size * 1024) : "-"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[11px] uppercase tracking-wider text-slate-500">Dibuat</p>
                      <p className="mt-1 text-slate-200">{fmtDate(repo.created_at)}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[11px] uppercase tracking-wider text-slate-500">Update terakhir</p>
                      <p className="mt-1 text-slate-200">{timeAgo(repo.pushed_at)}</p>
                    </div>
                  </div>
                  {repo.homepage && (
                    <a href={repo.homepage} target="_blank" rel="noreferrer" className="block truncate rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm text-cyan-200 hover:bg-cyan-400/20 transition">
                      🔗 {repo.homepage} ↗
                    </a>
                  )}

                  {/* Bahasa */}
                  {langEntries.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-wider text-slate-500">Komposisi bahasa</p>
                      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-white/10">
                        {langEntries.map((l) => (
                          <span key={l.lang} style={{ width: `${l.pct}%`, background: langColor(l.lang) }} title={`${l.lang} ${l.pct.toFixed(1)}%`} />
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        {langEntries.slice(0, 6).map((l) => (
                          <span key={l.lang} className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: langColor(l.lang) }} />
                            {l.lang} <b className="text-slate-200">{l.pct.toFixed(1)}%</b>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Aksi cepat */}
                  <div>
                    <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">⚡ Aksi cepat</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <button onClick={toggleStar} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition active:scale-95 ${starred ? "border-amber-400/50 bg-amber-400/15 text-amber-200" : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.09]"}`}>
                        {starred ? "★ Unstar" : "☆ Star"}
                      </button>
                      <button onClick={copyClone} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.09] active:scale-95">
                        📋 Clone URL
                      </button>
                      <button onClick={downloadZip} disabled={zipping} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.09] active:scale-95 disabled:opacity-50">
                        {zipping ? "⏳..." : "⬇️ ZIP"}
                      </button>
                      <a href={dl.vercel} target="_blank" rel="noreferrer" className="rounded-xl border border-white/15 bg-white px-3 py-2.5 text-center text-sm font-bold text-black transition hover:bg-slate-200 active:scale-95">
                        ▲ Vercel
                      </a>
                      <a href={dl.netlify} target="_blank" rel="noreferrer" className="rounded-xl border border-cyan-400/40 bg-cyan-400/15 px-3 py-2.5 text-center text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/25 active:scale-95">
                        🌐 Netlify
                      </a>
                      <a href={dl.railway} target="_blank" rel="noreferrer" className="rounded-xl border border-violet-400/40 bg-violet-500/15 px-3 py-2.5 text-center text-sm font-bold text-violet-200 transition hover:bg-violet-500/25 active:scale-95">
                        🚂 Railway
                      </a>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button onClick={() => onEdit(repo)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.09] active:scale-95">
                        ✏️ Edit Repo
                      </button>
                      {!repo.archived && (
                        <button onClick={() => onDelete(repo)} className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 active:scale-95">
                          🗑️ Hapus Repo
                        </button>
                      )}
                    </div>
                  </div>

                  {/* README */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
                    <p className="mb-3 text-[11px] uppercase tracking-wider text-slate-500">📖 README</p>
                    {readmeLoading ? (
                      <div className="space-y-2">
                        <div className="shimmer-line h-4 w-3/4" />
                        <div className="shimmer-line h-4 w-full" />
                        <div className="shimmer-line h-4 w-2/3" />
                      </div>
                    ) : readme ? (
                      <Markdown text={readme.text} owner={owner} repo={repo.name} branch={curBranch} />
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm italic text-slate-500">Belum ada README di repo ini.</p>
                        <button onClick={handleMakeReadme} className="btn-primary mt-3 !py-2 text-sm">
                          ✨ Buatkan README Otomatis
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ===== FILES ===== */}
              {tab === "files" && (
                <div className="animate-fade-up space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={curBranch}
                      onChange={(e) => switchBranch(e.target.value)}
                      className="rounded-xl border border-white/10 bg-night-800 px-3 py-2 font-mono text-sm text-slate-200 outline-none"
                    >
                      {branches.map((b) => (
                        <option key={b.name} value={b.name} className="bg-night-800">🌿 {b.name}</option>
                      ))}
                    </select>
                    <input
                      value={fileQuery}
                      onChange={(e) => setFileQuery(e.target.value)}
                      placeholder="🔍 Cari file..."
                      className="input-field min-w-[140px] flex-1 !py-2"
                    />
                    <button onClick={() => loadTree(curBranch)} className="btn-ghost !py-2 text-sm" title="Muat ulang">🔄</button>
                  </div>

                  {/* Upload */}
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3">
                    <input
                      value={uploadPrefix}
                      onChange={(e) => setUploadPrefix(e.target.value)}
                      placeholder="folder/ (opsional)"
                      className="w-32 rounded-lg border border-white/10 bg-night-800 px-2.5 py-1.5 font-mono text-xs text-slate-200 outline-none"
                    />
                    <input ref={fileInput} type="file" multiple className="hidden" onChange={handleUploadPicked} />
                    <button
                      onClick={() => fileInput.current?.click()}
                      disabled={uploading}
                      className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50"
                    >
                      {uploading ? "⏳ Mengunggah..." : "⬆️ Upload file ke branch ini"}
                    </button>
                    <span className="text-[11px] text-slate-500">File ditimpa jika nama sama</span>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-white/10 bg-[#07070f]">
                    {treeLoading ? (
                      <div className="space-y-2 p-5">
                        <div className="shimmer-line h-4 w-2/3" />
                        <div className="shimmer-line h-4 w-1/2" />
                        <div className="shimmer-line h-4 w-3/4" />
                      </div>
                    ) : !tree ? (
                      <p className="p-6 text-center text-sm text-slate-500">Gagal memuat. Coba muat ulang 🔄</p>
                    ) : fileRows.length === 0 ? (
                      <p className="p-6 text-center text-sm text-slate-500">📭 Tidak ada file (atau tidak cocok dengan pencarian).</p>
                    ) : (
                      <ul className="max-h-[50vh] overflow-y-auto thin-scroll py-1 font-mono text-[13px]">
                        {fileRows.map((e) => {
                          const depth = e.path.split("/").length - 1;
                          const name = e.path.split("/").pop();
                          if (e.type === "tree") {
                            const open = expanded.has(e.path);
                            return (
                              <li key={e.path}>
                                <button
                                  onClick={() => toggleDir(e.path)}
                                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-amber-200/90 transition hover:bg-white/5"
                                  style={{ paddingLeft: `${12 + depth * 16}px` }}
                                >
                                  <span className="text-[10px] text-slate-500">{open ? "▼" : "▶"}</span>
                                  <span>{open ? "📂" : "📁"} {name}</span>
                                </button>
                              </li>
                            );
                          }
                          return (
                            <li key={e.path}>
                              <button
                                onClick={() => { playClick(); setViewFile(e.path); }}
                                className="group flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-300 transition hover:bg-indigo-500/15 hover:text-white"
                                style={{ paddingLeft: `${12 + depth * 16}px` }}
                              >
                                <span>📄</span>
                                <span className="flex-1 truncate">{fileQuery ? e.path : name}</span>
                                {e.size != null && <span className="text-[11px] text-slate-600">{fmtSize(e.size)}</span>}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {tree && (
                    <p className="text-xs text-slate-600">
                      {tree.tree.filter((t) => t.type === "blob").length} file · HEAD <code className="font-mono">{shortSha(tree.headSha)}</code>
                      {tree.truncated && <span className="ml-2 text-amber-300">⚠️ daftar dipotong (repo sangat besar)</span>}
                    </p>
                  )}
                </div>
              )}

              {/* ===== COMMITS ===== */}
              {tab === "commits" && (
                <div className="animate-fade-up space-y-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={curBranch}
                      onChange={(e) => switchBranch(e.target.value)}
                      className="rounded-xl border border-white/10 bg-night-800 px-3 py-2 font-mono text-sm text-slate-200 outline-none"
                    >
                      {branches.map((b) => (
                        <option key={b.name} value={b.name} className="bg-night-800">🌿 {b.name}</option>
                      ))}
                    </select>
                    <button onClick={() => loadCommits(curBranch)} className="btn-ghost !py-2 text-sm">🔄</button>
                  </div>
                  {commitsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4].map((i) => <div key={i} className="shimmer-line h-14" />)}
                    </div>
                  ) : !commits?.length ? (
                    <p className="rounded-xl border border-white/10 p-6 text-center text-sm text-slate-500">📭 Belum ada commit.</p>
                  ) : (
                    <ul className="space-y-2">
                      {commits.map((c) => (
                        <li key={c.sha}>
                          <a
                            href={c.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 transition hover:border-indigo-400/40 hover:bg-white/[0.06]"
                          >
                            <img
                              src={c.author?.avatar_url || `https://github.com/${c.commit.author?.name}.png`}
                              alt=""
                              className="h-9 w-9 rounded-full bg-white/10"
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-100">
                                {c.commit.message.split("\n")[0]}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {c.commit.author?.name} · {timeAgo(c.commit.author?.date)}
                              </p>
                            </div>
                            <code className="shrink-0 rounded-md bg-white/5 px-2 py-1 font-mono text-[11px] text-cyan-300">
                              {shortSha(c.sha)}
                            </code>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* ===== BRANCHES ===== */}
              {tab === "branches" && (
                <div className="animate-fade-up space-y-3">
                  <div className="flex gap-2">
                    <input
                      value={newBranch}
                      onChange={(e) => setNewBranch(e.target.value)}
                      placeholder={`Branch baru dari ${curBranch}...`}
                      className="input-field flex-1 !py-2 font-mono"
                      spellCheck={false}
                    />
                    <button
                      onClick={handleCreateBranch}
                      disabled={!newBranch.trim() || !!branchBusy}
                      className="btn-primary whitespace-nowrap !py-2 text-sm disabled:opacity-50"
                    >
                      ＋ Buat
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {branches.map((b) => {
                      const isDefault = b.name === repo.default_branch;
                      const busy = branchBusy === b.name;
                      return (
                        <li
                          key={b.name}
                          className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                            b.name === curBranch ? "border-indigo-400/50 bg-indigo-500/10" : "border-white/5 bg-white/[0.03]"
                          }`}
                        >
                          <span className="text-lg">🌿</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-sm font-semibold text-slate-100">
                              {b.name}
                              {isDefault && (
                                <span className="ml-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 font-sans text-[10px] text-emerald-300">default</span>
                              )}
                              {b.protected && (
                                <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-sans text-[10px] text-slate-400">🛡️ protected</span>
                              )}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-slate-500">{shortSha(b.commit.sha)}</p>
                          </div>
                          {busy ? (
                            <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-indigo-300 animate-spin" />
                          ) : (
                            <span className="flex shrink-0 gap-1.5">
                              {b.name !== curBranch && (
                                <button onClick={() => switchBranch(b.name)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[0.1]" title="Lihat branch ini">
                                  👁️
                                </button>
                              )}
                              {!isDefault && (
                                <button onClick={() => handleSetDefault(b.name)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[0.1]" title="Jadikan default">
                                  ⭐
                                </button>
                              )}
                              {!isDefault && (
                                <button onClick={() => handleDeleteBranch(b.name)} className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] hover:bg-rose-500/25" title="Hapus branch">
                                  🗑️
                                </button>
                              )}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {branches.length === 0 && (
                    <p className="rounded-xl border border-white/10 p-6 text-center text-sm text-slate-500">Tidak ada branch.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-3 text-center">
          <p className="text-[11px] text-slate-600">
            Zip2Repo · {repo.full_name} · branch <code className="font-mono text-slate-500">{curBranch}</code>
          </p>
        </div>
      </aside>

      {/* File viewer overlay */}
      {viewFile && (
        <FileViewer
          owner={owner}
          repo={repo.name}
          branch={curBranch}
          path={viewFile}
          showToast={showToast}
          onClose={() => setViewFile(null)}
          onDeleted={() => loadTree(curBranch)}
        />
      )}
    </div>
  );
}
