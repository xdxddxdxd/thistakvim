import { serverClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowRight, Check, Clock3, FileDown, Moon } from "lucide-react";
import LoginForm from "@/components/LoginForm";
import { loginErrorMessage } from "@/lib/login";
import styles from "./page.module.css";

const exampleWeek = [
  { day: "Pzt", name: "Pazartesi", task: "Paragraf", course: "Türkçe", color: "#ffd52a", done: true },
  { day: "Sal", name: "Salı", task: "Problemler", course: "Matematik", color: "#ed3934", done: true },
  { day: "Çar", name: "Çarşamba", task: "Üçgenler", course: "Geometri", color: "#4545ee", done: false },
  { day: "Per", name: "Perşembe", task: "Kuvvet", course: "Fizik", color: "#36aafa", done: false },
  { day: "Cum", name: "Cuma", task: "Paragraf", course: "Türkçe", color: "#ffd52a", done: false },
  { day: "Cmt", name: "Cumartesi", task: "Deneme", course: "Genel", color: "#faf7ef", done: false },
  { day: "Paz", name: "Pazar", task: "Tekrar", course: "Genel", color: "#faf7ef", done: false },
];

export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (user) redirect("/");
  const params = await searchParams;
  return (
    <main className={styles.landing} id="sayfa-basi">
      <a className={styles.skipLink} href="#giris">Giriş formuna geç</a>
      <div className={styles.container}>
        <header className={styles.header}>
          <a className={styles.wordmark} href="#sayfa-basi" aria-label="Haftalık Plan, sayfa başı">Haftalık Plan<span className="wordmark-dot">.</span></a>
          <nav aria-label="Tanıtım sayfası"><a className={styles.navLink} href="#ozellikler">Özellikler</a><a className={styles.navLogin} href="#giris">Giriş yap<ArrowRight size={16} aria-hidden="true" /></a></nav>
        </header>

        <section className={styles.hero} aria-labelledby="hero-heading">
          <div className={styles.intro}>
            <h1 id="hero-heading">Bir hafta.<br />Daha <span className={styles.emphasis}>net bir plan.</span></h1>
            <p className={styles.description}>YKS’ye hazırlanırken derslerini günlere böl, yaptıklarını işaretle, çalışma süreni takip et. Haftalık Plan ile ne yapacağın da ne kadar ilerlediğin de gözünün önünde olsun.</p>
            <div className={styles.actions}><a className="button primary" href="#giris">Planına giriş yap<ArrowRight size={18} aria-hidden="true" /></a><a className={styles.textLink} href="#ozellikler">Özellikleri gör<ArrowDown size={16} aria-hidden="true" /></a></div>

            <figure className={styles.preview} aria-labelledby="preview-caption">
              <figcaption id="preview-caption"><strong>Haftan bir arada.</strong><span>Örnek plan görünümü</span></figcaption>
              <ol className={styles.previewWeek}>
                {exampleWeek.map((day, index) => <li key={day.day} className={`${styles.previewDay} ${day.done ? styles.previewDone : ""} ${index === 3 ? styles.previewSelected : ""}`}>
                  <div className={styles.previewDayName}><abbr title={day.name}>{day.day}</abbr>{day.done && <Check size={12} aria-label="Tamamlandı" />}</div>
                  <span className={styles.previewTask} title={`${day.course}: ${day.task}`}><span className={styles.courseDot} style={{ background: day.color }} aria-hidden="true" /><span>{day.task}</span></span>
                  <span className={styles.previewCourse}>{day.course}</span>
                </li>)}
              </ol>
              <div className={styles.previewFooter}><span><Check size={14} aria-hidden="true" />Yaptıklarını işaretle</span><span><Clock3 size={14} aria-hidden="true" />Süreni kaydet</span></div>
            </figure>
          </div>

          <section className={`login-card ${styles.signIn}`} id="giris" tabIndex={-1} aria-labelledby="login-heading">
            <h2 id="login-heading">Hoş geldin.</h2>
            <p>Haftalık planına kaldığın yerden devam et.</p>
            <LoginForm initialError={loginErrorMessage(params.error)} />
            <div className={styles.signInNote}>Planla. Yap. İşaretle.</div>
          </section>
        </section>

        <section className={styles.features} id="ozellikler" aria-labelledby="features-heading">
          <div className={styles.featureIntro}><h2 id="features-heading">Planın kadar<br />{" "}ilerlemen de<br />{" "}<span>görünür olsun.</span></h2><p>Derslerini, zamanını ve haftalık düzenini aynı yerde takip et.</p><div className={styles.featureMarks} aria-hidden="true"><Check size={24} /><Clock3 size={24} /><FileDown size={24} /><Moon size={24} /></div></div>
          <dl className={styles.featureList}>
            <div><dt>Her dersin bir günü olsun.</dt><dd>Görevlerini haftanın günlerine yerleştir. Ders renkleri ve günlük notlarla planını bir bakışta oku.</dd></div>
            <div><dt>Harcanan zamanı gör.</dt><dd>Günlük çalışma süreni kaydet; haftalık ve aylık grafiklerle takip et. Önceki haftayla aynı günler üzerinden karşılaştır.</dd></div>
            <div><dt>Haftanı yanına al.</dt><dd>Ders ve görev başlıklarını içeren haftalık planını yatay, tek sayfalık PDF olarak indir.</dd></div>
            <div><dt>Kendi düzeninde çalış.</dt><dd>Profilinden açık veya koyu temayı seç. Planındaki YKS sayacıyla sınava kalan günleri takip et.</dd></div>
          </dl>
        </section>

        <footer className={styles.footer}><span>Haftalık Plan<span className="wordmark-dot">.</span></span><p>Bir hafta, bir adım daha.</p><a href="#giris">Planına dön<ArrowRight size={16} aria-hidden="true" /></a></footer>
      </div>
    </main>
  );
}
