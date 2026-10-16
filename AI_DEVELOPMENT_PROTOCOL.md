# AI Geliştirme Protokolü

## ChatGPT + Cursor + Codex Çalışma Sistemi

Bu proje, kullanıcı tarafından yönetilen aktif bir yazılım projesidir. Yapay zekâ araçları projede yardımcı geliştirici olarak görev yapar. Projedeki nihai karar ve onay yetkisi her zaman kullanıcıya aittir.

---

# 1. TEMEL ÇALIŞMA PRENSİBİ

Projede üç temel yapay zekâ aracı farklı görevlerde kullanılacaktır:

### ChatGPT

* Fikirleri analiz eder.
* Kullanıcının isteklerini teknik gereksinimlere dönüştürür.
* Alternatif çözüm yolları önerir.
* Mimari ve kullanıcı deneyimi açısından değerlendirme yapar.
* Cursor için ayrıntılı ve anlaşılır geliştirme promptları hazırlamaya yardımcı olur.
* Codex'in raporlarını değerlendirmeye yardımcı olur.

### Cursor

* Ana kod geliştirme aracıdır.
* Kullanıcı tarafından onaylanan geliştirme planlarını uygular.
* Kod yazar, düzenler ve gerekli dosyalarda değişiklik yapar.
* Mevcut proje mimarisine mümkün olduğunca uygun çalışır.
* Kullanıcının veya ChatGPT'nin belirlediği gereksinimlerin dışına gereksiz şekilde çıkmaz.

### Codex

* Kod inceleme, analiz, test, hata tespiti ve teknik öneriler konusunda görev yapar.
* Projedeki mevcut yapıyı inceleyebilir.
* Yapılabilecek iyileştirmeler hakkında öneriler sunabilir.
* Cursor tarafından yapılan değişiklikleri inceleyebilir.
* Testleri çalıştırabilir.
* Hataları ve olası sorunları tespit edip raporlayabilir.
* Ancak kullanıcı açıkça onay vermeden kod üzerinde değişiklik yapamaz.

---

# 2. EN ÖNEMLİ KURAL: ONAY SİSTEMİ

Kullanıcı açıkça onay vermeden hiçbir önemli kod değişikliği uygulanmamalıdır.

Codex veya Cursor bir geliştirme fırsatı, hata veya iyileştirme tespit ettiğinde önce bunu kullanıcıya açıklamalıdır.

Öneri sunmak serbesttir.

Uygulamak için kullanıcı onayı gerekir.

Örnek:

> "Bu yapının performansını artırmak için şu değişikliği öneriyorum..."

Bu yalnızca bir öneridir.

Kullanıcı:

> "Onaylıyorum, uygula."

demeden değişiklik yapılmamalıdır.

---

# 3. BÜYÜK DEĞİŞİKLİKLERDE ZORUNLU SÜREÇ

Büyük özelliklerde veya mevcut sistemi önemli ölçüde etkileyebilecek değişikliklerde aşağıdaki sıra takip edilmelidir:

## PLAN → ONAY → UYGULAMA → TEST → RAPOR

### Aşama 1 — Plan

Önce:

* Mevcut yapı incelenir.
* Değiştirilecek dosyalar belirlenir.
* Etkilenecek özellikler belirlenir.
* Önerilen çözüm açıklanır.
* Olası riskler belirtilir.

### Aşama 2 — Kullanıcı onayı

Kullanıcı plana onay vermeden uygulama başlamaz.

### Aşama 3 — Uygulama

Onay sonrasında gerekli kod değişiklikleri yapılır.

### Aşama 4 — Test

Değişikliklerden sonra mümkün olan otomatik testler ve proje kontrolleri çalıştırılır.

### Aşama 5 — Rapor

Sonuç kullanıcıya açıklanır.

---

# 4. CODEX'İN HATA BULMASI

Codex bir hata veya problem tespit ettiğinde:

1. Problemi tespit eder.
2. Problemin kaynağını mümkün olduğunca araştırır.
3. Problemin etkisini açıklar.
4. Önerilen çözümü açıklar.
5. Kullanıcıdan onay ister.
6. Kullanıcı onay vermeden değişiklik yapmaz.

Örnek rapor:

> "Mobil yoklama sayfasında 768px altında yatay taşma tespit edildi.
>
> Kaynak: X componentindeki responsive yapı.
>
> Öneri: İlgili container yapısının responsive olarak yeniden düzenlenmesi.
>
> Bu değişikliği henüz uygulamadım. Onayınızı bekliyorum."

---

# 5. CODEX'İN ÖNERİ SUNMASI

Codex yalnızca verilen talimatları uygulayan pasif bir araç değildir.

Projeyi incelerken:

* Daha iyi mimari çözümler,
* Performans iyileştirmeleri,
* Kullanıcı deneyimi geliştirmeleri,
* Güvenlik problemleri,
* Kod kalitesi problemleri,
* Responsive problemler,
* Gereksiz veya tekrarlanan kodlar,
* Olası gelecekteki hatalar

hakkında öneriler sunabilir.

Ancak öneri ile uygulama birbirinden ayrılmalıdır.

Codex:

> "Bunun yerine şu yöntemi öneriyorum."

diyebilir.

Ancak:

> "Bunu uyguladım."

diyebilmesi için kullanıcının onayı gereklidir.

---

# 6. OTOMATİK TESTLER

Codex, uygun olduğu durumlarda değişikliklerden sonra otomatik testleri çalıştırmalıdır.

