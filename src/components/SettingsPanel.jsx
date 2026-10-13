import { useState } from "react";
import { getToken, setToken, clearToken, setUser, maskToken, getSettings, setSettings } from "../lib/storage.js";
import { apiValidateToken } from "../lib/github.js";
import { playClick } from "../lib/sfx.js";

export default function SettingsPanel({ open, onClose, user, onUserChange, onTokenCleared, showToast }) {
  const [newToken, setNewToken] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [prefs, setPrefs] = useState(getSettings());

  const token = getToken();
  const hasToken = !!token;

  function savePrefs(patch) {
    const next = setSettings(patch);
    setPrefs(next);
    playClick();
  }

  async function saveNew(e) {
    e.preventDefault();
    if (!newToken.trim()) return;
    setLoading(true);
    setError("");
    try {
      const u = await apiValidateToken(newToken.trim());
      setToken(newToken.trim());
      setUser(u);
      onUserChange(u);
      setNewToken("");
      showToast({ type: "success", message: `Token diperbarui. Halo @${u.login}! 👋` });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function remove() {
    clearToken();
    setConfirmDelete(false);
    showToast({ type: "success", message: "Token dihapus dari browser." });
    onTokenCleared();
  }

  const scopes = user?.scopes || [];
  const scopesKnown = scopes.length > 0;
  const hasRepo = user?.has_repo_scope;
  const hasDelete = user?.has_delete_scope;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-white/10 bg-night-800/95 shadow-2xl backdrop-blur-2xl transition-transform duration-500 [transition-timing-function:cubic-bezier(.22,1,.36,1)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="thin-scroll flex h-full flex-col overflow-y-auto p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold text-white">
              <span className="inline-block animate-spin-slow text-2xl">⚙️</span> Settings
            </h2>
            <button onClick={onClose} className="btn-ghost !px-3 !py-2">✕</button>
          </div>

          {/* Status token */}
          <div className="glass mt-6 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status Token</h3>
            <div className="mt-3 flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className={`absolute inline-flex h-full w-full rounded-full ${hasToken ? "animate-pulse-ring bg-emerald-400" : "bg-rose-400"}`} />
                <span className={`relative inline-flex h-3 w-3 rounded-full ${hasToken ? "bg-emerald-400" : "bg-rose-400"}`} />
              </span>
              <span className={`font-semibold ${hasToken ? "text-emerald-300" : "text-rose-300"}`}>
                {hasToken ? "Token tersimpan ✓" : "Belum ada token"}
              </span>
            </div>
            {hasToken && (
              <p className="mt-2 break-all font-mono text-sm text-slate-400">{maskToken(token)}</p>
            )}

            {/* Scope badges */}
            {hasToken && user && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
                  <span className="font-mono text-slate-300">repo <span className="text-slate-500">(wajib)</span></span>
                  {hasRepo ? <span className="font-bold text-emerald-300">✓ AKTIF</span>
                    : <span className="font-bold text-rose-300">✕ MATI</span>}
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
                  <span className="font-mono text-slate-300">delete_repo <span className="text-slate-500">(untuk hapus)</span></span>
                  {!scopesKnown ? <span className="font-bold text-amber-300">? UNKNOWN</span>
                    : hasDelete ? <span className="font-bold text-emerald-300">✓ AKTIF</span>
                      : <span className="font-bold text-rose-300">✕ MATI</span>}
                </div>
                {!scopesKnown && (
                  <p className="text-[11px] text-slate-500">
                    Izin tidak terdeteksi otomatis (kemungkinan fine-grained token). Fitur hapus akan dicoba langsung — jika gagal, buat token classic dengan scope <b>repo + delete_repo</b>.
                  </p>
                )}
                {scopesKnown && !hasDelete && (
                  <p className="text-[11px] text-amber-300/90">
                    ⚠️ Fitur hapus repo dikunci. Buat ulang token dengan scope <b>delete_repo</b> untuk membukanya.
                  </p>
                )}
              </div>
            )}

            {user && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.04] p-3">
                <img src={user.avatar_url} alt={user.login} className="h-10 w-10 rounded-full ring-2 ring-indigo-400/40" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{user.name || user.login}</p>
                  <a href={user.html_url} target="_blank" rel="noreferrer" className="text-xs text-cyan-300 hover:underline">
                    @{user.login}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Preferensi aplikasi */}
          <div className="glass mt-4 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">🎛️ Preferensi</h3>

            <label className="mt-4 block text-sm font-semibold text-slate-300">Visibilitas default repo baru</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                { v: "public", icon: "🌍", t: "Public" },
                { v: "private", icon: "🔒", t: "Private" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => savePrefs({ defaultVisibility: o.v })}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    prefs.defaultVisibility === o.v
                      ? "border-indigo-400/70 bg-indigo-500/15 text-white"
                      : "border-white/10 bg-white/[0.03] text-slate-400"
                  }`}
                >
                  {o.icon} {o.t}
                </button>
              ))}
            </div>

            <label className="mt-4 block text-sm font-semibold text-slate-300">Commit message default</label>
            <input
              value={prefs.commitMessage}
              onChange={(e) => savePrefs({ commitMessage: e.target.value })}
              className="input-field mt-2 !py-2 text-sm"
              maxLength={120}
            />

            <div className="mt-4 space-y-2">
              {[
                { k: "autoReadme", icon: "📝", t: "README otomatis", d: "Buat README.md jika ZIP tidak punya" },
                { k: "sound", icon: "🔊", t: "Efek suara", d: "Bunyi sukses / error / klik" },
              ].map((o) => (
                <button
                  key={o.k}
                  onClick={() => savePrefs({ [o.k]: !prefs[o.k] })}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
                >
                  <span className="text-xl">{o.icon}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-slate-200">{o.t}</span>
                    <span className="block text-[11px] text-slate-500">{o.d}</span>
                  </span>
                  <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${prefs[o.k] ? "bg-emerald-500" : "bg-white/15"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${prefs[o.k] ? "left-[22px]" : "left-0.5"}`} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Ganti token */}
          <form onSubmit={saveNew} className="glass mt-4 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ganti Token</h3>
            <div className="relative mt-3">
              <input
                type={show ? "text" : "password"}
                value={newToken}
                onChange={(e) => { setNewToken(e.target.value); setError(""); }}
                placeholder="Token baru: ghp_..."
                className="input-field pr-12 font-mono !py-2.5"
                autoComplete="off"
              />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                {show ? "🙈" : "👁️"}
              </button>
            </div>
            {error && <p className="mt-2 animate-pop-in text-sm text-rose-300">⚠️ {error}</p>}
            <button type="submit" disabled={loading || !newToken.trim()} className="btn-primary mt-4 w-full !py-2.5">
              {loading ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Memvalidasi...</>
              ) : (
                "Validasi & Ganti Token"
              )}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              Butuh scope <code className="font-mono text-slate-400">repo</code> (+ <code className="font-mono text-slate-400">delete_repo</code> untuk hapus)
            </p>
          </form>

          {/* Hapus token */}
          <div className="glass mt-4 border-rose-500/20 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Zona Berbahaya</h3>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={!hasToken}
                className="mt-3 w-full rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
              >
                🗑️ Hapus Token
              </button>
            ) : (
              <div className="mt-3 animate-pop-in">
                <p className="text-sm text-rose-200">Yakin hapus token dari browser ini?</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={remove} className="flex-1 rounded-xl bg-rose-500 px-4 py-2.5 font-semibold text-white transition hover:bg-rose-600 active:scale-95">
                    Ya, hapus
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="btn-ghost flex-1">Batal</button>
                </div>
              </div>
            )}
          </div>

          <p className="mt-auto pt-6 text-center text-xs text-slate-600">
            Zip2Repo v2.1 · Token hanya tersimpan di localStorage browser kamu.
          </p>
        </div>
      </aside>
    </>
  );
}
