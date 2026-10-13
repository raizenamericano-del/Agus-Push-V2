import { useEffect, useRef, useState } from "react";
import Stepper from "./Stepper.jsx";
import Confetti from "./Confetti.jsx";
import TerminalLog from "./TerminalLog.jsx";
import TiltCard from "./TiltCard.jsx";
import { extractZip, pushFiles, apiCreateRepo, listRepos } from "../lib/github.js";
import { getToken, getSettings, clearToken } from "../lib/storage.js";
import { addHistory, getHistory, clearHistory, removeHistoryItem } from "../lib/history.js";
import { playSuccess, playError, playClick } from "../lib/sfx.js";
import { fmtSize } from "../lib/format.js";

const MAX_SIZE = 100 * 1024 * 1024; // 100MB (maksimal aman untuk GitHub API)

function now() {
  return new Date().toLocaleTimeString("id-ID", { hour12: false });
}

const UPDATE_STEPS = [
  { id: "extract", icon: "🗜️", label: "Ekstrak ZIP" },
  { id: "push", icon: "🚀", label: "Push update" },
  { id: "done", icon: "🎉", label: "Selesai" },
];

export default function Uploader({ user, showToast, onTokenInvalid }) {
  // Mode: create | update
  const [mode, setMode] = useState("create");
  const [repoName, setRepoName] = useState("");
  const [visibility, setVisibility] = useState(() => getSettings().defaultVisibility || "public");
  const [commitMsg, setCommitMsg] = useState(() => getSettings().commitMessage || "🚀 Upload via Zip2Repo");
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState("");

  // Update mode
  const [repoList, setRepoList] = useState([]);
  const [repoLoading, setRepoLoading] = useState(false);
  const [targetRepo, setTargetRepo] = useState(null);
  const [repoQuery, setRepoQuery] = useState("");
  const [targetBranch, setTargetBranch] = useState("main");
  const [mergeMode, setMergeMode] = useState(true); // true = gabung, false = timpa total

  // Proses
  const [phase, setPhase] = useState("idle"); // idle | working | success | error
  const [step, setStep] = useState(0);
  const [failedStep, setFailedStep] = useState(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [logs, setLogs] = useState([]);
  const [showRocket, setShowRocket] = useState(false);
  const [history, setHistory] = useState(getHistory());

  const inputRef = useRef(null);
  const logThrottle = useRef(0);

  // Muat daftar repo saat pindah ke mode update
  useEffect(() => {
    if (mode !== "update" || repoList.length > 0 || repoLoading) return;
    setRepoLoading(true);
    listRepos(getToken())
      .then(setRepoList)
      .catch((e) => {
        showToast({ type: "error", message: "Gagal memuat repo: " + e.message });
        if (e.status === 401) onTokenInvalid();
      })
      .finally(() => setRepoLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function log(text, type = "info") {
    setLogs((ls) => [...ls.slice(-200), { time: now(), text, type }]);
  }

  function logFile(path, prefix) {
    const t = Date.now();
    if (t - logThrottle.current > 90) {
      logThrottle.current = t;
      log(`${prefix} ${path}`, "dim");
    }
  }

  function pickFile(f) {
    setFileError("");
    if (!f) return;
    if (!/\.zip$/i.test(f.name)) return setFileError("Hanya file .zip yang didukung.");
    if (f.size > MAX_SIZE) return setFileError(`Ukuran file ${fmtSize(f.size)} melebihi batas 50MB.`);
    if (f.size === 0) return setFileError("File kosong (0 byte).");
    setFile(f);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0]);
  }

  const repoNameValid = /^[A-Za-z0-9_.-]{1,100}$/.test(repoName);
  const canSubmit =
    mode === "create"
      ? repoNameValid && file && phase !== "working"
      : targetRepo && file && targetBranch.trim() && phase !== "working";

  async function start(e) {
    e.preventDefault();
    if (!canSubmit) return;
    const token = getToken();
    if (!token) return onTokenInvalid();

    setPhase("working");
    setFailedStep(null);
    setResult(null);
    setErrorMsg("");
    setLogs([]);
    setShowRocket(false);

    const isUpdate = mode === "update";
    log(isUpdate ? "$ zip2repo update --merge" : "$ zip2repo deploy --branch main", "sys");
    log(`▶ target  : ${isUpdate ? targetRepo.full_name + " @ " + targetBranch : `${user.login}/${repoName} (${visibility})`}`);
    log(`▶ archive : ${file.name} (${fmtSize(file.size)})`);
    if (isUpdate) log(`▶ mode    : ${mergeMode ? "gabung (file lama dipertahankan)" : "timpa total (isi repo = isi ZIP)"}`, "warn");

    try {
      // STEP 1: Ekstrak
      setStep(0);
      setStatusText("Mengekstrak file ZIP di browser...");
      setProgress(0);
      log("── STEP 1 · EXTRACT ───────────────────", "sys");
      const { files, skipped } = await extractZip(file, (p, path) => {
        setProgress(p);
        logFile(path, "  unzip →");
      });
      log(`✔ ${files.length} file berhasil diekstrak${skipped ? ` (${skipped} file sistem dilewati)` : ""}`, "ok");

      let repo, owner, rname, branch;
      if (!isUpdate) {
        // STEP 2: Buat repo
        setStep(1);
        setProgress(0);
        setStatusText(`Membuat repository "${repoName}" (${visibility})...`);
        log("── STEP 2 · CREATE REPO ───────────────", "sys");
        log("  POST github.com/user/repos ...");
        repo = await apiCreateRepo({
          token,
          name: repoName,
          isPrivate: visibility === "private",
          description: `Uploaded from ${file.name} via Zip2Repo ⚡`,
        });
        log(`✔ repository dibuat: ${repo.full_name}`, "ok");
        owner = repo.owner;
        rname = repo.name;
        branch = repo.default_branch || "main";
        setStep(2);
      } else {
        owner = targetRepo.owner.login;
        rname = targetRepo.name;
        branch = targetBranch.trim();
        repo = { full_name: targetRepo.full_name, html_url: targetRepo.html_url, private: targetRepo.private, owner, name: rname };
        setStep(1);
      }

      // STEP push
      setProgress(0);
      setStatusText(isUpdate ? `Push update ke ${branch}...` : "Push file ke branch main...");
      log("── STEP 3 · PUSH ──────────────────────", "sys");
      const pushRes = await pushFiles({
        token,
        owner,
        repo: rname,
        branch,
        files,
        commitMessage: commitMsg.trim() || undefined,
        merge: isUpdate ? mergeMode : false,
        onProgress: (p, path) => {
          setProgress(p);
          logFile(path, "  push  ↑");
        },
        onStatus: (s) => { setStatusText(s); log(`  ${s}`, "warn"); },
      });
      log(`✔ commit ${pushRes.commitSha.slice(0, 7)} → refs/heads/${branch}`, "ok");
      log(isUpdate ? "🎉 UPDATE SUCCESS!" : "🎉 BUILD SUCCESS — repository siap!", "ok");

      setStep(isUpdate ? 2 : 4);
      setStatusText("Selesai!");
      setShowRocket(true);
      playSuccess();
      addHistory({
        full_name: repo.full_name,
        html_url: repo.html_url,
        private: repo.private,
        fileCount: pushRes.fileCount,
      });
      setHistory(getHistory());
      setTimeout(() => {
        setResult({ ...repo, branch, fileCount: pushRes.fileCount, commitSha: pushRes.commitSha, isUpdate });
        setPhase("success");
        showToast({ type: "success", message: isUpdate ? "Repo berhasil di-update! 🎉" : "Repository berhasil dibuat & file ter-push! 🎉" });
      }, 1600);
    } catch (err) {
      setFailedStep(step);
      setErrorMsg(err.message || "Terjadi kesalahan tak terduga.");
      log(`✘ ERROR: ${err.message}`, "err");
      log("✘ BUILD FAILED", "err");
      playError();
      setPhase("error");
      if (err.status === 401) {
        clearToken();
        showToast({ type: "error", message: "Token tidak valid — silakan masukkan ulang." });
        setTimeout(onTokenInvalid, 1200);
      }
    }
  }

  function reset() {
    setPhase("idle");
    setStep(0);
    setFailedStep(null);
    setProgress(0);
    setFile(null);
    setRepoName("");
    setStatusText("");
    setErrorMsg("");
    setResult(null);
    setLogs([]);
    setShowRocket(false);
  }

  /* ================== SUCCESS VIEW ================== */
  if (phase === "success" && result) {
    const vercelUrl = `https://vercel.com/new/clone?repository-url=${encodeURIComponent(result.html_url)}`;
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Confetti />
        <TiltCard max={6}>
          <div className="glass animate-pop-in relative overflow-hidden p-8 text-center md:p-10">
            <img
              src="/rocket.png"
              alt="Roket sukses"
              className="mx-auto w-32 animate-levitate drop-shadow-[0_0_40px_rgba(34,211,238,0.5)] md:w-40"
              draggable={false}
            />
            <h2 className="mt-4 text-3xl font-extrabold text-white">
              {result.isUpdate ? "Update Berhasil! 🎉" : "Meluncur! 🎉"}
            </h2>
            <p className="mt-2 text-slate-400">
              <b className="text-white">{result.fileCount}</b> file ter-push ke branch{" "}
              <code className="font-mono text-cyan-300">{result.branch || "main"}</code>
            </p>

            <div className="mt-6 rounded-xl border border-white/10 bg-night-800/70 p-4 text-left">
              <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Repository</p>
              <a
                href={result.html_url}
                target="_blank"
                rel="noreferrer"
                className="break-all font-mono text-cyan-300 hover:text-cyan-200 hover:underline"
              >
                {result.html_url}
              </a>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full border px-2.5 py-1 ${result.private ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"}`}>
                  {result.private ? "🔒 Private" : "🌍 Public"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-slate-400">
                  commit {result.commitSha.slice(0, 7)}
                </span>
                {result.isUpdate && (
                  <span className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-1 text-indigo-200">
                    🔄 Update
                  </span>
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <a href={result.html_url} target="_blank" rel="noreferrer" className="btn-primary flex-1">
                <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" /></svg>
                Buka Repository
              </a>
              <a
                href={vercelUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost flex-1 !border-white/20 hover:!bg-white hover:!text-black"
                title="Deploy repository ini ke Vercel"
              >
                <svg viewBox="0 0 76 65" width="16" height="16" fill="currentColor"><path d="M37.59.25l36.95 64H.64l36.95-64z" /></svg>
                Deploy to Vercel
              </a>
            </div>

            <button onClick={reset} className="mt-6 text-sm text-slate-400 underline underline-offset-4 transition hover:text-white">
              ⬅ Upload ZIP lain
            </button>
            <p className="mt-5 text-[11px] text-slate-600">
              Zip2Repo · crafted by <span className="gradient-text font-bold">RifkyDev</span> ⚡
            </p>
          </div>
        </TiltCard>
      </div>
    );
  }

  /* ================== WORKING / ERROR VIEW ================== */
  if (phase === "working" || phase === "error") {
    const isUpdate = mode === "update";
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        {showRocket && (
          <div className="pointer-events-none fixed inset-0 z-[95] flex justify-center overflow-hidden">
            <img src="/rocket.png" alt="" className="w-40 animate-rocket-launch drop-shadow-[0_0_60px_rgba(34,211,238,0.7)] md:w-52" />
          </div>
        )}

        <div className={phase === "working" ? "neon-card animate-fade-up" : "animate-fade-up"}>
          <div className="glass !rounded-2xl p-6 md:p-10">
            {isUpdate
              ? <Stepper current={step} failedStep={failedStep} steps={UPDATE_STEPS} />
              : <Stepper current={step} failedStep={failedStep} />}

            {phase === "working" ? (
              <div className="mt-8">
                <div className="flex items-center justify-center gap-4">
                  <div className="relative h-14 w-14 shrink-0">
                    <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-cyan-400 border-t-indigo-400" />
                    <div className="absolute inset-0 flex items-center justify-center text-xl">
                      {step === 0 ? "🗜️" : step === 1 ? (isUpdate ? "🚀" : "📦") : "🚀"}
                    </div>
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="font-semibold text-white">{statusText}</p>
                    <p className="font-mono text-xs text-slate-500">{(!isUpdate && step === 1) ? "menghubungi GitHub..." : `${progress}%`}</p>
                  </div>
                </div>

                <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="stripe-bar h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                    style={{ width: `${(!isUpdate && step === 1) ? 100 : progress}%` }}
                  />
                </div>

                <div className="mt-6">
                  <TerminalLog lines={logs} working />
                </div>
              </div>
            ) : (
              <div className="mt-8 animate-pop-in text-center">
                <div className="mx-auto flex h-20 w-20 animate-wiggle items-center justify-center rounded-full border-2 border-rose-400/50 bg-rose-500/15 text-4xl">
                  💥
                </div>
                <h3 className="mt-5 text-xl font-bold text-white">Ups, proses gagal</h3>
                <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {errorMsg}
                </p>
                <div className="mt-5">
                  <TerminalLog lines={logs} working={false} />
                </div>
                <div className="mt-6 flex justify-center gap-3">
                  <button onClick={() => setPhase("idle")} className="btn-primary">🔁 Coba Lagi</button>
                  <button onClick={reset} className="btn-ghost">Mulai Ulang</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ================== FORM VIEW ================== */
  const shownRepos = repoQuery.trim()
    ? repoList.filter((r) => `${r.full_name} ${r.description || ""}`.toLowerCase().includes(repoQuery.toLowerCase()))
    : repoList;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-14">
      <div className="relative animate-fade-up text-center">
        <img
          src="/mascot.png"
          alt="Maskot"
          className="mx-auto w-24 animate-float drop-shadow-[0_0_30px_rgba(99,102,241,0.5)] md:w-28"
          draggable={false}
        />
        <h1 className="mt-3 text-3xl font-extrabold text-white md:text-4xl">
          Upload ZIP → <span className="gradient-text">GitHub Repo</span> ⚡
        </h1>
        <p className="mt-3 text-slate-400">
          Halo, <b className="text-white">@{user?.login}</b>! Buat repo baru atau update repo lamamu.
        </p>
      </div>

      {/* Mode switch */}
      <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1 animate-fade-up [animation-delay:.1s]">
        {[
          { v: "create", icon: "✨", label: "Buat Baru" },
          { v: "update", icon: "🔄", label: "Update Repo" },
        ].map((m) => (
          <button
            key={m.v}
            type="button"
            onClick={() => { playClick(); setMode(m.v); }}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
              mode === m.v
                ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-[0_0_18px_rgba(99,102,241,0.45)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      <TiltCard max={3}>
        <form onSubmit={start} className="glass mt-6 animate-fade-up space-y-6 p-6 [animation-delay:.15s] md:p-8">
          {mode === "create" ? (
            <>
              {/* Nama repo */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">📛 Nama Repository</label>
                <div className="flex items-center gap-0 overflow-hidden rounded-xl border border-white/10 bg-night-800/80 transition-all focus-within:border-indigo-400/70 focus-within:ring-2 focus-within:ring-indigo-500/25">
                  <span className="select-none whitespace-nowrap py-3 pl-4 pr-1 font-mono text-sm text-slate-500">
                    {user?.login}/
                  </span>
                  <input
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value.replace(/\s+/g, "-"))}
                    placeholder="proyek-keren-saya"
                    className="min-w-0 flex-1 bg-transparent py-3 pr-4 font-mono text-slate-100 outline-none placeholder:text-slate-600"
                    spellCheck={false}
                  />
                </div>
                {repoName && !repoNameValid && (
                  <p className="mt-2 animate-pop-in text-xs text-amber-300">
                    ⚠️ Gunakan huruf, angka, <code>-</code>, <code>_</code>, atau <code>.</code> (maks. 100 karakter)
                  </p>
                )}
              </div>

              {/* Visibility */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">👁️ Visibilitas</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { v: "public", icon: "🌍", title: "Public", desc: "Semua orang bisa melihat" },
                    { v: "private", icon: "🔒", title: "Private", desc: "Hanya kamu yang bisa akses" },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.v}
                      onClick={() => setVisibility(opt.v)}
                      className={`rounded-xl border p-4 text-left transition-all duration-200 active:scale-[0.97] ${
                        visibility === opt.v
                          ? "border-indigo-400/70 bg-indigo-500/15 shadow-[0_0_18px_rgba(99,102,241,0.3)]"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                      }`}
                    >
                      <span className="text-xl">{opt.icon}</span>
                      <p className="mt-1 font-semibold text-white">{opt.title}</p>
                      <p className="text-xs text-slate-400">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Pilih repo target */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">🎯 Repo yang di-update</label>
                {repoLoading ? (
                  <div className="space-y-2 rounded-xl border border-white/10 p-4">
                    <div className="shimmer-line h-4 w-2/3" />
                    <div className="shimmer-line h-4 w-1/2" />
                    <p className="text-xs text-slate-500">Memuat repo kamu...</p>
                  </div>
                ) : (
                  <>
                    <input
                      value={repoQuery}
                      onChange={(e) => setRepoQuery(e.target.value)}
                      placeholder="🔍 Ketik untuk mencari repo..."
                      className="input-field !py-2.5"
                    />
                    <div className="thin-scroll mt-2 max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-white/10 bg-night-800/60 p-2">
                      {shownRepos.slice(0, 50).map((r) => (
                        <button
                          type="button"
                          key={r.id}
                          onClick={() => { playClick(); setTargetRepo(r); setTargetBranch(r.default_branch || "main"); }}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-mono text-sm transition ${
                            targetRepo?.id === r.id
                              ? "border border-indigo-400/60 bg-indigo-500/20 text-white"
                              : "border border-transparent text-slate-300 hover:bg-white/5"
                          }`}
                        >
                          <span>{r.private ? "🔒" : "🌍"}</span>
                          <span className="flex-1 truncate">{r.full_name}</span>
                          {targetRepo?.id === r.id && <span className="text-emerald-400">✓</span>}
                        </button>
                      ))}
                      {shownRepos.length === 0 && (
                        <p className="p-3 text-center text-sm text-slate-500">Tidak ada repo yang cocok.</p>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Branch + mode */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-300">🌿 Branch target</label>
                  <input
                    value={targetBranch}
                    onChange={(e) => setTargetBranch(e.target.value)}
                    placeholder="main"
                    className="input-field font-mono !py-2.5"
                    spellCheck={false}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-300">🧬 Mode push</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMergeMode(true)}
                      className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${mergeMode ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200" : "border-white/10 text-slate-500"}`}
                      title="File lama yang tidak ada di ZIP tetap dipertahankan"
                    >
                      🧩 Gabung
                    </button>
                    <button
                      type="button"
                      onClick={() => setMergeMode(false)}
                      className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${!mergeMode ? "border-amber-400/60 bg-amber-400/10 text-amber-200" : "border-white/10 text-slate-500"}`}
                      title="Isi repo diganti total dengan isi ZIP"
                    >
                      💥 Timpa
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Dropzone */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">🗂️ File ZIP <span className="font-normal text-slate-500">(maks. 50MB)</span></label>
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
                dragOver
                  ? "scale-[1.02] border-cyan-400 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.25)]"
                  : file
                    ? "border-emerald-400/50 bg-emerald-400/[0.06]"
                    : "border-white/15 bg-white/[0.02] hover:border-indigo-400/50 hover:bg-indigo-400/[0.05]"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              {file ? (
                <div className="animate-pop-in">
                  <span className="text-4xl">📦</span>
                  <p className="mt-2 break-all font-semibold text-white">{file.name}</p>
                  <p className="text-sm text-emerald-300">{fmtSize(file.size)} ✓</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="mt-2 text-xs text-slate-400 underline underline-offset-2 hover:text-rose-300"
                  >
                    Hapus file
                  </button>
                </div>
              ) : (
                <div>
                  <span className={`inline-block text-4xl ${dragOver ? "animate-wiggle" : "animate-float"}`}>🗜️</span>
                  <p className="mt-2 font-medium text-slate-300">
                    {dragOver ? "Lepaskan di sini!" : "Drag & drop ZIP ke sini"}
                  </p>
                  <p className="text-sm text-slate-500">atau klik untuk memilih file</p>
                </div>
              )}
            </div>
            {fileError && (
              <p className="mt-2 animate-pop-in text-sm text-rose-300">⚠️ {fileError}</p>
            )}
          </div>

          {/* Commit message */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">💬 Commit message</label>
            <input
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              placeholder="🚀 Upload via Zip2Repo"
              maxLength={120}
              className="input-field !py-2.5"
            />
          </div>

          <button type="submit" disabled={!canSubmit} className="btn-primary w-full !py-4 text-base">
            {mode === "create" ? "🚀 Buat Repository & Push" : "🔄 Update Repository"}
          </button>
        </form>
      </TiltCard>

      <p className="mt-6 animate-fade-up text-center text-xs text-slate-600 [animation-delay:.3s]">
        ZIP diekstrak langsung di browser • Maks. {fmtSize(MAX_SIZE)} per ZIP & 100MB per file (limit GitHub API) • README.md dibuat otomatis jika tidak ada{mode === "create" ? " • Push ke branch main" : " • Mode gabung aman untuk file lama"}
      </p>

      {/* ===== RIWAYAT ===== */}
      {history.length > 0 && (
        <div className="glass mt-8 animate-fade-up p-5 [animation-delay:.35s] md:p-6">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-white">
              <span className="text-xl">🕘</span> Riwayat Upload
            </h3>
            <button
              onClick={() => { clearHistory(); setHistory([]); }}
              className="text-xs text-slate-500 underline underline-offset-2 transition hover:text-rose-300"
            >
              Bersihkan semua
            </button>
          </div>
          <ul className="mt-4 space-y-2">
            {history.slice(0, 6).map((h, i) => (
              <li key={h.html_url + i} className="group/h flex animate-fade-up items-center gap-2" style={{ animationDelay: `${i * 0.07}s` }}>
                <a
                  href={h.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 transition-all duration-200 hover:translate-x-1 hover:border-indigo-400/40 hover:bg-white/[0.08]"
                >
                  <span className="text-lg">{h.private ? "🔒" : "🌍"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm text-slate-200 transition group-hover:text-cyan-300">{h.full_name}</p>
                    <p className="text-[11px] text-slate-500">
                      {h.fileCount} file · {new Date(h.at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <span className="text-slate-500 transition group-hover:text-white">↗</span>
                </a>
                <button
                  onClick={() => setHistory(removeHistoryItem(h.html_url))}
                  className="shrink-0 rounded-lg border border-white/5 px-2 py-2 text-xs text-slate-600 opacity-0 transition hover:border-rose-500/40 hover:text-rose-300 group-hover/h:opacity-100"
                  title="Hapus dari riwayat"
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
