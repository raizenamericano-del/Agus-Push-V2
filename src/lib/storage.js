const KEY = "zip2repo_token";
const USER_KEY = "zip2repo_user";
const SETTINGS_KEY = "zip2repo_settings_v2";

export function getToken() {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(KEY, token);
  } catch {}
}

export function clearToken() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(USER_KEY);
  } catch {}
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function setUser(user) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
}

export function maskToken(token) {
  if (!token) return "";
  if (token.length <= 10) return token[0] + "•••" + token.slice(-2);
  return token.slice(0, 7) + "••••••••••" + token.slice(-4);
}

/* ---------- Pengaturan aplikasi ---------- */

const DEFAULT_SETTINGS = {
  defaultVisibility: "public", // public | private
  defaultBranch: "main",
  commitMessage: "🚀 Upload via Zip2Repo",
  autoReadme: true,
  sound: true,
};

export function getSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { ...DEFAULT_SETTINGS, ...raw };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function setSettings(patch) {
  try {
    const next = { ...getSettings(), ...patch };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return getSettings();
  }
}

/** Apakah token (kemungkinan) punya scope delete_repo? null = tidak diketahui (fine-grained). */
export function canDelete() {
  try {
    const user = getUser();
    if (!user) return false;
    if (user.has_delete_scope === true) return true;
    if (user.has_delete_scope === false) return false;
    const scopes = user.scopes || [];
    if (scopes.length === 0) return null; // fine-grained: tidak terdeteksi, coba saja
    return scopes.includes("delete_repo");
  } catch {
    return false;
  }
}
