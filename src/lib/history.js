const HISTORY_KEY = "zip2repo_history";

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

export function addHistory(entry) {
  try {
    const list = getHistory();
    // hindari duplikat repo yang sama berurutan
    const filtered = list.filter((h) => h.html_url !== entry.html_url);
    filtered.unshift({ ...entry, at: Date.now() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, 20)));
  } catch {}
}

export function removeHistoryItem(htmlUrl) {
  try {
    const list = getHistory().filter((h) => h.html_url !== htmlUrl);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    return list;
  } catch {
    return getHistory();
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {}
}
