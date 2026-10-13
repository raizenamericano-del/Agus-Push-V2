export default function EmptyState({ icon = "📭", title, desc, action }) {
  return (
    <div className="glass mx-auto max-w-md p-10 text-center animate-pop-in">
      <span className="inline-block text-6xl animate-float">{icon}</span>
      <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
      {desc && <p className="mt-2 text-sm text-slate-400">{desc}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
