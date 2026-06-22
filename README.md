# Gaye Vakfı Portal V2

Modern yurt yönetim portalı — React, TypeScript, Firebase.

## Kurulum

Adım adım rehber: **[KURULUM_SIRASI.md](./KURULUM_SIRASI.md)**

```bash
npm install
npm run dev
```

Uygulama varsayılan olarak `http://localhost:5173` adresinde açılır.

## Ortam Değişkenleri

`.env.example` dosyasını `.env` olarak kopyalayın ve Firebase proje bilgilerinizi girin.

## Firebase Kurulumu

1. Firebase Console'da **Authentication → Email/Password** yöntemini etkinleştirin.
2. `firestore.rules` dosyasını Firebase'e deploy edin:

```bash
firebase deploy --only firestore:rules
```

## Özellikler

### Faz 1 — Altyapı
- React + TypeScript + Vite + Tailwind CSS
- Firebase Auth ile güvenli giriş
- Eski portal kullanıcılarının otomatik migrasyonu (ilk girişte)
- Rol bazlı routing (admin / öğrenci)
- Responsive layout (sidebar + mobil alt menü)
- Ortak UI bileşenleri (Button, Card, Modal, Toast, ConfirmDialog)

### Faz 2 — Çekirdek Modüller
- Yönetici dashboard, öğrenci yönetimi, yoklama, duyuru & nöbet
- Not yönetimi, devamsızlık raporları, evci izin talepleri

### Faz 3 — Gelişmiş Özellikler
- PDF not raporu (Türkçe karakter destekli, pdfmake)
- Profil sayfası ve şifre değiştirme
- Dashboard devamsızlık trend grafiği (son 6 ay)
- Öğrenci izin geçmişi
- İşlem günlüğü (audit log)

### Faz 4 — Cila
- Koyu / açık tema
- PWA (ana ekrana ekleme, offline önbellek)

## Proje Yapısı

```
src/
  components/   # UI ve layout bileşenleri
  config/       # Navigasyon ve sabitler
  lib/          # Firebase ve yardımcı fonksiyonlar
  pages/        # Sayfa bileşenleri
  services/     # Auth ve veri servisleri
  stores/       # Zustand state yönetimi
  types/        # TypeScript tipleri
```

### Faz 5 — Operasyonel Araçlar
- Excel öğrenci içe/dışa aktarma + şablon
- Devamsızlık raporu Excel export
- Cloud Functions ile arka plan push bildirimleri
- Yapılandırılabilir landing galerisi (`public/gallery/`)

## Sonraki Adımlar

- Galeri fotoğraflarını `public/gallery/` klasörüne ekleyin
- Cloud Functions deploy: `firebase deploy --only functions`
- Firebase Hosting ile canlıya alma: `npm run build && firebase deploy --only hosting`
