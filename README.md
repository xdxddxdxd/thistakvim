# Haftalık Plan

YKS için tek kullanıcılı, Türkçe haftalık görev planlayıcısı. Tablet landscape öncelikli arayüz; günlük ve haftalık plan, analiz ve haftalık PDF çıktısı sunar.

Canlı uygulama: [thistakvim.vercel.app](https://thistakvim.vercel.app)

## Yerel kurulum

Node.js 24 ve npm kullanılır.

```powershell
npm ci
Copy-Item .env.example .env.local
```

`.env.local` içindeki değişkenleri kendi Supabase projeniz ve Auth hesabınızla doldurun:

| Değişken | Kullanım |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje adresi |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `PLANNER_USERNAME` | Uygulamadaki kullanıcı adı |
| `PLANNER_AUTH_EMAIL` | Kullanıcı adının eşlendiği Supabase Auth e-postası; yalnız sunucuda kullanılır |

Auth şifresi Supabase tarafından yönetilir. Şifre, service-role key ve yerel kimlik dosyaları depoya eklenmez.

```powershell
npm run dev
```

Yerel adres: http://localhost:3000

Üretim derlemesini yerelde çalıştırmak için:

```powershell
npm run build
npm start
```

## Özellikler

- Pazartesi–Pazar planı, gerçek tarihler ve Europe/Istanbul gün mantığı.
- Gün kartında ilk üç görev ve kalan görev sayısı; seçili günde tam liste.
- Görev ekleme, düzenleme, tamamlama, sıralama ve silme; silmede 5 saniyelik geri alma.
- Fare, dokunma ve klavyeyle sıralama; başka güne bırakınca kopyalama veya taşıma seçimi.
- Günlük not ve gerçekleşmiş toplam çalışma süresi. Süre aynı gün tekrar düzenlenebilir; gelecek güne süre girilemez.
- İstanbul saatine göre 23:59’da gün kapanışı; geçmiş günlerin görev, not ve süre kayıtları salt okunur.
- Profilde Kâğıt / Siyah beyaz temaları ve ders renkleri.
- Yalnız seçili haftanın PDF’si; Türkçe fontlar, görevler, açıklamalar ve notlar.
- Ayrı `/analiz` sayfasında hafta özeti, gün ve ders dağılımları, ders × gün tablosu, başlık kullanımı, kalan görevler ve önceki haftayla karşılaştırma.
- Analizden ilgili göreve geçiş; seçili tarih ve analiz filtrelerinin URL’de korunması.
- Başka cihazdaki değişikliklere karşı not ve çalışma süresinde sürüm kontrolü.

İnternet bağlantısı gerekir. Uygulamada saatli program, kronometre veya sohbet asistanı bulunmaz.

## Dosya yapısı

| Yol | İçerik |
| --- | --- |
| `app/` | Next.js sayfaları ve API rotaları |
| `components/planner/` | Planlayıcı, görev ve profil bileşenleri |
| `components/analysis/` | Analiz ekranı ve stilleri |
| `components/ui/` | Ortak modal bileşeni |
| `lib/` | Tarih, durum, analiz, Supabase ve PDF yardımcıları |
| `public/fonts/` | PDF için yerel fontlar ve lisansları |
| `supabase/migrations/` | Veritabanı şeması ve migration geçmişi |
| `supabase/tests/` | Rollback içinde çalışan veritabanı doğrulamaları |
| `tests/` | Birim ve Playwright entegrasyon testleri |

Next.js 16 App Router, React, TypeScript, Tailwind 4, Supabase SSR/Auth/PostgreSQL, dnd-kit ve Radix kullanılır. Fontlar yerelden sunulur.

## Veritabanı

Tablolar: `profiles`, `categories`, `tasks`, `day_notes`, `day_status`, `day_study_time`. RLS her kullanıcıyı kendi kayıtlarıyla sınırlar. API rotaları oturumu doğrular; değişiklikler yetkili PostgreSQL rutinlerinden geçer. Görev işlemleri transaction, kullanıcı kilidi ve kayıt sürümü kontrolü kullanır.

Boş bir Supabase projesi için migration dosyalarını tarih sırasıyla uygulayın. Auth hesabını Supabase yönetim araçlarıyla oluşturun; ilgili `profiles` ve `categories` kayıtlarını ekleyin. Mevcut üretim projesine uygulanmış migration’ları tekrar çalıştırmayın. Migration geçmişi, kaldırılmış özelliklerin kurulum ve kaldırma adımlarını da içerir; son şemada asistan tabloları veya rutinleri bulunmaz.

`planner-close-istanbul-day` Cron işi UTC 20:59’da çalışır. Cron gecikse bile tarih koruması kapanan güne yazımı engeller; plan okunurken güvenli kapanış fallback’i eksik durum kayıtlarını tamamlar. Tamamlanmayan görevler kendi tarihlerinde kalır.

## Kısa kontroller

```powershell
npm run typecheck
npm test
```

`npm run test:e2e` canlı veritabanına geçici görev yazan bir entegrasyon testidir; yalnız izole test hesabı/projesiyle çalıştırın. Testler için yerelde `.credentials/account.json` oluşturulur; gerekli `email`, `password` ve `userId` alanları test hesabına ait olmalıdır. Bu dosya Git tarafından dışlanır.

`supabase/tests/` SQL kontrolleri yetkili test bağlantısıyla çalıştırılır ve fixture işlemlerini rollback ile geri alır.

## Vercel yayını

Vercel projesi `thistakvim`, framework Next.js, üretim dalı `main` olarak kullanılır. Yukarıdaki dört ortam değişkeni Vercel’in Production ortamında tanımlanır; yerel `.env.local` yüklenmez. `vercel.json` fonksiyon bölgesini Supabase veritabanına yakın Dublin (`dub1`) olarak belirler.

Bağlı GitHub deposunda `main` güncellendiğinde Vercel üretim yayını oluşturur. Gerektiğinde yerelden yayınlamak için:

```powershell
vercel link
vercel deploy --prod
```

Üretim adresi uygulamanın giriş ekranını açar. Preview ve benzersiz deployment adreslerinde Vercel erişim koruması bulunur. `.vercelignore` CLI yüklemesini yalnız uygulama ve derleme dosyalarıyla sınırlar.

GitHub’da bağımlılıklar, derleme çıktıları, kimlik dosyaları, gerçek ortam değerleri, ekran görüntüleri ve yerel tasarım/ajan dosyaları tutulmaz.
