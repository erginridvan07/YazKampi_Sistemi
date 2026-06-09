# Yurt Yönetimi - Yaz Kampı Sistemi

Yaz kampı döneminde **yurt yönetimi personelinin** kullandığı web uygulaması. Derse gelen hocaların bilgileri sistemde tutulur; bu hocaların giriş yapması gerekmez. Veriler **Firebase Firestore** üzerinde saklanır; site **GitHub Pages** ile yayınlanır.

## Kim Ne Yapar?

| Rol | Sistem erişimi | Açıklama |
|-----|----------------|----------|
| **Yurt yönetimi personeli** | Giriş yapar | Sınıf, öğrenci, ders ve ders hocası bilgilerini görür/düzenler |
| **Derse gelen hocalar** | Erişim yok | Yalnızca bilgi olarak kayıtlıdır (ad, bölüm, verdiği dersler) |

## Özellikler

- Derse gelen hocaların bilgi kaydı (giriş hesabı olmadan)
- Sınıf, ders ve öğrenci yönetimi
- Ders kitabı ilerleme takibi
- Yönetim personeli arasında gerçek zamanlı veri paylaşımı
- E-posta/şifre ile güvenli giriş (sadece yönetim)

---

## 1. Firebase Kurulumu

### Proje oluşturma

1. [Firebase Console](https://console.firebase.google.com/) → **Proje ekle**
2. **Firestore Database** → **Create database** → Production mode
3. **Authentication** → **Sign-in method** → **Email/Password** → Etkinleştir

### Yönetim personeli hesapları

**Authentication** → **Users** → **Add user**

Yalnızca yurt yönetiminde görevli personel için e-posta ve şifre oluşturun. Derse gelen hocalara hesap açmanız gerekmez; onların bilgileri uygulama içindeki **Derse Gelen Hocalar** bölümünden yönetilir.

### Web uygulaması config bilgileri

**Project settings** → **Your apps** → Web (`</>`) → Uygulama adı girin → Config değerlerini kopyalayın.

### Firestore güvenlik kuralları

Firestore kurallarını yükleyin (sadece giriş yapmış kullanıcılar erişebilir):

```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

Veya Firebase Console → **Firestore** → **Rules** sekmesinde `firestore.rules` dosyasının içeriğini yapıştırıp yayınlayın.

### Authorized domains (önemli)

**Authentication** → **Settings** → **Authorized domains**

GitHub Pages yayınlandıktan sonra şu adresi ekleyin:

```
KULLANICI_ADINIZ.github.io
```

---

## 2. Yerel Geliştirme

```powershell
# Config dosyasını oluşturun
copy firebase-config.example.js firebase-config.js
```

`firebase-config.js` içine Firebase Console'dan aldığınız değerleri girin.

```powershell
# Yerel sunucu
python -m http.server 8080
```

Tarayıcı: `http://localhost:8080`

> `firebase-config.js` git'e eklenmez (.gitignore). Her geliştirici kendi dosyasını oluşturur.

---

## 3. GitHub'a Yükleme ve Yayınlama

### Depoyu oluşturma

```powershell
cd "C:\Users\Rıdvan\Desktop\Yurt Yönetimi\YazKampi_Sistemi"
git init
git add .
git commit -m "Yaz kampı sistemi: Firebase ve GitHub Pages"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/YazKampi_Sistemi.git
git push -u origin main
```

### GitHub Secrets (Repository Settings → Secrets and variables → Actions)

| Secret adı | Değer |
|------------|-------|
| `FIREBASE_API_KEY` | Firebase apiKey |
| `FIREBASE_AUTH_DOMAIN` | Firebase authDomain |
| `FIREBASE_PROJECT_ID` | Firebase projectId |
| `FIREBASE_STORAGE_BUCKET` | Firebase storageBucket |
| `FIREBASE_MESSAGING_SENDER_ID` | Firebase messagingSenderId |
| `FIREBASE_APP_ID` | Firebase appId |

### GitHub Pages etkinleştirme

**Settings** → **Pages** → **Build and deployment** → Source: **GitHub Actions**

`main` branch'e push yaptığınızda site otomatik yayınlanır:

```
https://KULLANICI_ADINIZ.github.io/YazKampi_Sistemi/
```

Bu adresi Firebase **Authorized domains** listesine eklemeyi unutmayın.

---

## 4. İlk Veri Yükleme

Firestore'da henüz veri yoksa, ilk giriş yapan yönetim personeli için `data.json` içeriği otomatik olarak buluta aktarılır.

---

## Dosya Yapısı

```
├── index.html              # Ana sayfa
├── app.js                  # Uygulama mantığı
├── style.css               # Stiller
├── data.json               # Başlangıç verileri (ilk seed)
├── firebase-config.example.js
├── firestore.rules         # Firestore güvenlik kuralları
├── firebase.json           # Firebase CLI yapılandırması
└── .github/workflows/deploy.yml
```

---

## Sık Karşılaşılan Sorunlar

**"Firebase yapılandırması bulunamadı"**
→ `firebase-config.js` oluşturulmamış veya GitHub Secrets eksik.

**Giriş yapılamıyor**
→ Kullanıcı Firebase Authentication'da tanımlı mı? Authorized domain eklendi mi?

**Veriler görünmüyor**
→ Firestore kuralları yayınlandı mı? İnternet bağlantısı var mı?

**Kaydetme hatası**
→ Giriş yapılmış olmalı; Firestore rules `request.auth != null` şartını sağlamalı.
