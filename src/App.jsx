import { useCallback, useEffect, useState } from "react";
import Background from "./components/Background.jsx";
import Logo from "./components/Logo.jsx";
import TokenGate from "./components/TokenGate.jsx";
import Uploader from "./components/Uploader.jsx";
import Dashboard from "./components/Dashboard.jsx";
import TemplateGallery from "./components/TemplateGallery.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import Toast from "./components/Toast.jsx";
import SplashScreen from "./components/SplashScreen.jsx";
import CursorGlow from "./components/CursorGlow.jsx";
import { getToken, getUser } from "./lib/storage.js";
import { playClick } from "./lib/sfx.js";

const TABS = [
  { id: "upload", icon: "🚀", label: "Upload" },
  { id: "repos", icon: "📚", label: "Repo Saya" },
  { id: "templates", icon: "🎨", label: "Template" },
];

export default function App() {
  const [user, setUser] = useState(getUser());
  const [hasToken, setHasToken] = useState(!!getToken());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [tab, setTab] = useState("upload");
  const [booted, setBooted] = useState(() => sessionStorage.getItem("z2r_booted") === "1");

  const showToast = useCallback((t) => {
    const id = Date.now() + Math.random();
    setToasts((ls) => [...ls.slice(-3), { ...t, id }]);
    setTimeout(() => {
      setToasts((ls) => ls.filter((x) => x.id !== id));
    }, 4500);
  }, []);

  const closeToast = useCallback((id) => {
    setToasts((ls) => ls.filter((x) => x.id !== id));
  }, []);

  function finishBoot() {
    sessionStorage.setItem("z2r_booted", "1");
    setBooted(true);
  }

  function handleTokenSaved(u) {
    setUser(u);
    setHasToken(true);
    setTab("upload");
  }

  function handleTokenCleared() {
    setUser(null);
    setHasToken(false);
    setSettingsOpen(false);
  }

  // Ctrl+K → ke tab Repo + fokus pencarian
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!hasToken) return;
        setTab("repos");
        setTimeout(() => window.dispatchEvent(new Event("z2r-focus-search")), 150);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasToken]);

  function switchTab(id) {
    playClick();
    setTab(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex min-h-screen flex-col">
      {!booted && <SplashScreen onDone={finishBoot} />}
      <Background />
      <CursorGlow />

      {/* Navbar */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-night-900/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5">
          <button onClick={() => hasToken && switchTab("upload")} className="flex items-center gap-2.5">
            <Logo size={36} />
            <div className="text-left">
              <p className="font-extrabold leading-tight text-white">
                Zip<span className="gradient-text">2</span>Repo
                <span className="ml-1.5 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-1.5 py-0.5 align-middle text-[9px] font-bold text-cyan-300">
                  v2.1
                </span>
              </p>
              <p className="text-[10px] leading-tight text-slate-500">
                by <span className="gradient-text font-bold">RifkyDev</span> ⚡
              </p>
            </div>
          </button>

          {/* Tab desktop */}
          {hasToken && (
            <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 md:flex">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => switchTab(t.id)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
                    tab === t.id
                      ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-[0_0_16px_rgba(99,102,241,0.5)]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>{t.icon}</span> {t.label}
                </button>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-2">
            {hasToken && (
              <button
                onClick={() => {
                  setTab("repos");
                  setTimeout(() => window.dispatchEvent(new Event("z2r-focus-search")), 150);
                }}
                className="btn-ghost hidden !px-3 !py-2 text-sm lg:flex"
                title="Cari repo (Ctrl+K)"
              >
                🔍 <kbd className="rounded border border-white/15 bg-white/5 px-1.5 font-mono text-[10px]">Ctrl K</kbd>
              </button>
            )}
            {user && (
              <a
                href={user.html_url}
                target="_blank"
                rel="noreferrer"
                className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 transition hover:bg-white/[0.09] sm:flex"
                title={`@${user.login}`}
              >
                <img src={user.avatar_url} alt={user.login} className="h-7 w-7 rounded-full ring-2 ring-indigo-400/40" />
                <span className="max-w-[100px] truncate text-sm font-medium text-slate-200">@{user.login}</span>
              </a>
            )}
            <button onClick={() => setSettingsOpen(true)} className="btn-ghost group !px-3" title="Settings">
              <span className="inline-block transition-transform duration-500 group-hover:rotate-90">⚙️</span>
              <span className="hidden md:inline">Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className={`flex-1 ${hasToken ? "pb-24 md:pb-0" : ""}`}>
        {hasToken ? (
          <div key={tab} className="animate-fade-in">
            {tab === "upload" && (
              <Uploader user={user} showToast={showToast} onTokenInvalid={handleTokenCleared} />
            )}
            {tab === "repos" && (
              <Dashboard
                user={user}
                showToast={showToast}
                onTokenInvalid={handleTokenCleared}
                goUpload={() => switchTab("upload")}
              />
            )}
            {tab === "templates" && (
              <TemplateGallery user={user} showToast={showToast} onTokenInvalid={handleTokenCleared} />
            )}
          </div>
        ) : (
          <TokenGate onSuccess={handleTokenSaved} showToast={showToast} />
        )}
      </main>

      {/* Bottom nav (mobile) */}
      {hasToken && (
        <nav className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-white/10 bg-night-800/90 shadow-[0_8px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl md:hidden">
          <div className="grid grid-cols-3 gap-1 p-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-semibold transition-all ${
                  tab === t.id
                    ? "bg-gradient-to-r from-indigo-500/40 to-cyan-500/30 text-white"
                    : "text-slate-500"
                }`}
              >
                <span className="text-xl">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Footer */}
      <footer className={`border-t border-white/5 py-6 ${hasToken ? "hidden md:block" : ""}`}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} <span className="font-semibold text-slate-400">Zip2Repo v2.1</span> · All rights reserved
          </p>
          <div className="group flex items-center gap-2">
            <span className="text-xs text-slate-500">Developed by</span>
            <span className="relative inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-gradient-to-r from-indigo-500/15 to-cyan-400/15 px-3 py-1 transition-all duration-300 group-hover:border-indigo-400/60 group-hover:shadow-[0_0_18px_rgba(99,102,241,0.45)]">
              <span className="text-sm">⚡</span>
              <span className="gradient-text text-sm font-extrabold tracking-wide">RifkyDev</span>
            </span>
          </div>
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-slate-600 transition hover:text-cyan-300"
          >
            Kelola token GitHub ↗
          </a>
        </div>
      </footer>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        onUserChange={(u) => { setUser(u); setHasToken(true); }}
        onTokenCleared={handleTokenCleared}
        showToast={showToast}
      />
      <Toast toasts={toasts} onClose={closeToast} />
    </div>
  );
}
