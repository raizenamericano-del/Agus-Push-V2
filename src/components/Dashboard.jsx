import { useEffect, useMemo, useRef, useState } from "react";
import RepoCard from "./RepoCard.jsx";
import RepoDetail from "./RepoDetail.jsx";
import EditRepoModal from "./EditRepoModal.jsx";
import DeleteRepoModal from "./DeleteRepoModal.jsx";
import EmptyState from "./EmptyState.jsx";
import { RepoCardSkeleton } from "./Skeleton.jsx";
import { listRepos } from "../lib/github.js";
import { getToken, canDelete } from "../lib/storage.js";
import { langColor, topLanguages, fmtNum, reposToCSV, downloadTextFile } from "../lib/format.js";
import { playClick, playSuccess } from "../lib/sfx.js";

const FILTERS = [
  { id: "all", label: "🌐 Semua" },
  { id: "public", label: "🌍 Public" },
  { id: "private", label: "🔒 Private" },
  { id: "fork", label: "⑂ Fork" },
  { id: "archived", label: "📦 Archived" },
];

const SORTS = [
  { id: "updated", label: "🕘 Terbaru update" },
  { id: "pushed", label: "🚀 Terbaru push" },
  { id: "created", label: "✨ Terbaru dibuat" },
  { id: "stars", label: "⭐ Paling berbintang" },
  { id: "name", label: "🔤 Nama A–Z" },
];

const PAGE = 12;

