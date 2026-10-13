import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal.jsx";
import Markdown from "./Markdown.jsx";
import { getFile, getBlob, deleteFile, base64ToStr, triggerBlobDownload } from "../lib/github.js";
import { getToken } from "../lib/storage.js";
import { fmtSize } from "../lib/format.js";
import { playDelete } from "../lib/sfx.js";

/* ---------- syntax highlight ringan (tanpa dependency) ---------- */
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const HASH_COMMENT_EXT = ["py", "sh", "bash", "zsh", "yml", "yaml", "rb", "toml", "pl", "r", "dockerfile", "mk", "ini", "cfg"];

const KW_RE = /\b(const|let|var|function|return|if|else|elif|for|while|do|switch|case|break|continue|new|class|extends|import|from|export|default|try|catch|except|finally|throw|raise|async|await|yield|typeof|instanceof|in|of|this|self|super|static|public|private|protected|package|interface|enum|struct|fn|mut|impl|trait|match|use|mod|pub|func|go|chan|defer|select|echo|fi|then|print|lambda|None|True|False|and|or|not|with|as|pass|is|nil|NULL|null|true|false|void|delete|sizeof|typedef|namespace|using|virtual|override|sealed|readonly)\b/g;
const NUM_RE = /\b(\d[\d_]*(?:\.\d+)?)\b/g;
const STR_RE = /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;

function highlightCode(code, ext) {
  const tokens = [];
  const stash = (cls, text) => {
    tokens.push('<span class="tok-' + cls + '">' + escapeHtml(text) + "</span>");
    return "@@Z2R" + (tokens.length - 1) + "TOK@@";
  };
  let src = String(code);
  try {
    src = src.replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, (m) => stash("com", m));
    src = src.replace(/(<!--[\s\S]*?-->)/g, (m) => stash("com", m));
    if (HASH_COMMENT_EXT.includes(String(ext || "").toLowerCase())) {
      src = src.replace(/(^|\s)(#[^\n]*)/gm, (m, pre, c) => pre + stash("com", c));
    }
    src = src.replace(STR_RE, (m) => stash("str", m));
    // reset lastIndex karena regex global dipakai ulang
    KW_RE.lastIndex = 0;
    src = src.replace(KW_RE, (m) => stash("kw", m));
    NUM_RE.lastIndex = 0;
    src = src.replace(NUM_RE, (m) => stash("num", m));
  } catch {}
  const parts = src.split(/@@Z2R(\d+)TOK@@/g);
  return parts
    .map((p, idx) => (idx % 2 === 1 ? tokens[Number(p)] || "" : escapeHtml(p)))
    .join("");
}

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"];
const MIME = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", ico: "image/x-icon", avif: "image/avif",
};

function base64ToBlob(b64, mime) {
  const clean = String(b64 || "").replace(/\s/g, "");
  const bin = atob(clean);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime || "application/octet-stream" });
}

const PREVIEW_LIMIT = 300 * 1024; // 300KB
const BLOB_FETCH_LIMIT = 3 * 1024 * 1024; // maks 3MB untuk fallback blob API

