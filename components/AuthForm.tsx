"use client";

import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { checkEmailMessage, maxAccountName, maxEmail, maxPassword, minSignupPassword } from "@/lib/login";

export default function AuthForm({
  mode = "login",
  initialError = "",
  checkEmail = false,
}: {
  mode?: "login" | "register";
  initialError?: string;
  checkEmail?: boolean;
}) {
  const registering = mode === "register";
  const passwordId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [show, setShow] = useState(false);
  const [awaitingEmail, setAwaitingEmail] = useState(checkEmail);
  const action = registering ? "/api/auth/signup" : "/api/auth/login";
  const fallbackError = registering ? "Kayıt yapılamadı. Bağlantını kontrol edip tekrar dene." : "Giriş yapılamadı. Bağlantını kontrol edip tekrar dene.";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(data)),
      });
      const result = await response.json();
      if (response.ok && result?.ok === true) {
        if (result.checkEmail) {
          setAwaitingEmail(true);
          setShow(false);
        } else {
          window.location.assign("/");
          return;
        }
      } else {
        setError(typeof result?.error === "string" ? result.error : fallbackError);
      }
    } catch {
      setError(fallbackError);
    }
    setBusy(false);
  }

  if (registering && awaitingEmail) {
    return (
      <div className="login-form">
        <p className="auth-form-notice" role="status">{checkEmailMessage}</p>
        <a className="button secondary" href="/login?kayit=1#giris" onClick={(event) => {
          event.preventDefault();
          setAwaitingEmail(false);
        }}>
          Başka e-posta kullan
        </a>
      </div>
    );
  }

  return (
    <form action={action} method="post" onSubmit={submit} className="login-form">
      {registering ? (
        <>
          <label>Adın<input name="name" autoComplete="nickname" required maxLength={maxAccountName} disabled={busy} /></label>
          <label>E-posta<input name="email" type="email" autoComplete="email" required maxLength={maxEmail} disabled={busy} /></label>
        </>
      ) : (
        <label>
          E-posta veya kullanıcı adı
          <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={maxEmail} disabled={busy} />
        </label>
      )}
      <div>
        <label htmlFor={passwordId}>Şifre</label>
        <div className="password-field">
          <input
            id={passwordId}
            name="password"
            type={show ? "text" : "password"}
            autoComplete={registering ? "new-password" : "current-password"}
            minLength={registering ? minSignupPassword : undefined}
            maxLength={maxPassword}
            aria-describedby={registering ? `${passwordId}-hint` : undefined}
            required
            disabled={busy}
          />
          <button type="button" className="icon-button" onClick={() => setShow((visible) => !visible)}
            aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"} aria-controls={passwordId} disabled={busy}>
            {show ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
          </button>
        </div>
        {registering && <p id={`${passwordId}-hint`} className="auth-form-hint">En az {minSignupPassword} karakter</p>}
      </div>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button type="submit" className="button primary login-submit" disabled={busy}>
        {registering ? (busy ? "Hesap oluşturuluyor…" : "Kayıt ol") : (busy ? "Giriş yapılıyor…" : "Giriş yap")}
        {busy ? <LoaderCircle className="spinner" size={19} aria-hidden="true" /> : <ArrowRight size={19} aria-hidden="true" />}
      </button>
    </form>
  );
}
