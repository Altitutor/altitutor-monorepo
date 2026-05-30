import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F2F0E9] px-5 text-[#1A1A1A]">
      <div className="max-w-xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0a2941]">
          404
        </p>
        <h1 className="mt-4 text-4xl font-semibold">Page not found</h1>
        <p className="mt-4 text-lg text-black/70">
          This page is not part of the current Altitutor marketing site.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-[#0a2941] px-5 py-3 text-sm font-semibold text-white"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
