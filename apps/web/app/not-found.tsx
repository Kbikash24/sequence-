import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="glass max-w-sm rounded-3xl p-8 text-center">
        <h1 className="font-display text-2xl font-bold">Nothing here</h1>
        <p className="mt-2 text-sm text-slate-400">
          That page or room code doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold hover:bg-white/15"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
