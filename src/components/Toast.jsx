/** Toast bertumpuk (stacked) — mendukung banyak notifikasi sekaligus */
export default function Toast({ toasts, onClose }) {
  if (!toasts?.length) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4 md:bottom-6">
      {toasts.map((t) => {
        const isError = t.type === "error";
        return (
          <div key={t.id} className="glass animate-toast-in relative flex items-start gap-3 overflow-hidden border px-4 py-3">
            <span className={`mt-0.5 text-lg ${isError ? "text-rose-400" : "text-emerald-400"}`}>
              {isError ? "⚠️" : "✅"}
            </span>
            <p className="flex-1 text-sm text-slate-200">{t.message}</p>
            <button onClick={() => onClose(t.id)} className="text-slate-400 transition hover:text-white">✕</button>
            <span
              className={`absolute bottom-0 left-0 h-0.5 rounded-full ${isError ? "bg-rose-400" : "bg-emerald-400"} animate-toast-bar`}
            />
          </div>
        );
      })}
    </div>
  );
}
