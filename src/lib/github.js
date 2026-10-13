import JSZip from "jszip";
import { getSettings } from "./storage.js";
import { fmtSize } from "./format.js";

const GH = "https://api.github.com";

// GitHub menolak blob >100MB — tolak duluan dengan pesan yang jelas
const MAX_SINGLE_FILE = 100 * 1024 * 1024;

/* ============================================================
 * Helper fetch GitHub API dengan pesan error ramah (Indonesia)
 * ============================================================ */
export async function gh(token, path, options = {}) {
  const res = await fetch(`${GH}${path}`, {
    ...options,
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j.message || "";
    } catch {}
    const err = new Error(friendlyError(res.status, detail, path, options.method));
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  if (res.status === 204) return null;
  // 304 / kosong
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function friendlyError(status, detail = "", path = "", method = "GET") {
  const d = detail.toLowerCase();
  if (status === 401) return "Token tidak valid atau kedaluwarsa. Perbarui token di Settings.";
  if (status === 403) {
    if (d.includes("rate limit")) return "Rate limit GitHub tercapai. Tunggu beberapa menit lalu coba lagi.";
    if (method === "DELETE" || (path || "").includes("/git/refs/"))
      return "Akses ditolak. Untuk MENGHAPUS repo/branch, token harus punya scope 'delete_repo'. Buat token baru dengan scope repo + delete_repo.";
    return "Akses ditolak GitHub. Pastikan token punya permission 'repo' (dan 'delete_repo' untuk hapus).";
  }
  if (status === 404) {
    if (method === "DELETE")
      return "Gagal menghapus (404). Kemungkinan token tidak punya scope 'delete_repo', atau repo sudah tidak ada.";
    return "Resource tidak ditemukan di GitHub. Cek kembali token & nama repo.";
  }
  if (status === 409) return "Konflik pada repository (mungkin sedang kosong / branch berubah). Coba lagi.";
  if (status === 422) return detail || "Data tidak valid ditolak GitHub (422).";
  return detail ? `GitHub error ${status}: ${detail}` : `GitHub error ${status}.`;
}

/* ============================================================
 * Base64 unicode-safe
 * ============================================================ */
export function strToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

export function base64ToStr(b64) {
  const clean = String(b64 || "").replace(/\s/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  try {
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return bin;
  }
}

export function isProbablyBinary(str) {
  if (!str) return false;
  // cek null-byte pada 8KB pertama
  return str.slice(0, 8192).includes("\0");
}

/* ============================================================
 * Ekstraksi ZIP di browser
 * ============================================================ */
export async function extractZip(file, onProgress) {
  let zip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error("File ZIP rusak / corrupt atau bukan file ZIP yang valid.");
  }

  const rawEntries = Object.values(zip.files).filter((f) => !f.dir);
  if (rawEntries.length === 0) throw new Error("ZIP kosong — tidak ada file di dalamnya.");
  if (rawEntries.length > 1000)
    throw new Error(`ZIP berisi ${rawEntries.length} file. Maksimal 1000 file agar proses stabil.`);

  // Deteksi satu folder root yang membungkus semua file → di-strip
  const paths = rawEntries.map((f) => f.name.replace(/\\/g, "/"));
  let prefix = "";
  const firstSeg = paths[0].split("/")[0];
  if (paths.every((p) => p.startsWith(firstSeg + "/"))) prefix = firstSeg + "/";

  const skipRe = /(^|\/)(__MACOSX|\.git|\.DS_Store|Thumbs\.db)(\/|$)/;

  const files = [];
  let done = 0;
  let skipped = 0;
  for (const entry of rawEntries) {
    const cleanPath = entry.name.replace(/\\/g, "/").slice(prefix.length);
    if (!cleanPath || skipRe.test(entry.name)) {
      done++;
      skipped++;
      continue;
    }
    const base64 = await entry.async("base64");
    const decodedSize = Math.floor(base64.length * 0.75);
    if (decodedSize > MAX_SINGLE_FILE) {
      throw new Error(
        `File "${cleanPath}" (${fmtSize(decodedSize)}) melebihi batas 100MB per file dari GitHub API. Kecilkan / pecah file tersebut lalu coba lagi.`
      );
    }
    files.push({ path: cleanPath, contentBase64: base64, size: (entry._data && entry._data.uncompressedSize) || decodedSize });
    done++;
    onProgress?.(Math.round((done / rawEntries.length) * 100), cleanPath);
  }

  if (files.length === 0) throw new Error("Tidak ada file valid di dalam ZIP (hanya berisi file sistem).");
  return { files, skipped };
}

/* ============================================================
 * Retry helper: repo baru kadang butuh beberapa detik sampai siap
 * ============================================================ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, { tries = 5, baseDelay = 900, retryOn = [404, 409] } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!retryOn.includes(e.status) || i === tries - 1) throw e;
      await sleep(baseDelay * (i + 1)); // backoff: 0.9s, 1.8s, 2.7s, ...
    }
  }
  throw lastErr;
}

/* ============================================================
 * Push semua file ke repo (Git Data API)
 * Mendukung repo BARU maupun repo EXISTING (mode timpa / gabung)
 * ============================================================ */
export async function pushFiles({
  token,
  owner,
  repo,
  files,
  branch = "main",
  onProgress,
  onStatus,
  commitMessage,
  merge = false,
  autoReadme,
}) {
  const settings = getSettings();
  const msg = commitMessage || settings.commitMessage || "🚀 Upload via Zip2Repo";
  const wantReadme = autoReadme ?? settings.autoReadme !== false;

  // Tambah README.md otomatis jika tidak ada
  const hasReadme = files.some((f) => f.path.toLowerCase() === "readme.md");
  if (!hasReadme && wantReadme) {
    const readme = `# ${repo}\n\nDiunggah pada ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} · ${files.length} file\n\n---\n*Powered by [Zip2Repo](https://github.com) — a RifkyDev project* ⚡\n`;
    files = [...files, { path: "README.md", contentBase64: strToBase64(readme), size: readme.length }];
  }

  // 0. Ambil ref branch + commit HEAD (tunggu repo siap)
  onStatus?.("Menunggu repository siap...");
  const ref = await withRetry(
    () => gh(token, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`),
    { tries: 6, baseDelay: 1000 }
  );
  const baseCommitSha = ref.object.sha;

  // Mode gabung: ambil tree lama sebagai base agar file lama tidak hilang
  let baseTreeSha = null;
  if (merge) {
    onStatus?.("Mengambil struktur repo lama (mode gabung)...");
    const baseCommit = await withRetry(() => gh(token, `/repos/${owner}/${repo}/git/commits/${baseCommitSha}`));
    baseTreeSha = baseCommit.tree.sha;
  }

  // 1. Buat blob untuk setiap file (paralel terbatas + retry)
  onStatus?.("Mengunggah file ke GitHub...");
  const blobs = new Array(files.length);
  let completed = 0;
  const CONCURRENCY = 6;
  let idx = 0;

  async function worker() {
    while (idx < files.length) {
      const i = idx++;
      const f = files[i];
      const blob = await withRetry(() =>
        gh(token, `/repos/${owner}/${repo}/git/blobs`, {
          method: "POST",
          body: JSON.stringify({ content: f.contentBase64, encoding: "base64" }),
        })
      );
      blobs[i] = { path: f.path, mode: "100644", type: "blob", sha: blob.sha };
      completed++;
      onProgress?.(Math.round((completed / files.length) * 100), f.path);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));

  // 2. Buat tree
  onStatus?.("Menyusun struktur file (tree)...");
  const treePayload = baseTreeSha ? { base_tree: baseTreeSha, tree: blobs } : { tree: blobs };
  const tree = await withRetry(() =>
    gh(token, `/repos/${owner}/${repo}/git/trees`, {
      method: "POST",
      body: JSON.stringify(treePayload),
    })
  );

  // 3. Buat commit dengan parent commit HEAD
  onStatus?.("Membuat commit...");
  const commit = await withRetry(() =>
    gh(token, `/repos/${owner}/${repo}/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message: msg, tree: tree.sha, parents: [baseCommitSha] }),
    })
  );

  // 4. Update branch ke commit baru
  onStatus?.(`Memperbarui branch ${branch}...`);
  await withRetry(() =>
    gh(token, `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: true }),
    })
  );

  return { commitSha: commit.sha, fileCount: files.length };
}

/* ============================================================
 * Panggilan ke backend sendiri (Express / serverless)
 * ============================================================ */
export async function apiValidateToken(token) {
  const res = await fetch("/api/validate-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Gagal memvalidasi token.");
  return data;
}

export async function apiCreateRepo({ token, name, isPrivate, description }) {
  const res = await fetch("/api/create-repo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, name, isPrivate, description }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Gagal membuat repository.");
  return data;
}

/* ============================================================
 * 🆕 MANAJEMEN REPO — langsung browser → GitHub API
 * ============================================================ */

/** Daftar semua repo milik user (otomatis pagination, maks ~500 repo) */
export async function listRepos(token, { type = "all", sort = "updated", direction = "desc", maxPages = 5 } = {}) {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await gh(
      token,
      `/user/repos?per_page=100&page=${page}&sort=${sort}&direction=${direction}&type=${type}`
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

/** Detail satu repo */
export async function getRepo(token, owner, repo) {
  return gh(token, `/repos/${owner}/${repo}`);
}

/** 🗑️ Hapus repo (butuh scope delete_repo) */
export async function deleteRepo(token, owner, repo) {
  return gh(token, `/repos/${owner}/${repo}`, { method: "DELETE" });
}

/** ✏️ Update repo: { name, description, homepage, private, default_branch, ... } */
export async function updateRepo(token, owner, repo, patch) {
  return gh(token, `/repos/${owner}/${repo}`, { method: "PATCH", body: JSON.stringify(patch) });
}

/** 🏷️ Update topics repo */
export async function updateTopics(token, owner, repo, names) {
  return gh(token, `/repos/${owner}/${repo}/topics`, {
    method: "PUT",
    body: JSON.stringify({ names }),
  });
}

/** 🌿 Daftar branch */
export async function listBranches(token, owner, repo) {
  return gh(token, `/repos/${owner}/${repo}/branches?per_page=100`);
}

/** 🌿 Buat branch baru dari SHA commit */
export async function createBranch(token, owner, repo, branchName, sha) {
  return gh(token, `/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
  });
}

