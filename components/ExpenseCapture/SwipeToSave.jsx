import { useEffect, useRef, useState } from "react";

const completionRatio = 0.72;

export default function SwipeToSave({ disabled, onComplete }) {
  const trackRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [maxDrag, setMaxDrag] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (!isSaved) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsSaved(false);
      setDragX(0);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [isSaved]);

  function getMaxDrag() {
    const width = trackRef.current?.getBoundingClientRect().width || 0;
    return Math.max(width - 58, 0);
  }

  function handlePointerMove(event) {
    if (!isDragging || disabled || isSaved) {
      return;
    }

    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const next = Math.min(Math.max(event.clientX - rect.left - 29, 0), maxDrag || getMaxDrag());
    setDragX(next);
  }

  async function complete() {
    if (disabled || isSaved) {
      return;
    }

    setDragX(maxDrag || getMaxDrag());
    navigator.vibrate?.(12);
    playSaveTone();
    await onComplete();
    setIsSaved(true);
  }

  function handlePointerUp() {
    if (!isDragging) {
      return;
    }

    setIsDragging(false);
    if (dragX >= (maxDrag || getMaxDrag()) * completionRatio) {
      complete();
      return;
    }

    setDragX(0);
  }

  return (
    <div className="space-y-2">
      <div
        ref={trackRef}
        className={[
          "relative h-16 overflow-hidden rounded-3xl border p-1.5 shadow-[0_14px_34px_rgba(0,102,255,0.18)] transition",
          disabled
            ? "border-slate-200 bg-slate-100 text-slate-400 shadow-none"
            : isSaved
              ? "border-emerald-100 bg-emerald-500 text-white"
              : "border-blue-100 bg-[#0066ff] text-white"
        ].join(" ")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          setIsDragging(false);
          setDragX(0);
        }}
      >
        <div
          className="absolute inset-y-1.5 left-1.5 right-1.5 origin-left rounded-[1.35rem] bg-white/20 will-change-transform"
          style={{ transform: `scaleX(${Math.min((dragX + 56) / Math.max((maxDrag || 1) + 46, 1), 1)})` }}
        />
        <button
          type="button"
          disabled={disabled}
          onPointerDown={(event) => {
            if (disabled || isSaved) {
              return;
            }
            event.currentTarget.setPointerCapture(event.pointerId);
            setMaxDrag(getMaxDrag());
            setIsDragging(true);
          }}
          className={[
            "absolute left-1.5 top-1.5 flex h-[52px] w-[52px] items-center justify-center rounded-[1.15rem] bg-white text-xl font-black shadow-lg transition-transform active:scale-95 disabled:text-slate-300",
            disabled ? "text-slate-300" : isSaved ? "scale-100 text-emerald-600" : "text-[#0066ff]"
          ].join(" ")}
          style={{ transform: `translateX(${dragX}px) ${isSaved ? "scale(1)" : "scale(0.98)"}` }}
          aria-label="Guardar gasto"
        >
          <span className={isSaved ? "animate-parserPulse" : ""}>{isSaved ? "OK" : ">"}</span>
        </button>
        <div className="pointer-events-none flex h-full items-center justify-center px-16 text-sm font-black">
          {isSaved ? "Gasto guardado" : disabled ? "Escribi un monto para guardar" : "Desliza para guardar"}
        </div>
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="flex h-10 w-full items-center justify-center rounded-2xl text-xs font-black text-slate-400 transition active:scale-[0.98] disabled:opacity-50"
      >
        O toca aca para guardar
      </button>
    </div>
  );
}

function playSaveTone() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return;
    }

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.03, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.13);
  } catch {
    // Audio feedback is optional.
  }
}