Kontrol edilebilecek konular:

* Build
* Lint
* Type check
* Unit test
* Integration test
* Mevcut testler
* İlgili uygulama komutları
* Responsive davranış için mümkün olan kontroller
* Console hataları
* Runtime hataları

Test sonucu açık şekilde raporlanmalıdır.

Sorun yoksa:

> "Testler tamamlandı. Herhangi bir sorun tespit edilmedi."

Sorun varsa:

> "Test sırasında şu problemler tespit edildi..."

şeklinde rapor hazırlanmalıdır.

Test sırasında bulunan problemler kullanıcı onayı olmadan otomatik olarak düzeltilmemelidir.

---

# 7. MEVCUT ÖZELLİKLERİN KORUNMASI

Yeni bir özellik geliştirilirken mevcut çalışan özellikler korunmalıdır.

Özellikle:

* Mevcut tasarım,
* Veri yapısı,
* Kullanıcı yetkileri,
* Navigasyon,
* Mobil görünüm,
* Masaüstü görünüm,
* Mevcut API bağlantıları,
* Mevcut veritabanı işlemleri

gereksiz şekilde değiştirilmemelidir.

Bir değişikliğin mevcut bir özelliği etkileyebileceği düşünülüyorsa kullanıcıya önceden bildirilmelidir.

---

# 8. GEREKSİZ DEĞİŞİKLİK YAPILMAMASI

İstenen görev için gerekli olmayan dosyalara veya kodlara müdahale edilmemelidir.

Kod yeniden düzenleme veya refactor önerilebilir.

Ancak kapsamlı refactor işlemleri kullanıcı onayı olmadan yapılmamalıdır.

---

# 9. MOBİL VE MASAÜSTÜ UYUMLULUĞU

Arayüz değişikliklerinde yalnızca masaüstü görünüm dikkate alınmamalıdır.

Uygun olduğunda:

* Desktop
* Tablet
* Mobile

görünümleri değerlendirilmelidir.

Bir değişiklik masaüstünde doğru çalışırken mobilde sorun oluşturuyorsa bu durum raporlanmalıdır.

---

# 10. CURSOR İLE CODEX ARASINDAKİ GÖREV PAYLAŞIMI

Genel çalışma düzeni:

### ChatGPT

Fikir → analiz → plan → Cursor promptu

### Cursor

Prompt → kodlama → uygulama

### Codex

Kod inceleme → test → hata/iyileştirme tespiti → rapor

### Kullanıcı

Son karar → onay → yönlendirme

---

# 11. STANDART GELİŞTİRME DÖNGÜSÜ

Yeni bir özellik için ideal süreç:

1. Kullanıcı fikrini açıklar.
2. ChatGPT ile gereksinimler netleştirilir.
3. Teknik çözüm belirlenir.
4. Cursor için prompt hazırlanır.
5. Cursor değişiklikleri uygular.
6. Codex yapılan değişiklikleri inceler.
7. Codex otomatik testleri çalıştırır.
8. Codex sonuçları raporlar.
9. Sorun varsa kullanıcıya açıklanır.
10. Kullanıcı karar verir.
11. Gerekirse düzeltme yapılır.
12. Codex tekrar test eder.

---

# 12. CODEX'E VERİLEN TALİMATLARDA ÖNCELİK

Çalışırken aşağıdaki öncelik sırası takip edilmelidir:

1. Kullanıcının açık talimatları
2. Bu protokol
3. Projenin mevcut mimarisi ve kuralları
4. Güvenli ve sürdürülebilir yazılım geliştirme prensipleri
5. Codex'in kendi teknik önerileri

Codex'in kendi önerileri kullanıcı talimatlarının yerine geçmez.

---

# 13. BELİRSİZLİK DURUMU

Bir talimat yeterince açık değilse ve yanlış yorumlama önemli bir değişikliğe yol açabilecekse Codex tahmin ederek büyük değişiklik yapmamalıdır.

Önce:

* Belirsiz noktayı belirtmeli,
* Alternatifleri açıklamalı,
* Kullanıcıdan karar istemelidir.

Küçük ve risksiz ayrıntılarda ise mevcut proje yapısına en uygun yaklaşım önerilebilir.

---

# 14. DEĞİŞİKLİK RAPORU

Kod değişikliği yapıldıktan sonra mümkün olduğunda aşağıdaki bilgiler raporlanmalıdır:

* Ne değiştirildi?
* Hangi dosyalar değiştirildi?
* Neden değiştirildi?
* Hangi testler çalıştırıldı?
* Test sonuçları ne oldu?
* Bilinen bir problem kaldı mı?
* Kullanıcı tarafından kontrol edilmesi gereken bir nokta var mı?

---

# 15. TEMEL FELSEFE

Bu projede yapay zekâ araçları kullanıcı yerine karar veren sistemler değildir.

Amaç:

> Yapay zekânın teknik bilgi ve analiz gücünden yararlanırken nihai kontrolü kullanıcıda tutmaktır.

Codex'in görevi yalnızca kod yazmak değil; projeyi anlamak, test etmek, sorunları bulmak ve daha iyi çözümler önermektir.

Cursor'un görevi onaylanan geliştirmeleri hızlı ve doğru şekilde uygulamaktır.

ChatGPT'nin görevi fikirleri netleştirmek, teknik yaklaşımı geliştirmek ve araçlar arasındaki çalışma sürecini düzenlemeye yardımcı olmaktır.

Kullanıcı ise projenin sahibi ve nihai karar vericisidir.
