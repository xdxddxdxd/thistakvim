"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
export default function LoginForm({ initialError = "" }: { initialError?: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(initialError),
    [show, setShow] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.get("username"),
          password: data.get("password"),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      window.location.assign("/");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Giriş yapılamadı. Tekrar dene.",
      );
      setBusy(false);
    }
  }
  return (
    <form action="/api/auth/login" method="post" onSubmit={submit} className="login-form">
      <label>
        Kullanıcı adı
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={64}
          placeholder="Kullanıcı adın"
          disabled={busy}
        />
      </label>
      <div>
        <label htmlFor="login-password">Şifre</label>
        <div className="password-field">
          <input
            id="login-password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={256}
            placeholder="Şifren"
            disabled={busy}
          />
          <button
            type="button"
            className="icon-button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"}
          >
            {show ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="button primary login-submit" disabled={busy}>
        {busy ? (
          <LoaderCircle className="spinner" size={19} />
        ) : (
          <>
            Giriş yap
            <ArrowRight size={19} />
          </>
        )}
      </button>
    </form>
  );
}
