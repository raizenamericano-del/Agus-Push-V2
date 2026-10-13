import { langColor, timeAgo, fmtNum } from "../lib/format.js";
import { playClick } from "../lib/sfx.js";

export default function RepoCard({
  repo,
  index = 0,
  selectMode,
  selected,
  onToggleSelect,
  onOpen,
  onEdit,
  onDelete,
}) {
  return (
    <div
      onClick={() => (selectMode ? onToggleSelect(repo) : (playClick(), onOpen(repo)))}
      className={`group relative cursor-pointer glass p-5 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400/40 hover:shadow-[0_12px_44px_rgba(99,102,241,0.25)] animate-fade-up ${
        selected ? "!border-indigo-400/70 ring-2 ring-indigo-500/30" : ""
      }`}
      style={{ animationDelay: `${Math.min(index, 11) * 0.05}s` }}
    >
      {/* Checkbox mode pilih */}
      {selectMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(repo); }}
          className={`absolute right-4 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-md border-2 transition ${
            selected ? "border-indigo-400 bg-indigo-500 text-white" : "border-white/20 bg-black/40 text-transparent"
          }`}
        >
          ✓
        </button>
      )}

      {/* Nama + badge */}
      <div className={`flex items-start gap-2 ${selectMode ? "pr-8" : ""}`}>
        <span className="text-xl">{repo.private ? "🔒" : "🌍"}</span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold text-white group-hover:text-cyan-300 transition">
            {repo.name}
          </h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${repo.private ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"}`}>
              {repo.private ? "Private" : "Public"}
            </span>
            {repo.fork && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">⑂ Fork</span>
            )}
            {repo.archived && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">📦 Archived</span>
            )}
          </div>
        </div>
      </div>

      {/* Deskripsi */}
      <p className="mt-3 min-h-[2.5rem] text-sm text-slate-400 line-clamp-2">
        {repo.description || <span className="italic text-slate-600">Tidak ada deskripsi</span>}
      </p>

      {/* Meta */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        {repo.language && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: langColor(repo.language) }} />
            {repo.language}
          </span>
        )}
        <span>⭐ {fmtNum(repo.stargazers_count)}</span>
        <span>⑂ {fmtNum(repo.forks_count)}</span>
        <span className="ml-auto">🕘 {timeAgo(repo.pushed_at)}</span>
      </div>

      {/* Aksi */}
      <div className="mt-4 flex gap-2 border-t border-white/5 pt-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => { playClick(); onOpen(repo); }}
          className="flex-1 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-2 py-1.5 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/25"
        >
          📂 Detail
        </button>
        <a
          href={repo.html_url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.1]"
          title="Buka di GitHub"
        >
          ↗
        </a>
        <button
          onClick={() => onEdit(repo)}
          className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs transition hover:bg-white/[0.1]"
          title="Edit repo"
        >
          ✏️
        </button>
        {!repo.archived && (
          <button
            onClick={() => onDelete(repo)}
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs transition hover:bg-rose-500/25"
            title="Hapus repo"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}
