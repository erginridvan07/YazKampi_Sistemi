# Kurulum Sırası — Adım Adım

Bu dosyayı **yukarıdan aşağıya** takip edin. Her adımı bitirince bir sonrakine geçin.

---

## Adım 1 — Uygulamayı bilgisayarda çalıştır

```powershell
cd "C:\Users\Rıdvan\Desktop\Yurt Yönetimi\GayeVakfiProtal-V2"
npm install
npm run dev
```

Tarayıcıda açın: **http://localhost:5173**

✅ **Tamam sayılır:** Ana sayfa açılıyor.

---

## Adım 2 — Giriş testi

1. **Giriş Yap** butonuna tıklayın
2. Eski portal kullanıcı adı ve şifrenizle giriş yapın

✅ **Tamam sayılır:** Admin paneline yönlendiriliyorsunuz.

❌ **"Missing or insufficient permissions"** görürseniz → Adım 3'e geçin.

---

## Adım 3 — Firebase kurallarını yayınla (Storage GEREKMEZ)

Terminalde:

```powershell
npx firebase login
npm run deploy:firestore
```

✅ Bu yeterli. Firebase Storage açmanız veya ücretli plana geçmeniz **gerekmez**.

### Fotoğraflar nasıl eklenir? (ücretsiz)

1. Fotoğrafları `public/gallery/` klasörüne koyun (ör. `ortak-alan.jpg`)
2. Admin → **Site** → görsel adresine `/gallery/ortak-alan.jpg` yazın
3. **Kaydet**

> İleride isterseniz Firebase Storage açabilirsiniz; şimdilik atlayın.

---

## Adım 4 — Ana sayfa içeriğini düzenle

1. Admin olarak giriş yapın
2. Sol menüden **Site** sayfasına gidin
3. Metinleri, iletişim bilgilerini düzenleyin
4. Galeri için **fotoğraf yükleyin** veya mevcut görselleri bırakın
5. **Kaydet** butonuna basın

✅ **Tamam sayılır:** Çıkış yapıp ana sayfada (`/`) değişiklikleri görüyorsunuz.

---

## Adım 6 — Bildirimleri aç (isteğe bağlı)

1. Sağ üst **profil** ikonu
2. **Bildirimler → Aç**
3. Tarayıcı izin istediğinde **İzin ver**

✅ **Tamam sayılır:** İzin onayı / yeni talep geldiğinde uyarı görürsünüz (portal açıkken).

`.env` dosyanızda `VITE_FIREBASE_VAPID_KEY` zaten var — arka plan push için Adım 7 gerekli.

---

## Adım 7 — Cloud Functions (arka plan push)

```powershell
cd functions
npm install
npm run build
cd ..
npm run deploy:functions
```

✅ **Tamam sayılır:** İzin talebi oluşturulunca yöneticiye, sonuçlanınca öğrenciye push gider.

---

## Adım 8 — İnternete yayınla (Hosting) ✅ YAYINDA

Canlı adres:

**https://yurtyonetimsistemi.web.app**

(Alternatif: https://yurtyonetimsistemi.firebaseapp.com)

Kodda değişiklik yaptıktan sonra yeniden yayınlamak için:

```powershell
npm run deploy:hosting
```

### Telefon ve tabletten giriş

1. Chrome veya Safari ile yukarıdaki adresi açın
2. Mevcut kullanıcı adı ve şifrenizle **Giriş Yap**
3. (Önerilir) Uygulama gibi kullanmak için ana ekrana ekleyin:
   - **iPhone/iPad (Safari):** Paylaş → **Ana Ekrana Ekle**
   - **Android (Chrome):** Menü (⋮) → **Ana ekrana ekle** veya **Uygulamayı yükle**

Portal mobil uyumludur; alt menü ve dokunmatik kullanım için tasarlanmıştır.

### Giriş çalışmıyorsa

Firebase Console → **Authentication** → **Settings** → **Authorized domains**  
Listede şunlar olmalı (genelde otomatik eklenir):

- `yurtyonetimsistemi.web.app`
- `yurtyonetimsistemi.firebaseapp.com`
- `localhost` (geliştirme için)

Ayrıca **Sign-in method** bölümünde **Email/Password** açık olmalı.

---

## Adım 9 — Eski tarihleri düzelt (isteğe bağlı)

1. Admin → **Ayarlar**
2. Kaç kayıt eski formatta olduğunu görün
3. Hazırsanız **Migrasyonu Başlat**

---

## Adım 10 — Sıkı güvenlik (tüm öğrenciler giriş yaptıktan SONRA)

⚠️ **Erken yapmayın** — yeni kullanıcı ilk giriş yapamaz.

Tüm öğrenciler en az bir kez giriş yaptıktan sonra:

```powershell
# firestore.rules.strict içeriğini firestore.rules olarak kopyalayın, sonra:
npm run deploy:rules
```

---

## Hızlı kontrol listesi

| # | İş | Durum |
|---|-----|-------|
| 1 | `npm run dev` çalışıyor | ☐ |
| 2 | Admin girişi OK | ☐ |
| 3 | `npm run deploy:firestore` (Storage yok, sorun değil) | ☐ |
| 4 | Site sayfasından içerik kaydedildi | ☐ |
| 5 | Bildirimler açıldı | ☐ |
| 6 | Functions deploy | ☐ |
| 7 | Hosting deploy → https://yurtyonetimsistemi.web.app | ☑ |
| 8 | Tarih migrasyonu | ☐ |
| 9 | Sıkı kurallar | ☐ |

---

Sorun olursa `FIREBASE_KURULUM.md` dosyasına da bakın.
