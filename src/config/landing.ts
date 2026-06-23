export interface GalleryItem {
  id: string
  src?: string
  label: string
  gradient: string
}

export interface LandingContent {
  hero: {
    eyebrow: string
    title: string
    description: string
    tags: string[]
  }
  hakkimizda: {
    label: string
    title: string
    paragraphs: string[]
  }
  kurucu: {
    label: string
    title: string
    intro: string
    name: string
    imageUrl?: string
    bullets: string[]
  }
  misyon: {
    title: string
    paragraphs: string[]
  }
  vizyon: {
    title: string
    paragraphs: string[]
    bullets: string[]
  }
  galeri: GalleryItem[]
  iletisim: {
    address: string
    phone: string
    email: string
  }
  updatedAt?: string
  updatedBy?: string
}

/** Firestore'da kayıt yoksa bu varsayılan içerik kullanılır */
export const DEFAULT_LANDING_CONTENT: LandingContent = {
  hero: {
    eyebrow: 'Dijital Yurt Yönetimi',
    title: 'Mobil için öncelikli, masaüstünde güçlü bir yurt yönetim deneyimi.',
    description:
      'Gaye Vakfı öğrencileri ve yöneticileri için tasarlanmış portal. Not takibi, yoklama, izin talepleri, duyurular ve raporlar tek yerde.',
    tags: ['Mobil uyumlu', 'Güvenli erişim', 'Anlık bildirim', 'PDF rapor'],
  },
  hakkimizda: {
    label: 'Hakkımızda',
    title: 'Gaye Vakfı Yurt Yönetimi',
    paragraphs: [
      'Buraya Gaye Vakfı ve yurdunuz hakkında bilgi yazabilirsiniz. Yönetici panelinden Site Düzenleme bölümünden veya bu dosyadan düzenleyebilirsiniz.',
      'İkinci paragraf için yönetici panelinde "Paragraf Ekle" butonunu kullanın.',
    ],
  },
  kurucu: {
    label: 'Kurucumuz',
    title: 'Cevat Akşit Kimdir?',
    intro:
      "Gaye Vakfı'nın değerleri, eğitim önceliği ve yurt felsefesi ile bölge gençliğine rehberlik eden bir isim.",
    name: 'Cevat Akşit',
    bullets: [
      'Gençlerin eğitimini destekler',
      'Toplumsal dayanışmaya önem verir',
      'Yurt kültürünü güçlendirir',
    ],
  },
  misyon: {
    title: 'Misyonumuz',
    paragraphs: [
      'Her öğrenci için güvenli, düzenli ve şeffaf bir yurt yönetimi sağlayarak akademik başarıya destek olmak.',
    ],
  },
  vizyon: {
    title: 'Vizyonumuz',
    paragraphs: [
      'Öğrencilerin hem akademik hem sosyal gelişimini destekleyen, modern ve sıcak bir yurt ortamı kurmak.',
    ],
    bullets: ['Şeffaf süreç yönetimi', 'Hızlı karar alma', 'Öğrenci odaklı yaklaşım'],
  },
  galeri: [
    { id: '1', src: '/gallery/ortak-alan.svg', label: 'Ortak Alan', gradient: 'from-indigo-500 to-violet-600' },
    { id: '2', src: '/gallery/calisma-odasi.svg', label: 'Çalışma Odası', gradient: 'from-sky-500 to-blue-600' },
    { id: '3', src: '/gallery/etkinlik-alani.svg', label: 'Etkinlik Alanı', gradient: 'from-emerald-500 to-teal-600' },
    { id: '4', src: '/gallery/yemek-salonu.svg', label: 'Yemek Salonu', gradient: 'from-amber-500 to-orange-600' },
  ],
  iletisim: {
    address: 'Kemalpaşa Mah. 202.Sk. No: 2, Serdivan/Sakarya',
    phone: '+90 543 252 65 76',
    email: 'gayevakfi@gmail.com',
  },
}

// Geriye dönük uyumluluk
export const LANDING_GALLERY = DEFAULT_LANDING_CONTENT.galeri
export const LANDING_CONTACT = DEFAULT_LANDING_CONTENT.iletisim
