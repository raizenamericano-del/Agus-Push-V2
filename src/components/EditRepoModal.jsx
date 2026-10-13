import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { updateRepo, updateTopics, listBranches } from "../lib/github.js";
import { getToken } from "../lib/storage.js";
import { playSuccess, playError } from "../lib/sfx.js";

const NAME_RE = /^[A-Za-z0-9_.-]{1,100}$/;

/** Modal edit repo: nama, deskripsi, homepage, visibility, topics, default branch */
export default function EditRepoModal({ repo, showToast, onClose, onSaved }) {
  const [name, setName] = useState(repo.name);
  const [description, setDescription] = useState(repo.description || "");
  const [homepage, setHomepage] = useState(repo.homepage || "");
  const [isPrivate, setIsPrivate] = useState(!!repo.private);
  const [topics, setTopics] = useState((repo.topics || []).join(", "));
  const [defaultBranch, setDefaultBranch] = useState(repo.default_branch || "main");
  const [branches, setBranches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listBranches(getToken(), repo.owner.login, repo.name)
      .then((b) => setBranches(b.map((x) => x.name)))
      .catch(() => {});
  }, [repo]);

  const nameValid = NAME_RE.test(name);

  async function save(e) {
    e.preventDefault();
    if (!nameValid || saving) return;
    setSaving(true);
    setError("");
    try {
      const token = getToken();
      const updated = await updateRepo(token, repo.owner.login, repo.name, {
        name: name.trim(),
        description: description.trim(),
        homepage: homepage.trim(),
        private: isPrivate,
        default_branch: defaultBranch || repo.default_branch,
      });
      const topicList = topics.split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean).slice(0, 20);
      try {
        await updateTopics(token, updated.owner.login, updated.name, topicList);
        updated.topics = topicList;
      } catch {}
      playSuccess();
      showToast({ type: "success", message: `Repo "${updated.full_name}" diperbarui ✏️` });
      onSaved?.(updated);
      onClose();
    } catch (err) {
      playError();
      setError(err.message || "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
        ✏️ Edit Repository
      </h2>
      <p className="mt-1 font-mono text-sm text-slate-500 break-all">{repo.full_name}</p>

      <form onSubmit={save} className="mt-5 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-300">📛 Nama repo</label>
          <div className="flex items-center gap-0 overflow-hidden rounded-xl border border-white/10 bg-night-800/80 focus-within:border-indigo-400/70">
            <span className="whitespace-nowrap select-none py-2.5 pl-3 pr-1 font-mono text-sm text-slate-500">
              {repo.owner.login}/
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.replace(/\s+/g, "-"))}
              className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 font-mono text-slate-100 outline-none"
              spellCheck={false}
            />
          </div>
          {!nameValid && <p className="mt-1 text-xs text-amber-300">⚠️ Nama tidak valid.</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-300">📝 Deskripsi</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={350}
            placeholder="Deskripsi singkat repo..."
            className="input-field resize-none !py-2.5"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-300">🔗 Homepage / demo URL</label>
          <input
            value={homepage}
            onChange={(e) => setHomepage(e.target.value)}
            placeholder="https://..."
            className="input-field font-mono !py-2.5"
            spellCheck={false}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-300">👁️ Visibilitas</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: false, icon: "🌍", t: "Public" },
              { v: true, icon: "🔒", t: "Private" },
            ].map((o) => (
              <button
                type="button"
                key={o.t}
                onClick={() => setIsPrivate(o.v)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition active:scale-[0.97] ${
                  isPrivate === o.v
                    ? "border-indigo-400/70 bg-indigo-500/15 text-white shadow-[0_0_14px_rgba(99,102,241,0.3)]"
                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07]"
                }`}
              >
                {o.icon} {o.t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-300">🏷️ Topics <span className="font-normal text-slate-500">(koma)</span></label>
            <input
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="react, api, portfolio"
              className="input-field !py-2.5"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-300">🌿 Default branch</label>
            <select
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              className="input-field !py-2.5 font-mono"
            >
              {[repo.default_branch, ...branches].filter((v, i, a) => v && a.indexOf(v) === i).map((b) => (
                <option key={b} value={b} className="bg-night-800">{b}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300 animate-pop-in">
            ⚠️ {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">Batal</button>
          <button type="submit" disabled={saving || !nameValid} className="btn-primary flex-1 !py-2.5 disabled:opacity-50">
            {saving ? "Menyimpan..." : "💾 Simpan Perubahan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
