"use client";

import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-100">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white font-bold">AI</span>
              <span className="font-semibold tracking-tight">AI Consulting</span>
            </Link>
            {/* Nav */}
            <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
              <Link href="#" className="hover:text-gray-900">Product</Link>
              <Link href="#" className="hover:text-gray-900">Blogs</Link>
            </nav>
            {/* Actions */}
            <div className="flex items-center gap-3" />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pt-16 sm:pt-24 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
          Speed up applicant screening
          <br className="hidden sm:block" />
          <span className="text-indigo-600"> 20x with </span>
          <span className="bg-gradient-to-r from-indigo-600 to-purple-500 bg-clip-text text-transparent">AI Consulting</span>
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-gray-600">
          AI Consulting pre-screens and interviews candidates, helping you shortlist talent faster and more efficiently. A fully automated workflow that seamlessly integrates into your hiring process.
        </p>
        <div className="mt-8">
          <Link
            href="/setup"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-white text-sm sm:text-base font-semibold shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            Try the Demo
          </Link>
        </div>
      </section>

      {/* Video Card */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 mt-12 sm:mt-16 pb-20">
        <div className="mx-auto max-w-4xl">
          <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl ring-1 ring-gray-200">
            {/* Video */}
            <video
              src="https://storage.googleapis.com/ai_recruiter_bucket_prod/assets/videos/olivia_character_no_audio.mp4"
              className="w-full aspect-video object-cover"
              autoPlay
              loop
              muted
              playsInline
            />

            {/* Overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />

            {/* Bottom content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
              <div className="mt-auto mb-10 text-center">
                <div className="text-white text-xl sm:text-2xl font-semibold drop-shadow">Olivia is calling</div>
                <div className="mt-4 pointer-events-auto">
                  <Link
                    href="/setup"
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-white text-sm font-semibold shadow hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <span className="inline-block h-2 w-2 rounded-full bg-white" />
                    Start Video Interview
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

