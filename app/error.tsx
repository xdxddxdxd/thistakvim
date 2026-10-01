"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Planın yüklenemedi.</h1>
      <p>Bağlantını kontrol edip tekrar dene.</p>
      <button className="button primary" onClick={reset}>
        Tekrar dene
      </button>
    </main>
  );
}