/** 🌿 Hapus branch */
export async function deleteBranch(token, owner, repo, branchName) {
  return gh(token, `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branchName)}`, {
    method: "DELETE",
  });
}

/** 📂 Tree file rekursif dari sebuah branch */
export async function getTree(token, owner, repo, branch = "main") {
  const ref = await gh(token, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  const tree = await gh(token, `/repos/${owner}/${repo}/git/trees/${ref.object.sha}?recursive=1`);
  return { ...tree, headSha: ref.object.sha };
}

/** 🧱 Blob mentah (fallback saat Contents API mengosongkan content file >1MB) */
export async function getBlob(token, owner, repo, sha) {
  return gh(token, `/repos/${owner}/${repo}/git/blobs/${sha}`);
}

/** 📄 Isi satu file (Contents API) */
export async function getFile(token, owner, repo, path, branch) {
  const clean = path.split("/").map(encodeURIComponent).join("/");
  const q = branch ? `?ref=${encodeURIComponent(branch)}` : "";
  return gh(token, `/repos/${owner}/${repo}/contents/${clean}${q}`);
}

/** 📄 Buat / timpa satu file */
export async function upsertFile(token, owner, repo, path, contentBase64, branch, message, sha = null) {
  const clean = path.split("/").map(encodeURIComponent).join("/");
  const body = { message, content: contentBase64, branch };
  if (sha) body.sha = sha;
  return gh(token, `/repos/${owner}/${repo}/contents/${clean}`, { method: "PUT", body: JSON.stringify(body) });
}

/** 🗑️ Hapus satu file dari repo */
export async function deleteFile(token, owner, repo, path, sha, branch, message) {
  const clean = path.split("/").map(encodeURIComponent).join("/");
  return gh(token, `/repos/${owner}/${repo}/contents/${clean}`, {
    method: "DELETE",
    body: JSON.stringify({ message: message || `🗑️ Hapus ${path} via Zip2Repo`, sha, branch }),
  });
}

/** 🕘 Riwayat commit */
export async function listCommits(token, owner, repo, branch, perPage = 30) {
  const q = branch ? `&sha=${encodeURIComponent(branch)}` : "";
  return gh(token, `/repos/${owner}/${repo}/commits?per_page=${perPage}${q}`);
}

/** 📊 Bahasa yang dipakai repo → { JavaScript: 12345, ... } (bytes) */
export async function getLanguages(token, owner, repo) {
  return gh(token, `/repos/${owner}/${repo}/languages`);
}

/** 📖 README repo (null jika tidak ada) */
export async function getReadme(token, owner, repo, branch) {
  try {
    const q = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    const data = await gh(token, `/repos/${owner}/${repo}/readme${q}`);
    return { ...data, text: base64ToStr(data.content || "") };
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

/** ⭐ Cek / tambah / hapus star */
export async function isStarred(token, owner, repo) {
  try {
    await gh(token, `/user/starred/${owner}/${repo}`);
    return true;
  } catch (e) {
    if (e.status === 404) return false;
    throw e;
  }
}
export async function starRepo(token, owner, repo) {
  return gh(token, `/user/starred/${owner}/${repo}`, { method: "PUT" });
}
export async function unstarRepo(token, owner, repo) {
  return gh(token, `/user/starred/${owner}/${repo}`, { method: "DELETE" });
}

/** ⬇️ Download repo sebagai ZIP (Blob) */
export async function downloadRepoZip(token, owner, repo, branch = "main") {
  const res = await fetch(`${GH}/repos/${owner}/${repo}/zipball/${encodeURIComponent(branch)}`, {
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(friendlyError(res.status, "", "", "GET"));
  return res.blob();
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/** URL deploy instan */
export function deployUrls(htmlUrl) {
  const enc = encodeURIComponent(htmlUrl);
  return {
    vercel: `https://vercel.com/new/clone?repository-url=${enc}`,
    netlify: `https://app.netlify.com/start/deploy?repository=${enc}`,
    railway: `https://railway.app/new/github?repository=${enc}`,
  };
}
