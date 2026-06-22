# Güncelleme Akışı — Kod, GitHub ve Canlı Site

Üç ayrı katman vardır. Karıştırmamak önemli:

| Katman | Ne? | Otomatik mi? |
|--------|-----|--------------|
| **Bilgisayarınız** | `npm run dev` ile test | Hayır — sadece sizin PC |
| **GitHub** | Kod yedeği | Hayır — `git push` gerekir |
| **Canlı site** | https://yurtyonetimsistemi.web.app | Evet — GitHub'a push sonrası (kurulum sonrası) |

Telefon ve diğer cihazlar **her zaman canlı site adresini** kullanır. Bilgisayarı kapatmanız veya `npm run dev` durdurmanız telefonu **etkilemez**.

---

## Günlük iş akışı (önerilen)

1. Bilgisayarda kodu değiştirin, `npm run dev` ile test edin.
2. Memnun kalınca GitHub'a gönderin:

```powershell
cd "C:\Users\Rıdvan\Desktop\Yurt Yönetimi\GayeVakfiProtal-V2"
git add .
git commit -m "Kısa açıklama: ne değişti"
git push
```

3. Birkaç dakika içinde GitHub Actions canlı siteyi günceller.
4. Telefondan **https://yurtyonetimsistemi.web.app** adresini yenileyin — güncel sürüm gelir.

Manuel deploy gerekmez (`npm run deploy:hosting` isteğe bağlı yedek yol).

---

## Tek seferlik kurulum (GitHub otomatik deploy)

GitHub → **YazKampi_Sistemi** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Aşağıdaki sırları ekleyin (değerler bilgisayarınızdaki `.env` dosyasından):

| Secret adı | Nereden |
|------------|---------|
| `VITE_FIREBASE_API_KEY` | `.env` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `.env` |
| `VITE_FIREBASE_PROJECT_ID` | `.env` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `.env` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `.env` |
| `VITE_FIREBASE_APP_ID` | `.env` |
| `VITE_FIREBASE_VAPID_KEY` | `.env` (varsa) |
| `FIREBASE_TOKEN` | Aşağıdaki komut |

**Firebase token almak** (bir kez):

```powershell
npx firebase login:ci
```

Çıkan uzun metni kopyalayıp `FIREBASE_TOKEN` secret olarak yapıştırın.

Kurulumdan sonra **Actions** sekmesinde yeşil tik görürseniz deploy çalışıyordur.

---

## Dal (branch) bilgisi

- **`portal-v2`** — Güncel React portal (burada çalışın)
- **`main`** — Eski HTML sürümü (artık kullanılmıyor)

İsterseniz GitHub → Settings → Default branch → `portal-v2` yapın.

---

## Özet

- **GitHub otomatik dolmaz** — değişiklikten sonra `git push` yapın.
- **Canlı site otomatik güncellenir** — secret'lar kurulduktan sonra her push'ta.
- **Telefon/tablet** — her zaman `yurtyonetimsistemi.web.app`; PC açık olması gerekmez.
