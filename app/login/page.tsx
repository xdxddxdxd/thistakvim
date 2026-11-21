import { ArrowDown, ArrowRight, FileDown, Moon, NotebookPen } from "lucide-react";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { loginErrorMessage, signupErrorMessage } from "@/lib/login";
import { serverClient } from "@/lib/supabase/server";
import LandingAuth from "./LandingAuth";
import { WeeklyDemo } from "./LandingDemo";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; giris?: string; kayit?: string; kayitHata?: string }> }) {
  const client = await serverClient();
  const { data: { user } } = await client.auth.getUser();
  if (user) redirect("/");

  const params = await searchParams;
  const loginError = loginErrorMessage(params.error);
  const signupError = signupErrorMessage(params.kayitHata);
  const checkEmail = params.kayit === "bekliyor";
  const registering = params.kayit === "1" || checkEmail;
  const initiallyOpen = params.giris === "1" || Boolean(loginError) || registering;

  return (
    <main className={styles.landing} id="sayfa-basi">
      <a className={styles.skipLink} href="#ornek-plan">Örnek plana geç</a>
      <div className={styles.container}>
        <header className={styles.header}>
          <a className={styles.wordmark} href="#sayfa-basi">
            <img src="/icon.svg" alt="" width={36} height={36} />
            <span>Haftalık Plan<span className="wordmark-dot">.</span></span>
          </a>
          <nav className={styles.navigation} aria-label="Tanıtım sayfası">
            <a className={styles.navLink} href="#ornek-plan">Örnek plan</a>
            <a className={styles.navLink} href="#ozellikler">Özellikler</a>
            <LandingAuth initiallyOpen={initiallyOpen} initiallyRegistering={registering} loginError={loginError} signupError={signupError} checkEmail={checkEmail} />
          </nav>
        </header>

        {initiallyOpen && (
          <noscript>
            <section className={styles.nativeEntry} id="giris">
              <h2>{registering ? "Hesap oluştur" : "Hesabına giriş yap"}</h2>
              <nav className={styles.nativeAuthModes} aria-label="Hesap işlemi">
                <a href="/login?giris=1#giris">Giriş yap</a>
                <a href="/login?kayit=1#giris">Kayıt ol</a>
              </nav>
              <AuthForm mode={registering ? "register" : "login"} initialError={registering ? signupError : loginError} checkEmail={checkEmail} />
            </section>
          </noscript>
        )}

        <section className={styles.hero} aria-labelledby="hero-heading">
          <h1 id="hero-heading">Bu hafta ne<br />{" "}<span className={styles.emphasis}>çalışacaksın?</span></h1>
          <div className={styles.heroAside}>
            <p>YKS’ye hazırlanırken derslerini günlere böl, yaptıklarını işaretle ve çalışma süreni takip et.</p>
            <a className={styles.demoLink} href="#ornek-plan">Örnek planı dene <ArrowDown size={17} aria-hidden="true" /></a>
          </div>
        </section>

        <WeeklyDemo />

        <section className={styles.showcase} id="ozellikler" aria-labelledby="pdf-heading">
          <div className={styles.showcaseCopy}>
            <h2 id="pdf-heading">Haftanı yanında taşı.</h2>
            <p>Seçtiğin haftayı yatay, tek sayfalık bir PDF’ye aktar. Ders ve görev başlıklarını yazdırıp masanda tutabilirsin.</p>
            <ul className={styles.benefits} role="list">
              <li><NotebookPen size={19} aria-hidden="true" />Günlük not ve çalışma süresi</li>
              <li><FileDown size={19} aria-hidden="true" />Haftalık PDF çıktısı</li>
              <li><Moon size={19} aria-hidden="true" />Açık ve koyu tema</li>
            </ul>
          </div>
          <figure className={styles.printPreview}>
            <figcaption>
              <strong>Haftalık Plan</strong>
              <span>12–18 Ekim · Örnek PDF görünümü</span>
            </figcaption>
            <ul role="list">
              {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((day, index) => (
                <li key={day}>
                  <strong>{day} {12 + index}</strong>
                  <span>{["Paragraf", "Problemler", "Üçgenler", "Kuvvet", "Sözcükte anlam", "TYT denemesi", "Haftalık tekrar"][index]}</span>
                </li>
              ))}
            </ul>
          </figure>
        </section>

        <footer className={styles.footer}>
          <span>Haftalık Plan<span className="wordmark-dot">.</span></span>
          <a className={styles.textLink} href="#sayfa-basi">Sayfa başına dön <ArrowRight size={16} aria-hidden="true" /></a>
        </footer>
      </div>
    </main>
  );
}
