import { useState } from "react";
import Modal from "./Modal.jsx";
import TerminalLog from "./TerminalLog.jsx";
import TiltCard from "./TiltCard.jsx";
import { TEMPLATES } from "../lib/templates.js";
import { apiCreateRepo, pushFiles, strToBase64, deployUrls } from "../lib/github.js";
import { getToken, getSettings, clearToken } from "../lib/storage.js";
import { addHistory } from "../lib/history.js";
import { playSuccess, playError, playClick } from "../lib/sfx.js";

const NAME_RE = /^[A-Za-z0-9_.-]{1,100}$/;

function now() {
  return new Date().toLocaleTimeString("id-ID", { hour12: false });
}

export default function TemplateGallery({ user, showToast, onTokenInvalid }) {
  const [active, setActive] = useState(null); // template terpilih (modal form)
  const [repoName, setRepoName] = useState("");
  const [visibility, setVisibility] = useState(getSettings().defaultVisibility || "public");
  const [commitMsg, setCommitMsg] = useState(getSettings().commitMessage || "🚀 Upload via Zip2Repo");
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function log(text, type = "info") {
    setLogs((ls) => [...ls.slice(-200), { time: now(), text, type }]);
  }

  function openTemplate(t) {
    playClick();
    setActive(t);
    setRepoName("");
    setVisibility(getSettings().defaultVisibility || "public");
    setCommitMsg(getSettings().commitMessage || "🚀 Upload via Zip2Repo");
    setWorking(false);
    setProgress(0);
    setStatusText("");
    setLogs([]);
    setResult(null);
    setError("");
  }

  async function create(e) {
    e.preventDefault();
    if (!NAME_RE.test(repoName) || working) return;
    const token = getToken();
    if (!token) return onTokenInvalid();

    setWorking(true);
    setResult(null);
    setError("");
    setLogs([]);
    log(`$ zip2repo template ${active.id}`, "sys");
    log(`▶ target : ${user.login}/${repoName} (${visibility})`);
    log(`▶ template: ${active.name} (${active.files.length} file)`);

    try {
      setStatusText("Membuat repository...");
      log("── CREATE REPO ──────────────────────", "sys");
      const repo = await apiCreateRepo({
        token,
        name: repoName,
        isPrivate: visibility === "private",
        description: `${active.name} starter via Zip2Repo ⚡`,
      });
      log(`✔ repository dibuat: ${repo.full_name}`, "ok");

      setStatusText("Push file template...");
      log("── PUSH TEMPLATE ────────────────────", "sys");
      const files = active.files.map((f) => ({
        path: f.path,
        contentBase64: strToBase64(f.content),
        size: f.content.length,
      }));
      const pushRes = await pushFiles({
        token,
        owner: repo.owner,
        repo: repo.name,
        branch: repo.default_branch || "main",
        files,
        commitMessage: commitMsg,
        autoReadme: false,
        onProgress: (p, path) => {
          setProgress(p);
          log(`  push  ↑ ${path}`, "dim");
        },
        onStatus: (s) => { setStatusText(s); log(`  ${s}`, "warn"); },
      });
      log(`✔ commit ${pushRes.commitSha.slice(0, 7)} → refs/heads/main`, "ok");
      log("🎉 TEMPLATE DEPLOYED!", "ok");

      playSuccess();
      addHistory({
        full_name: repo.full_name,
        html_url: repo.html_url,
        private: repo.private,
        fileCount: pushRes.fileCount,
      });
      setResult({ ...repo, fileCount: pushRes.fileCount, commitSha: pushRes.commitSha });
      showToast({ type: "success", message: `Template "${active.name}" ter-deploy ke ${repo.full_name}! 🎉` });
    } catch (err) {
      playError();
      setError(err.message || "Terjadi kesalahan.");
      log(`✘ ERROR: ${err.message}`, "err");
      if (err.status === 401) {
        clearToken();
        setTimeout(onTokenInvalid, 1200);
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <div className="text-center animate-fade-up">
        <h1 className="text-2xl font-extrabold text-white md:text-3xl">
          🎨 Galeri <span className="gradient-text">Template</span>
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
          Tidak punya file ZIP? Pilih starter project — repo langsung dibuat + terisi kode siap jalan.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t, i) => (
          <TiltCard key={t.id} max={5}>
            <button
              onClick={() => openTemplate(t)}
              className="glass group block h-full w-full p-6 text-left transition-all duration-300 hover:border-indigo-400/50 hover:shadow-[0_12px_44px_rgba(99,102,241,0.25)] animate-fade-up"
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/25 to-cyan-400/20 text-3xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                {t.icon}
              </span>
              <h3 className="mt-4 text-lg font-bold text-white group-hover:text-cyan-300 transition">
                {t.name}
              </h3>
              <p className="mt-1.5 min-h-[3rem] text-sm text-slate-400">{t.desc}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-300">
                  📄 {t.files.length} file
                </span>
                {t.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-indigo-400/25 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] text-indigo-200">
                    #{tag}
                  </span>
                ))}
              </div>
              <span className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-2.5 text-sm font-semibold text-indigo-100 transition group-hover:bg-indigo-500/25">
                Gunakan Template 🚀
              </span>
            </button>
          </TiltCard>
        ))}
      </div>

      {/* Modal form + progress */}
      {active && (
        <Modal onClose={() => !working && setActive(null)} wide>
          {!result ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/25 to-cyan-400/20 text-2xl">
                    {active.icon}
                  </span>
                  <div>
                    <h2 className="text-lg font-extrabold text-white">{active.name}</h2>
                    <p className="text-xs text-slate-500">{active.files.length} file akan di-push</p>
                  </div>
                </div>
                {!working && (
                  <button onClick={() => setActive(null)} className="btn-ghost !px-3 !py-1.5">✕</button>
                )}
              </div>

              {/* Daftar file template */}
              <div className="mt-4 max-h-32 overflow-y-auto thin-scroll rounded-xl border border-white/10 bg-night-800/60 p-3 font-mono text-xs text-slate-400">
                {active.files.map((f) => (
                  <p key={f.path}>📄 {f.path}</p>
                ))}
              </div>

              <form onSubmit={create} className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-300">📛 Nama Repository</label>
                  <div className="flex items-center gap-0 overflow-hidden rounded-xl border border-white/10 bg-night-800/80 focus-within:border-indigo-400/70">
                    <span className="whitespace-nowrap select-none py-2.5 pl-3 pr-1 font-mono text-sm text-slate-500">
                      {user?.login}/
                    </span>
                    <input
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value.replace(/\s+/g, "-"))}
                      placeholder="proyek-dari-template"
                      disabled={working}
                      className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 font-mono text-slate-100 outline-none placeholder:text-slate-600"
                      spellCheck={false}
                    />
                  </div>
                  {repoName && !NAME_RE.test(repoName) && (
                    <p className="mt-1 text-xs text-amber-300">⚠️ Nama tidak valid.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: "public", icon: "🌍", t: "Public" },
                    { v: "private", icon: "🔒", t: "Private" },
                  ].map((o) => (
                    <button
                      type="button"
                      key={o.v}
                      disabled={working}
                      onClick={() => setVisibility(o.v)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                        visibility === o.v
                          ? "border-indigo-400/70 bg-indigo-500/15 text-white"
                          : "border-white/10 bg-white/[0.03] text-slate-400"
                      }`}
                    >
                      {o.icon} {o.t}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-300">💬 Commit message</label>
                  <input
                    value={commitMsg}
                    onChange={(e) => setCommitMsg(e.target.value)}
                    disabled={working}
                    className="input-field !py-2.5"
                  />
                </div>

                {error && (
                  <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300 animate-pop-in">
                    ⚠️ {error}
                  </p>
                )}

                {working || logs.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <p className="font-semibold text-white">{statusText || "Bekerja..."}</p>
                      <p className="font-mono text-xs text-slate-500">{progress}%</p>
                    </div>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="stripe-bar h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="mt-3">
                      <TerminalLog lines={logs} working={working} />
                    </div>
                  </div>
                ) : null}

                {!working && logs.length === 0 && (
                  <button type="submit" disabled={!NAME_RE.test(repoName)} className="btn-primary w-full disabled:opacity-50">
                    🚀 Buat Repo dari Template
                  </button>
                )}
              </form>
            </>
          ) : (
            <div className="text-center animate-pop-in">
              <span className="inline-block text-6xl animate-float">🎉</span>
              <h2 className="mt-3 text-2xl font-extrabold text-white">Template ter-deploy!</h2>
              <p className="mt-1 text-sm text-slate-400">
                <b className="text-white">{result.fileCount}</b> file ter-push ke{" "}
                <code className="font-mono text-cyan-300">{result.full_name}</code>
              </p>
              <a
                href={result.html_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block truncate rounded-xl border border-white/10 bg-night-800/70 p-3 font-mono text-sm text-cyan-300 hover:underline"
              >
                {result.html_url}
              </a>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <a href={result.html_url} target="_blank" rel="noreferrer" className="btn-primary flex-1">
                  Buka Repository ↗
                </a>
                <a
                  href={deployUrls(result.html_url).vercel}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost flex-1 !border-white/20"
                >
                  ▲ Deploy to Vercel
                </a>
              </div>
              <button onClick={() => setActive(null)} className="mt-4 text-sm text-slate-400 underline underline-offset-4 hover:text-white">
                ⬅ Kembali ke galeri
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
