# Öğrenci Hesap Yönetimi

Bu araç yalnız yönetici bilgisayarında çalışır; Hosting'e veya Cloud Functions'a deploy edilmez.

## Bir defalık kurulum

1. Firebase Admin SDK service-account JSON dosyasını güvenli, proje dışı bir klasörde tutun.
2. `scripts/Ogrenci-Hesap-Yonetimi.cmd` dosyasına çift tıklayın.
3. İlk açılışta oluşan `.local-admin.env` dosyasındaki `GOOGLE_APPLICATION_CREDENTIALS` değerini JSON dosyasının tam yolu ile değiştirin.
4. Aynı `.cmd` dosyasına tekrar çift tıklayın.

Tarayıcıda yalnız `http://127.0.0.1:47831` açılır. İşiniz bitince açılan komut penceresini kapatın.

## Güvenlik

- Şifreler yalnız Firebase Auth'a gönderilir; Firestore'a, loglara veya yerel işlem geçmişine yazılmaz.
- Araç `127.0.0.1` dışına dinlemez ve Hosting'e dahil değildir.
- Service-account JSON dosyasını Git'e eklemeyin, paylaşmayın veya proje klasörüne taşımayın.
- `student-account-manager.local.json` yalnız şifresiz yerel işlem geçmişidir ve `.gitignore` ile korunur.
