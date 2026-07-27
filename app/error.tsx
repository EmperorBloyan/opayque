"use client";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-md rounded-[2rem] border border-white/10 bg-zinc-950 p-8 text-center">
        <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Terminal Error</p>
        <h2 className="mt-3 text-2xl font-black">The payment flow hit an unexpected runtime issue.</h2>
        <p className="mt-3 text-sm text-zinc-400">The terminal interface can recover automatically. Retry the step or return to the home screen.</p>
        <button onClick={() => reset()} className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-black uppercase text-black">
          Retry Flow
        </button>
      </div>
    </div>
  );
}
