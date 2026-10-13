import { useState } from "react";
import Modal from "./Modal.jsx";
import { deleteRepo } from "../lib/github.js";
import { getToken } from "../lib/storage.js";
import { playDelete, playSuccess, playError } from "../lib/sfx.js";

/** Modal hapus repo: satuan (ketik nama repo) atau massal (ketik HAPUS) */
export default function DeleteRepoModal({ targets, showToast, onClose, onDeleted }) {
  const [confirm, setConfirm] = useState("");
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState({}); // full_name -> idle|working|done|fail
  const [done, setDone] = useState(false);

  const bulk = targets.length > 1;
  const expected = bulk ? "HAPUS" : targets[0]?.name || "";
  const valid = confirm.trim() === expected;

  async function start() {
    if (!valid || working) return;
    setWorking(true);
    playDelete();
    const deleted = [];
    const token = getToken();
    for (const t of targets) {
      setStatus((s) => ({ ...s, [t.full_name]: "working" }));
      try {
        await deleteRepo(token, t.owner.login, t.name);
        setStatus((s) => ({ ...s, [t.full_name]: "done" }));
        deleted.push(t.full_name);
      } catch (e) {
        setStatus((s) => ({ ...s, [t.full_name]: "fail" }));
        showToast({ type: "error", message: `Gagal hapus ${t.full_name}: ${e.message}` });
      }
      // jeda kecil agar tidak kena secondary rate-limit
      await new Promise((r) => setTimeout(r, 350));
    }
    setDone(true);
    setWorking(false);
    if (deleted.length === targets.length) {
      playSuccess();
      showToast({ type: "success", message: `🗑️ ${deleted.length} repo berhasil dihapus.` });
    } else if (deleted.length > 0) {
      playError();
    } else {
      playError();
    }
    onDeleted?.(deleted);
  }

  return (
    <Modal onClose={working ? () => {} : onClose}>
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-rose-400/50 bg-rose-500/15 text-3xl animate-wiggle">
          🗑️
        </div>
        <h2 className="mt-4 text-xl font-extrabold text-white">
          Hapus {bulk ? `${targets.length} Repository` : "Repository"}?
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Tindakan ini <b className="text-rose-300">permanen & tidak bisa dibatalkan!</b> Semua
          kode, commit, dan riwayat akan hilang selamanya.
        </p>
      </div>

      {/* Daftar target */}
      <ul className="mt-5 max-h-44 space-y-2 overflow-y-auto thin-scroll rounded-xl border border-white/10 bg-night-800/60 p-3">
        {targets.map((t) => {
          const st = status[t.full_name] || "idle";
          return (
            <li key={t.full_name} className="flex items-center gap-2 font-mono text-sm">
              {st === "working" && <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-amber-300 animate-spin" />}
              {st === "done" && <span className="text-emerald-400">✔</span>}
              {st === "fail" && <span className="text-rose-400">✕</span>}
              {st === "idle" && <span>{t.private ? "🔒" : "🌍"}</span>}
              <span className={`truncate ${st === "done" ? "text-slate-600 line-through" : "text-slate-200"}`}>
                {t.full_name}
              </span>
            </li>
          );
        })}
      </ul>

      {!done ? (
        <>
          <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3 text-xs text-amber-200/90">
            {bulk ? (
              <>Ketik <code className="font-mono font-bold text-amber-100">HAPUS</code> (huruf besar semua) untuk mengonfirmasi penghapusan {targets.length} repo.</>
            ) : (
              <>Ketik nama repo <code className="font-mono font-bold text-amber-100">{expected}</code> untuk mengonfirmasi.</>
            )}
          </div>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={bulk ? "HAPUS" : expected}
            disabled={working}
            className="input-field mt-3 font-mono text-center"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="mt-5 flex gap-2">
            <button onClick={onClose} disabled={working} className="btn-ghost flex-1 disabled:opacity-40">
              Batal
            </button>
            <button
              onClick={start}
              disabled={!valid || working}
              className="flex-1 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 px-4 py-2.5 font-bold text-white transition-all hover:shadow-[0_0_24px_rgba(244,63,94,0.5)] active:scale-[0.97] disabled:opacity-40 disabled:hover:shadow-none"
            >
              {working ? "Menghapus..." : `Ya, hapus${bulk ? ` ${targets.length} repo` : ""}!`}
            </button>
          </div>
        </>
      ) : (
        <button onClick={onClose} className="btn-primary mt-5 w-full">
          Selesai ✓
        </button>
      )}
    </Modal>
  );
}