export default function FileViewer({ owner, repo, branch, path, showToast, onClose, onDeleted }) {
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(null);
  const [rawB64, setRawB64] = useState("");
  const [text, setText] = useState("");
  const [isBinary, setIsBinary] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("preview"); // preview | code (khusus markdown)
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const ext = (path.split(".").pop() || "").toLowerCase();
  const isImage = IMAGE_EXT.includes(ext);
  const isMarkdown = ["md", "markdown", "mdown"].includes(ext);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      setText("");
      setRawB64("");
      setIsBinary(false);
      try {
        const token = getToken();
        const data = await getFile(token, owner, repo, path, branch);
        if (!alive) return;
        setMeta(data);
        let b64 = data.content ? String(data.content).replace(/\s/g, "") : "";
        // Contents API mengosongkan content untuk file >1MB → fallback ke Blob API
        if (!b64 && data.sha && data.size <= BLOB_FETCH_LIMIT) {
          try {
            const blob = await getBlob(token, owner, repo, data.sha);
            b64 = String(blob.content || "").replace(/\s/g, "");
          } catch {}
        }
        if (!alive) return;
        setRawB64(b64);
        if (!isImage && b64 && data.size <= PREVIEW_LIMIT) {
          const decoded = base64ToStr(b64);
          if (decoded.indexOf("\0") !== -1) setIsBinary(true);
          else setText(decoded);
        }
      } catch (e) {
        if (alive) setError(e.message || "Gagal memuat file.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [owner, repo, path, branch, isImage]);

  const highlighted = useMemo(() => {
    if (!text) return "";
    return highlightCode(text, ext)
      .split("\n")
      .map(
        (l, i) =>
          '<span class="code-line"><span class="code-no">' +
          (i + 1) +
          '</span><span class="code-tx">' +
          (l || " ") +
          "</span></span>"
      )
      .join("");
  }, [text, ext]);

  const imageUrl = useMemo(() => {
    if (!isImage || !rawB64) return "";
    try {
      return URL.createObjectURL(base64ToBlob(rawB64, MIME[ext] || "image/png"));
    } catch {
      return "";
    }
  }, [isImage, rawB64, ext]);

  useEffect(() => {
    return () => { if (imageUrl) URL.revokeObjectURL(imageUrl); };
  }, [imageUrl]);

  function copyText() {
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => showToast({ type: "success", message: "Isi file disalin ke clipboard 📋" }))
      .catch(() => showToast({ type: "error", message: "Gagal menyalin." }));
  }

  async function download() {
    setDownloading(true);
    try {
      let b64 = rawB64;
      if (!b64 && meta?.sha) {
        const blob = await getBlob(getToken(), owner, repo, meta.sha);
        b64 = String(blob.content || "").replace(/\s/g, "");
      }
      if (!b64) throw new Error("Konten file tidak tersedia.");
      triggerBlobDownload(base64ToBlob(b64, "application/octet-stream"), path.split("/").pop());
      showToast({ type: "success", message: "File diunduh ⬇️" });
    } catch (e) {
      showToast({ type: "error", message: "Gagal mengunduh: " + e.message });
    } finally {
      setDownloading(false);
    }
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await deleteFile(getToken(), owner, repo, path, meta.sha, branch);
      playDelete();
      showToast({ type: "success", message: 'File "' + path + '" dihapus 🗑️' });
      onDeleted?.(path);
      onClose();
    } catch (e) {
      showToast({ type: "error", message: e.message });
      setDeleting(false);
      setConfirmDel(false);
    }
  }

  const tooBig = meta && meta.size > PREVIEW_LIMIT && !isImage;

  return (
    <Modal onClose={onClose} wide>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-mono text-sm text-cyan-300">📄 {path}</p>
          <p className="mt-1 text-xs text-slate-500">
            {owner}/{repo} · branch <code className="font-mono text-slate-400">{branch}</code>
            {meta && <> · {fmtSize(meta.size)}</>}
          </p>
        </div>
        <button onClick={onClose} className="btn-ghost shrink-0 !px-3 !py-1.5">✕</button>
      </div>

      {/* Toolbar */}
      {!loading && !error && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {isMarkdown && text && (
            <div className="flex overflow-hidden rounded-lg border border-white/10 text-sm">
              <button
                onClick={() => setTab("preview")}
                className={`px-3 py-1.5 ${tab === "preview" ? "bg-indigo-500/30 text-white" : "text-slate-400"}`}
              >
                👁️ Preview
              </button>
              <button
                onClick={() => setTab("code")}
                className={`px-3 py-1.5 ${tab === "code" ? "bg-indigo-500/30 text-white" : "text-slate-400"}`}
              >
                {"</>"} Kode
              </button>
            </div>
          )}
          <div className="flex-1" />
          {text && <button onClick={copyText} className="btn-ghost !py-1.5 text-sm">📋 Salin</button>}
          <button onClick={download} disabled={downloading} className="btn-ghost !py-1.5 text-sm disabled:opacity-50">
            {downloading ? "⏳..." : "⬇️ Unduh"}
          </button>
          {meta?.sha && !confirmDel ? (
            <button onClick={() => setConfirmDel(true)} className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-300 transition hover:bg-rose-500/20">
              🗑️ Hapus
            </button>
          ) : meta?.sha ? (
            <span className="flex animate-pop-in items-center gap-2">
              <button onClick={doDelete} disabled={deleting} className="rounded-xl bg-rose-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50">
                {deleting ? "Menghapus..." : "Ya, hapus!"}
              </button>
              <button onClick={() => setConfirmDel(false)} className="btn-ghost !py-1.5 text-sm">Batal</button>
            </span>
          ) : null}
        </div>
      )}

      {/* Body */}
      <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#07070f]">
        {loading && (
          <div className="space-y-2 p-5">
            <div className="shimmer-line h-4 w-11/12" />
            <div className="shimmer-line h-4 w-3/4" />
            <div className="shimmer-line h-4 w-5/6" />
            <div className="shimmer-line h-4 w-2/3" />
            <p className="pt-2 text-xs text-slate-500">Memuat file...</p>
          </div>
        )}
        {error && (
          <div className="p-6 text-center">
            <p className="text-4xl">💥</p>
            <p className="mt-3 text-sm text-rose-300">{error}</p>
          </div>
        )}
        {!loading && !error && isImage && (
          imageUrl ? (
            <div className="flex items-center justify-center bg-white/[0.03] p-6">
              <img src={imageUrl} alt={path} className="max-h-[55vh] rounded-lg border border-white/10 object-contain" />
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-4xl">🖼️</p>
              <p className="mt-3 text-sm text-slate-300">Gambar tidak bisa di-preview (mungkin terlalu besar).</p>
              <button onClick={download} className="btn-primary mt-4 !py-2">⬇️ Unduh saja</button>
            </div>
          )
        )}
        {!loading && !error && !isImage && tooBig && (
          <div className="p-8 text-center">
            <p className="text-4xl">📦</p>
            <p className="mt-3 text-sm text-slate-300">File terlalu besar untuk preview ({fmtSize(meta.size)}).</p>
            <button onClick={download} className="btn-primary mt-4 !py-2">⬇️ Unduh saja</button>
          </div>
        )}
        {!loading && !error && !isImage && !tooBig && isBinary && (
          <div className="p-8 text-center">
            <p className="text-4xl">🧬</p>
            <p className="mt-3 text-sm text-slate-300">File biner — tidak bisa ditampilkan sebagai teks.</p>
            <button onClick={download} className="btn-primary mt-4 !py-2">⬇️ Unduh saja</button>
          </div>
        )}
        {!loading && !error && !isImage && !tooBig && !isBinary && text && (
          isMarkdown && tab === "preview" ? (
            <div className="thin-scroll max-h-[60vh] overflow-y-auto p-5 md:p-6">
              <Markdown text={text} owner={owner} repo={repo} branch={branch} />
            </div>
          ) : (
            <pre className="thin-scroll max-h-[60vh] overflow-auto p-4 font-mono text-xs leading-relaxed">
              <code dangerouslySetInnerHTML={{ __html: highlighted }} />
            </pre>
          )
        )}
      </div>

      <div className="mt-3 flex justify-end">
        <a
          href={`https://github.com/${owner}/${repo}/blob/${branch}/${path}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-slate-500 transition hover:text-cyan-300"
        >
          Buka di GitHub ↗
        </a>
      </div>
    </Modal>
  );
}