export default function Dashboard({ user, showToast, onTokenInvalid, goUpload }) {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("updated");
  const [visible, setVisible] = useState(PAGE);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [detail, setDetail] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTargets, setDeleteTargets] = useState(null);
  const searchRef = useRef(null);

  const deleteScope = canDelete(); // true | false | null(unknown)

  async function load(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await listRepos(getToken());
      setRepos(data);
    } catch (e) {
      showToast({ type: "error", message: e.message });
      if (e.status === 401) onTokenInvalid();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ctrl+K / tombol search di navbar → fokus ke pencarian dashboard
  useEffect(() => {
    const fn = () => searchRef.current?.focus();
    window.addEventListener("z2r-focus-search", fn);
    return () => window.removeEventListener("z2r-focus-search", fn);
  }, []);

  useEffect(() => {
    setVisible(PAGE);
  }, [search, filter, sort]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = repos.filter((r) => {
      if (filter === "public" && r.private) return false;
      if (filter === "private" && !r.private) return false;
      if (filter === "fork" && !r.fork) return false;
      if (filter === "archived" && !r.archived) return false;
      if (q) {
        const hay = `${r.name} ${r.full_name} ${r.description || ""} ${r.language || ""} ${(r.topics || []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const by = {
      pushed: (a, b) => new Date(b.pushed_at) - new Date(a.pushed_at),
      created: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      stars: (a, b) => b.stargazers_count - a.stargazers_count,
      name: (a, b) => a.name.localeCompare(b.name),
      updated: (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
    }[sort];
    return [...list].sort(by);
  }, [repos, search, filter, sort]);

  const stats = useMemo(() => {
    const stars = repos.reduce((a, r) => a + (r.stargazers_count || 0), 0);
    const forks = repos.reduce((a, r) => a + (r.forks_count || 0), 0);
    const priv = repos.filter((r) => r.private).length;
    return { total: repos.length, stars, forks, priv, langs: topLanguages(repos) };
  }, [repos]);

  function toggleSelect(repo) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(repo.full_name)) next.delete(repo.full_name);
      else next.add(repo.full_name);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function afterDeleted(deletedNames) {
    if (deletedNames?.length) {
      setRepos((rs) => rs.filter((r) => !deletedNames.includes(r.full_name)));
      setSelected(new Set());
      if (deleteTargets?.length > 1) exitSelectMode();
      if (detail && deletedNames.includes(detail.full_name)) setDetail(null);
    }
  }

  function afterSaved(updated) {
    setRepos((rs) => rs.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
    if (detail && detail.id === updated.id) setDetail({ ...detail, ...updated });
  }

  function exportCSV() {
    playClick();
    downloadTextFile(`zip2repo-repos-${user?.login || "export"}.csv`, reposToCSV(filtered), "text/csv");
    showToast({ type: "success", message: `📊 ${filtered.length} repo diekspor ke CSV.` });
    playSuccess();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      {/* Header + stats */}
      <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <h1 className="text-2xl font-extrabold text-white md:text-3xl">
            📚 Repo <span className="gradient-text">Saya</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Kelola semua repository <b className="text-white">@{user?.login}</b> — detail, edit, hapus, unduh, deploy.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load(true)} disabled={refreshing} className="btn-ghost text-sm disabled:opacity-50">
            <span className={refreshing ? "inline-block animate-spin" : ""}>🔄</span> {refreshing ? "..." : "Refresh"}
          </button>
          <button onClick={exportCSV} disabled={repos.length === 0} className="btn-ghost text-sm disabled:opacity-50">
            📊 CSV
          </button>
          {!selectMode ? (
            <button
              onClick={() => { playClick(); setSelectMode(true); }}
              disabled={repos.length === 0}
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
              title="Pilih banyak repo untuk dihapus sekaligus"
            >
              ☑️ Pilih
            </button>
          ) : (
            <button onClick={exitSelectMode} className="btn-ghost text-sm">✕ Batal</button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      {!loading && repos.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-2 animate-fade-up [animation-delay:.05s] sm:grid-cols-4">
          {[
            ["📦", stats.total, "Total repo"],
            ["⭐", fmtNum(stats.stars), "Total stars"],
            ["⑂", fmtNum(stats.forks), "Total forks"],
            ["🔒", stats.priv, "Private"],
          ].map(([icon, v, l]) => (
            <div key={l} className="glass flex items-center gap-3 p-3.5">
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-xl font-extrabold leading-none text-white">{v}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">{l}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bahasa teratas */}
      {!loading && stats.langs.length > 0 && (
        <div className="glass mt-3 p-4 animate-fade-up [animation-delay:.1s]">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">💻 Bahasa teratas</p>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-white/10">
            {stats.langs.map((l) => {
              const total = stats.langs.reduce((a, b) => a + b.count, 0);
              return (
                <span
                  key={l.lang}
                  style={{ width: `${(l.count / total) * 100}%`, background: langColor(l.lang) }}
                  title={`${l.lang}: ${l.count} repo`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            {stats.langs.map((l) => (
              <span key={l.lang} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: langColor(l.lang) }} />
                {l.lang} <b className="text-slate-200">{l.count}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Warning scope hapus */}
      {deleteScope === false && (
        <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200 animate-fade-up">
          ⚠️ Token kamu <b>tidak punya scope <code className="font-mono">delete_repo</code></b>, jadi tombol hapus
          dikunci. Buat token baru dengan scope <b>repo + delete_repo</b> lalu ganti di Settings ⚙️
        </div>
      )}

      {/* Toolbar: search + filter + sort */}
      <div className="sticky top-[57px] z-20 -mx-4 mt-6 bg-night-900/85 px-4 py-3 backdrop-blur-xl animate-fade-up [animation-delay:.15s]">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Cari repo, deskripsi, bahasa, topik... (Ctrl+K)"
              className="input-field !py-2.5 pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-xl border border-white/10 bg-night-800 px-3 py-2.5 text-sm text-slate-200 outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id} className="bg-night-800">{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => { playClick(); setFilter(f.id); }}
              className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                filter === f.id
                  ? "border-indigo-400/60 bg-indigo-500/25 text-white shadow-[0_0_12px_rgba(99,102,241,0.35)]"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto shrink-0 self-center text-xs text-slate-500">
            {filtered.length} repo
          </span>
        </div>
      </div>

      {/* Bulk bar */}
      {selectMode && selected.size > 0 && (
        <div className="sticky top-[148px] z-20 mt-3 flex items-center gap-3 rounded-2xl border border-rose-500/40 bg-night-800/95 px-4 py-3 shadow-[0_8px_30px_rgba(244,63,94,0.25)] backdrop-blur-xl animate-pop-in">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 font-bold text-white">
            {selected.size}
          </span>
          <p className="flex-1 text-sm text-slate-200">repo dipilih</p>
          <button
            onClick={() => setSelected(new Set(filtered.map((r) => r.full_name)))}
            className="text-xs text-slate-400 underline underline-offset-2 hover:text-white"
          >
            Pilih semua ({filtered.length})
          </button>
          <button
            onClick={() => {
              const targets = repos.filter((r) => selected.has(r.full_name));
              setDeleteTargets(targets);
            }}
            disabled={deleteScope === false}
            className="rounded-xl bg-gradient-to-r from-rose-600 to-red-500 px-4 py-2 text-sm font-bold text-white transition hover:shadow-[0_0_20px_rgba(244,63,94,0.5)] active:scale-95 disabled:opacity-40"
            title={deleteScope === false ? "Butuh scope delete_repo" : "Hapus repo terpilih"}
          >
            🗑️ Hapus ({selected.size})
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="mt-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <RepoCardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          repos.length === 0 ? (
            <EmptyState
              icon="📭"
              title="Belum ada repository"
              desc="Akun GitHub kamu belum punya repo. Yuk buat yang pertama dari ZIP atau template!"
              action={<button onClick={goUpload} className="btn-primary">🚀 Buat Repo Sekarang</button>}
            />
          ) : (
            <EmptyState
              icon="🔍"
              title="Tidak ketemu"
              desc={`Tidak ada repo yang cocok dengan "${search}" ${filter !== "all" ? `+ filter ${filter}` : ""}.`}
              action={<button onClick={() => { setSearch(""); setFilter("all"); }} className="btn-ghost">Reset pencarian</button>}
            />
          )
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.slice(0, visible).map((r, i) => (
                <RepoCard
                  key={r.id}
                  repo={r}
                  index={i % PAGE}
                  selectMode={selectMode}
                  selected={selected.has(r.full_name)}
                  onToggleSelect={toggleSelect}
                  onOpen={setDetail}
                  onEdit={setEditTarget}
                  onDelete={(t) => setDeleteTargets([t])}
                />
              ))}
            </div>
            {visible < filtered.length && (
              <div className="mt-8 text-center">
                <button onClick={() => setVisible((v) => v + PAGE)} className="btn-ghost">
                  Tampilkan lebih banyak ({filtered.length - visible} lagi) ⬇️
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Overlays */}
      {detail && (
        <RepoDetail
          repo={detail}
          showToast={showToast}
          onClose={() => setDetail(null)}
          onEdit={(r) => setEditTarget(r)}
          onDelete={(r) => setDeleteTargets([r])}
          onChanged={() => load(true)}
        />
      )}
      {editTarget && (
        <EditRepoModal
          repo={editTarget}
          showToast={showToast}
          onClose={() => setEditTarget(null)}
          onSaved={afterSaved}
        />
      )}
      {deleteTargets && (
        <DeleteRepoModal
          targets={deleteTargets}
          showToast={showToast}
          onClose={() => setDeleteTargets(null)}
          onDeleted={afterDeleted}
        />
      )}
    </div>
  );
}
