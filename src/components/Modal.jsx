import { useEffect } from "react";

/** Wrapper modal generik: backdrop blur + ESC to close + lock scroll */
export default function Modal({ onClose, children, wide = false, noPad = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${wide ? "sm:max-w-4xl" : "sm:max-w-lg"} max-h-[92vh] overflow-y-auto thin-scroll glass !rounded-t-3xl sm:!rounded-2xl ${
          noPad ? "" : "p-6 md:p-7"
        } animate-modal-in`}
      >
        {children}
      </div>
    </div>
  );
}
