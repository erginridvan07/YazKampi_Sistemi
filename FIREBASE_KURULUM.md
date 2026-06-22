# Firebase Kurulum Rehberi

Giriş hatası alıyorsanız bu adımları sırayla uygulayın.

## 1. Email/Password Girişini Aç

1. https://console.firebase.google.com/ adresine gidin
2. **yurtyonetimsistemi** projesini seçin
3. Sol menü → **Build** → **Authentication**
4. **Sign-in method** sekmesi
5. **Email/Password** satırına tıklayın
6. **Enable** (Etkinleştir) → **Save**

## 2b. Firebase Storage'ı Aç (Site fotoğrafları için)

1. https://console.firebase.google.com/project/yurtyonetimsistemi/storage
2. **Get Started** → **Production mode** → bölge seçin → **Done**
3. Terminalde: `npm run deploy:storage`

> Storage olmadan uygulama çalışır; sadece Admin → Site'dan fotoğraf yüklenemez.

## 2. Firestore Kurallarını Yayınla (EN ÖNEMLİ ADIM)

1. Sol menü → **Build** → **Firestore Database**
2. Üstte **Rules** sekmesine tıklayın
3. Mevcut tüm metni silin
4. Bu projedeki `firestore.rules` dosyasının içeriğini kopyalayıp yapıştırın
5. **Publish** (Yayınla) butonuna basın
6. "Rules published successfully" mesajını bekleyin

> Kuralları yayınlamadan giriş **çalışmaz**. "Missing or insufficient permissions" hatası bunun nedeni.

## 3. Firestore Veritabanı Var mı?

Firestore Database sayfasında veritabanı yoksa:

1. **Create database** butonuna tıklayın
2. **Production mode** veya **Test mode** seçin (kuralları yine de 2. adımda güncelleyin)
3. Bölge olarak **eur3 (Europe)** veya size yakın bir bölge seçin

## 4. Authorized Domains (localhost)

1. Authentication → **Settings** → **Authorized domains**
2. Listede `localhost` olmalı (varsayılan olarak vardır)

## 5. Giriş Testi

1. Uygulamayı yeniden başlatın: `npm run dev`
2. Tarayıcıda `http://localhost:5173/giris` açın
3. Eski portal kullanıcı adı ve şifrenizle giriş yapın

### Şifre kuralı

Firebase en az **6 karakter** şifre ister. Eski şifreniz 6 karakterden kısaysa giriş başarısız olur.

## 6. Push Bildirimleri (İsteğe Bağlı)

Anlık bildirimler profil sayfasından açılabilir. İzin sonuçları ve yeni talepler portal açıkken otomatik bildirilir.

Arka planda push için:

1. Firebase Console → **Project Settings** → **Cloud Messaging**
2. **Web Push certificates** bölümünden VAPID key oluşturun
3. `.env` dosyasına ekleyin: `VITE_FIREBASE_VAPID_KEY=...`
4. `public/firebase-messaging-sw.js` içindeki Firebase config'in projenizle eşleştiğinden emin olun

> VAPID key olmadan da Firestore dinleyicileri + tarayıcı bildirimleri çalışır.

## 7. Sıkı Güvenlik Kuralları

Tüm kullanıcılar Firebase Auth'a taşındıktan sonra:

1. `firestore.rules.strict` dosyasını Firebase Console → Rules'a yapıştırın
2. **Publish** edin

Bu kurallar legacy koleksiyonlarda herkese açık okumayı kaldırır.

## 8. Tarih Migrasyonu

Admin → **Ayarlar** sayfasından eski yoklama tarihlerini (DD.MM.YYYY) YYYY-MM-DD formatına dönüştürebilirsiniz.

## 9. Cloud Functions (Arka Plan Push)

İzin talebi oluşturulduğunda yöneticilere, sonuçlandığında öğrenciye push göndermek için:

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

Ön koşullar:
- Firebase CLI kurulu (`npm i -g firebase-tools`)
- `firebase login` ile giriş yapılmış
- Profil sayfasından bildirimler açık ve VAPID key tanımlı

## 10. Excel Toplu İşlemler

Admin → **Öğrenciler** sayfasından:
- **Şablon** — örnek Excel indir
- **Excel** — mevcut listeyi dışa aktar
- **İçe Aktar** — toplu öğrenci ekleme

## Hata Açıklamaları

| Hata | Anlam | Çözüm |
|------|-------|-------|
| Missing or insufficient permissions | Firestore kuralları engelliyor | Adım 2'yi yapın |
| 400 signInWithPassword | Kullanıcı henüz Firebase'de yok (normal) | İlk girişte otomatik taşınır |
| auth/operation-not-allowed | Email/Password kapalı | Adım 1'i yapın |
| auth/weak-password | Şifre 6 karakterden kısa | Şifreyi güncelleyin |

## 400 Hatası Hakkında

Konsoldaki `signInWithPassword 400` hatası **ilk girişte normal** olabilir.
Uygulama önce Firebase'de hesap arar, bulamazsa eski kayıttan yeni hesap oluşturur.

Asıl sorun **permission denied** ise Firestore Rules yayınlanmamış demektir.
