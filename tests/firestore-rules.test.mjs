/**
 * Firestore security rules unit tests (local emulator only).
 * Project: demo-yurt-rules (not production).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PROJECT_ID = 'demo-yurt-rules'
const RULES = readFileSync(join(ROOT, 'firestore.rules'), 'utf8')

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let testEnv

const ADMIN_UID = 'admin-uid'
const STUDENT_UID = 'student-uid'
const OTHER_STUDENT_UID = 'other-student-uid'
const ATTENDANCE_UID = 'attendance-uid'
const GRADUATE_UID = 'graduate-uid'
const STUDENT_DOC = 'stu-own'
const OTHER_DOC = 'stu-other'
const ATTENDANCE_STUDENT_DOC = 'attendance-stu'

function validStudentGradePayload(period = '1_Guz') {
  return {
    akademikNotlar: {
      [period]: [{ ad: 'Matematik', vize: 80, final: 90, ort: 86, harf: 'BA', ekler: [] }],
    },
    donemOrtalamalari: { [period]: '86' },
    genelOrt: '86',
    lastUpdate: '2026-08-21T12:00:00.000Z',
  }
}

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'users', ADMIN_UID), {
      uid: ADMIN_UID,
      username: 'admin',
      adSoyad: 'Admin',
      role: 'admin',
    })
    await setDoc(doc(db, 'users', STUDENT_UID), {
      uid: STUDENT_UID,
      username: 'ali',
      adSoyad: 'Ali Veli',
      role: 'student',
      legacyCollection: 'ogrenciler',
      legacyDocId: STUDENT_DOC,
      canManageAttendance: false,
      photoUrl: 'old',
    })
    await setDoc(doc(db, 'users', OTHER_STUDENT_UID), {
      uid: OTHER_STUDENT_UID,
      username: 'ayse',
      adSoyad: 'Ayşe',
      role: 'student',
      legacyDocId: OTHER_DOC,
      canManageAttendance: false,
    })
    await setDoc(doc(db, 'users', ATTENDANCE_UID), {
      uid: ATTENDANCE_UID,
      username: 'nobetci',
      adSoyad: 'Nöbetçi',
      role: 'student',
      canManageAttendance: true,
      legacyCollection: 'ogrenciler',
      legacyDocId: ATTENDANCE_STUDENT_DOC,
    })
    await setDoc(doc(db, 'users', GRADUATE_UID), {
      uid: GRADUATE_UID,
      username: 'mezun.portal',
      adSoyad: 'Mezun',
      role: 'graduate',
      legacyCollection: 'mezunlar',
    })

    await setDoc(doc(db, 'ogrenciler', STUDENT_DOC), {
      adSoyad: 'Ali Veli',
      username: 'ali',
      odaNo: 1,
      bolum: 'Hukuk',
      sinif: '1',
      ownerUid: STUDENT_UID,
      canManageAttendance: false,
    })
    await setDoc(doc(db, 'ogrenciler', OTHER_DOC), {
      adSoyad: 'Ayşe',
      username: 'ayse',
      odaNo: 2,
      ownerUid: OTHER_STUDENT_UID,
    })

    await setDoc(doc(db, 'ogrenciler', ATTENDANCE_STUDENT_DOC), {
      adSoyad: 'Nöbetçi',
      username: 'nobetci',
      odaNo: 3,
      ownerUid: ATTENDANCE_UID,
      canManageAttendance: true,
    })

    await setDoc(doc(db, 'yoklama_roster', STUDENT_DOC), {
      studentId: STUDENT_DOC,
      adSoyad: 'Ali Veli',
      odaNo: 1,
    })
    await setDoc(doc(db, 'yoklama_roster', OTHER_DOC), {
      studentId: OTHER_DOC,
      adSoyad: 'Ayşe',
      odaNo: 2,
    })

    await setDoc(doc(db, 'yoklamalar', 'yok-1'), {
      vakit: 'Sabah',
      tarih: '2026-01-01',
      timestamp: new Date('2026-01-01'),
      sistemeGirisZamani: new Date('2026-01-01'),
      gelenOgrenciler: ['Ali Veli'],
      gelmeyenOgrenciler: [],
      izinliOgrenciler: [],
      kaydeden: 'Admin',
    })

    await setDoc(doc(db, 'duyurular', 'duy-1'), {
      baslik: 'Duyuru',
      icerik: 'İçerik',
      etkinlikTarihi: null,
      hatirlatmaGun: 0,
      tarih: new Date('2026-01-01'),
    })

    await setDoc(doc(db, 'gunluk_gorevler', '2026-08-17'), {
      imam: 'Ali Veli',
      muezzin: 'Ayşe',
      guncellemeZamani: new Date('2026-08-17'),
    })

    await setDoc(doc(db, 'evciTalepleri', 'leave-a'), {
      ownerUid: STUDENT_UID,
      ogrenciAd: 'Ali Veli',
      gidisTarihi: '2026-08-20',
      donusTarihi: '2026-08-22',
      sebep: 'Aile',
      durum: 'Beklemede',
      tarih: new Date().toISOString(),
    })
    await setDoc(doc(db, 'evciTalepleri', 'leave-b'), {
      ownerUid: OTHER_STUDENT_UID,
      ogrenciAd: 'Ayşe',
      gidisTarihi: '2026-08-21',
      donusTarihi: '2026-08-23',
      sebep: 'Ziyaret',
      durum: 'Beklemede',
      tarih: new Date().toISOString(),
    })
    await setDoc(doc(db, 'evciTalepleri', 'leave-legacy'), {
      ogrenciAd: 'Legacy',
      gidisTarihi: '2026-01-01',
      donusTarihi: '2026-01-02',
      sebep: 'Old',
      durum: 'Beklemede',
      tarih: new Date().toISOString(),
    })

    await setDoc(doc(db, 'ayarlar', 'mezun_giris'), {
      enabled: true,
      welcomeTitle: 'Mezun Ağı',
      welcomeMessage: 'Yurt arkadaşlarınızın güncel hayat hikâyelerini keşfedin.',
      updatedAt: '2026-08-17T12:00:00.000Z',
    })
    await setDoc(doc(db, 'ayarlar', 'mezun_giris_legacy_username'), {
      welcomeTitle: 'Legacy',
      welcomeMessage: 'Msg',
      updatedAt: '2026-08-17T12:00:00.000Z',
      username: 'mezun.portal',
    })

    await setDoc(doc(db, 'site_ayarlari', 'landing'), {
      hero: {
        eyebrow: 'E',
        title: 'T',
        description: 'D',
        tags: ['a'],
      },
      hakkimizda: { label: 'H', title: 'HT', paragraphs: ['p'] },
      kurucu: {
        label: 'K',
        title: 'KT',
        intro: 'I',
        name: 'N',
        bullets: ['b'],
      },
      misyon: { title: 'M', paragraphs: ['mp'] },
      vizyon: { title: 'V', paragraphs: ['vp'], bullets: ['vb'] },
      galeri: [{ id: '1', src: '/g.svg', label: 'G', gradient: 'from-a to-b' }],
      iletisim: { address: 'A', phone: 'P', email: 'e@x.com' },
      updatedAt: '2026-08-17T12:00:00.000Z',
      updatedBy: 'Admin',
    })
    await setDoc(doc(db, 'site_ayarlari', 'other'), { secret: 'nope' })

    await setDoc(doc(db, 'mezunlar', 'mez-1'), {
      adSoyad: 'Mezun Bir',
      girisYili: 2018,
      bolum: 'Hukuk',
      mezuniyetYili: 2022,
      evlilikDurumu: 'Bekar',
      cocukSayisi: 0,
      gorev: 'Avukat',
      calistigiYer: 'İstanbul',
      sehir: 'İstanbul',
      iletisim: 'mezun@example.com',
      photoUrl: 'https://example.com/p.jpg',
      notlar: 'Not',
      sosyalMedya: 'https://example.com/s',
      siraNo: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await setDoc(doc(db, 'mezunlar', 'mez-2'), {
      adSoyad: 'Mezun İki',
      girisYili: 2020,
      evlilikDurumu: 'Belirtilmemiş',
      cocukSayisi: 0,
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    })

    await setDoc(doc(db, 'mezun_ayarlar', 'karsilama'), {
      welcomeTitle: 'Mezun Ağı',
      welcomeMessage: 'Yurt arkadaşlarınızın güncel hayat hikâyelerini keşfedin.',
      updatedAt: '2026-08-17T12:00:00.000Z',
    })
    await setDoc(doc(db, 'mezun_ayarlar', 'other'), {
      welcomeTitle: 'Secret',
      welcomeMessage: 'Nope',
      updatedAt: '2026-08-17T12:00:00.000Z',
    })

    await setDoc(doc(db, 'yoneticiler', 'yon-1'), {
      username: 'admin',
      adSoyad: 'Admin',
    })

    await setDoc(doc(db, 'mali_islemler', 'mali-1'), {
      tur: 'gelir',
      tarih: '2026-09-12',
      tutarKurus: 125050,
      paraBirimi: 'TRY',
      hesap: 'nakit',
      fon: 'Bağış',
      kategori: 'Bağış',
      taraf: 'Bağışçı',
      aciklama: '',
      durum: 'aktif',
      iptalNotu: '',
      createdByUid: ADMIN_UID,
      createdByName: 'Admin',
      createdAt: new Date('2026-09-12T10:00:00.000Z'),
      updatedAt: new Date('2026-09-12T10:00:00.000Z'),
    })

    await setDoc(doc(db, 'islem_loglari', 'log-legacy'), {
      islem: 'İzin Onayı',
      detay: 'Legacy kayıt',
      yapan: 'Eski Admin',
      rol: 'admin',
      timestamp: '2026-01-01T00:00:00.000Z',
    })
    await setDoc(doc(db, 'islem_loglari', 'log-new'), {
      islem: 'Yoklama Kaydı',
      detay: '18.08.2026 · Sabah · 10 geldi, 1 gelmedi',
      actorUid: ADMIN_UID,
      yapan: 'Admin',
      rol: 'admin',
      timestamp: new Date('2026-08-18T10:00:00.000Z'),
    })
  })
}

function authedDb(uid) {
  return testEnv.authenticatedContext(uid).firestore()
}

function unauthedDb() {
  return testEnv.unauthenticatedContext().firestore()
}

function adminAudit(overrides = {}) {
  return {
    islem: 'İzin Onayı',
    detay: 'Ali Veli · 2026-08-20 → 2026-08-22',
    actorUid: ADMIN_UID,
    yapan: 'Admin',
    rol: 'admin',
    timestamp: serverTimestamp(),
    ...overrides,
  }
}

function delegatedAudit(overrides = {}) {
  return {
    islem: 'Yoklama Kaydı',
    detay: '18.08.2026 · Sabah · 10 geldi, 1 gelmedi',
    actorUid: ATTENDANCE_UID,
    yapan: 'Nöbetçi',
    rol: 'student',
    timestamp: serverTimestamp(),
    ...overrides,
  }
}

function financeTransaction(overrides = {}) {
  return {
    tur: 'gelir',
    tarih: '2026-09-12',
    tutarKurus: 125050,
    paraBirimi: 'TRY',
    hesap: 'nakit',
    fon: 'Bağış',
    kategori: 'Bağış',
    taraf: 'Bağışçı',
    aciklama: '',
    durum: 'aktif',
    iptalNotu: '',
    createdByUid: ADMIN_UID,
    createdByName: 'Admin',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  }
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: RULES,
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await seed()
})

after(async () => {
  await testEnv.cleanup()
})

describe('users', () => {
  it('unauth: read/create/update/delete deny', async () => {
    const db = unauthedDb()
    await assertFails(getDoc(doc(db, 'users', STUDENT_UID)))
    await assertFails(
      setDoc(doc(db, 'users', 'new'), { uid: 'new', role: 'student' }),
    )
    await assertFails(updateDoc(doc(db, 'users', STUDENT_UID), { photoUrl: 'x' }))
    await assertFails(deleteDoc(doc(db, 'users', STUDENT_UID)))
  })

  it('student: own read allow, other deny', async () => {
    const db = authedDb(STUDENT_UID)
    await assertSucceeds(getDoc(doc(db, 'users', STUDENT_UID)))
    await assertFails(getDoc(doc(db, 'users', OTHER_STUDENT_UID)))
  })

  it('student: notification self updates allow; profile photo writes deny', async () => {
    const db = authedDb(STUDENT_UID)
    await assertSucceeds(
      updateDoc(doc(db, 'users', STUDENT_UID), {
        fcmTokens: ['t1'],
        notificationsEnabled: true,
        updatedAt: 'now',
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'users', STUDENT_UID), {
        photoUrl: 'data:image/jpeg;base64,/9j/4AAQ',
        updatedAt: 'now2',
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'users', STUDENT_UID), { photoUrl: deleteField(), updatedAt: 'now3' }),
    )
  })

  it('student: sensitive self updates deny', async () => {
    const db = authedDb(STUDENT_UID)
    await assertFails(updateDoc(doc(db, 'users', STUDENT_UID), { role: 'admin' }))
    await assertFails(updateDoc(doc(db, 'users', STUDENT_UID), { canManageAttendance: true }))
    await assertFails(updateDoc(doc(db, 'users', STUDENT_UID), { legacyDocId: 'hack' }))
    await assertFails(updateDoc(doc(db, 'users', STUDENT_UID), { username: 'hack' }))
  })

  it('student: create and delete deny', async () => {
    const db = authedDb(STUDENT_UID)
    await assertFails(setDoc(doc(db, 'users', 'brand-new'), { uid: 'brand-new', role: 'student' }))
    await assertFails(deleteDoc(doc(db, 'users', STUDENT_UID)))
  })

  it('graduate: own read + valid profile photo update; role write deny', async () => {
    const db = authedDb(GRADUATE_UID)
    await assertSucceeds(getDoc(doc(db, 'users', GRADUATE_UID)))
    await assertSucceeds(
      updateDoc(doc(db, 'users', GRADUATE_UID), {
        photoUrl: 'data:image/jpeg;base64,/9j/4AAQ',
        updatedAt: 'now',
      }),
    )
    await assertFails(updateDoc(doc(db, 'users', GRADUATE_UID), { role: 'admin' }))
  })

  it('admin: can manage student photos and attendance, but not other profile identity fields', async () => {
    const db = authedDb(ADMIN_UID)
    await assertSucceeds(getDoc(doc(db, 'users', STUDENT_UID)))
    await assertSucceeds(
      updateDoc(doc(db, 'users', STUDENT_UID), {
        canManageAttendance: true,
        updatedAt: 'now',
      }),
    )
    await assertSucceeds(
      updateDoc(doc(db, 'users', STUDENT_UID), {
        photoUrl: 'data:image/jpeg;base64,/9j/4AAQ',
        updatedAt: 'photo-now',
      }),
    )
    await assertSucceeds(
      updateDoc(doc(db, 'users', STUDENT_UID), { photoUrl: deleteField(), updatedAt: 'photo-later' }),
    )
    await assertFails(
      updateDoc(doc(db, 'users', GRADUATE_UID), {
        photoUrl: 'data:image/jpeg;base64,/9j/4AAQ',
        updatedAt: 'no',
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'users', STUDENT_UID), {
        photoUrl: 'https://example.com/photo.jpg',
        updatedAt: 'invalid-photo',
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'users', STUDENT_UID), {
        photoUrl: 'data:image/jpeg;base64,/9j/4AAQ',
      }),
    )
    await assertFails(updateDoc(doc(db, 'users', STUDENT_UID), { role: 'admin' }))
    await assertFails(updateDoc(doc(db, 'users', STUDENT_UID), { legacyDocId: 'x' }))
    await assertFails(setDoc(doc(db, 'users', 'new-admin-create'), { role: 'student' }))
  })
})

describe('ogrenciler', () => {
  it('unauth: get/list/write deny', async () => {
    const db = unauthedDb()
    await assertFails(getDoc(doc(db, 'ogrenciler', STUDENT_DOC)))
    await assertFails(getDocs(collection(db, 'ogrenciler')))
    await assertFails(setDoc(doc(db, 'ogrenciler', 'x'), { adSoyad: 'X', odaNo: 1 }))
  })

  it('student: own get allow; other get deny; list deny; write deny', async () => {
    const db = authedDb(STUDENT_UID)
    await assertSucceeds(getDoc(doc(db, 'ogrenciler', STUDENT_DOC)))
    await assertFails(getDoc(doc(db, 'ogrenciler', OTHER_DOC)))
    await assertFails(getDocs(collection(db, 'ogrenciler')))
    await assertFails(updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), { odaNo: 9 }))
    await assertFails(deleteDoc(doc(db, 'ogrenciler', STUDENT_DOC)))
  })

  it('admin: get/list/create/update/delete; password and ownerUid guards', async () => {
    const db = authedDb(ADMIN_UID)
    await assertSucceeds(getDoc(doc(db, 'ogrenciler', STUDENT_DOC)))
    await assertSucceeds(getDocs(collection(db, 'ogrenciler')))

    await assertSucceeds(
      setDoc(doc(db, 'ogrenciler', 'new-stu'), {
        adSoyad: 'Yeni',
        username: 'yeni',
        odaNo: 3,
        role: 'student',
      }),
    )
    await assertFails(
      setDoc(doc(db, 'ogrenciler', 'bad-pw'), {
        adSoyad: 'Bad',
        odaNo: 1,
        password: 'secret',
      }),
    )
    await assertFails(
      setDoc(doc(db, 'ogrenciler', 'bad-owner'), {
        adSoyad: 'Bad',
        odaNo: 1,
        ownerUid: 'x',
      }),
    )

    await assertSucceeds(updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), { odaNo: 5 }))
    await assertFails(updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), { password: 'x' }))
    await assertFails(updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), { ownerUid: 'hack' }))
    await assertSucceeds(deleteDoc(doc(db, 'ogrenciler', OTHER_DOC)))
  })

  it('admin: unprovisioned student (no ownerUid) safe update allow; add ownerUid deny', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'ogrenciler', 'pending-stu'), {
        adSoyad: 'Bekleyen',
        username: 'bekleyen',
        odaNo: 7,
      })
    })
    const db = authedDb(ADMIN_UID)
    await assertSucceeds(updateDoc(doc(db, 'ogrenciler', 'pending-stu'), { odaNo: 8, bolum: 'Tıp' }))
    await assertFails(updateDoc(doc(db, 'ogrenciler', 'pending-stu'), { ownerUid: 'someone' }))
  })
})

describe('ogrenciler student self-grade', () => {
  it('Student A: own akademikNotlar update allow', async () => {
    const db = authedDb(STUDENT_UID)
    await assertSucceeds(updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), validStudentGradePayload()))
  })

  it('Student A: transcript import payload across known periods allow', async () => {
    const db = authedDb(STUDENT_UID)
    await assertSucceeds(
      updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), {
        akademikNotlar: {
          '1_Guz': [
            {
              ad: 'Örnek Ders',
              kod: 'ORNEK101',
              akts: '5',
              kaynakDonem: '2025-2026 Güz',
              vize: '',
              final: '',
              ort: '',
              harf: 'AA',
              ekler: [],
            },
          ],
          '1_Bahar': [
            {
              ad: 'Örnek Ders II',
              kod: 'ORNEK102',
              akts: '4',
              kaynakDonem: '2025-2026 Bahar',
              vize: '',
              final: '',
              ort: '',
              harf: 'BA',
              ekler: [],
            },
          ],
        },
        donemOrtalamalari: { '1_Guz': '3.50', '1_Bahar': '3.25' },
        genelOrt: '3.40',
        lastUpdate: '2026-09-29T00:00:00.000Z',
      }),
    )
  })

  it('Student A: ownerUid tamper deny', async () => {
    const db = authedDb(STUDENT_UID)
    await assertFails(
      updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), {
        ...validStudentGradePayload(),
        ownerUid: 'hack',
      }),
    )
  })

  it('Student A: forbidden field updates deny', async () => {
    const db = authedDb(STUDENT_UID)
    const base = validStudentGradePayload()
    await assertFails(updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), { username: 'hack' }))
    await assertFails(updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), { sinif: '2' }))
    await assertFails(updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), { odaNo: 9 }))
    await assertFails(updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), { bolum: 'Tıp' }))
    await assertFails(
      updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), { canManageAttendance: true }),
    )
    await assertFails(
      updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), {
        ...base,
        extraField: 'x',
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), {
        ...base,
        odaNo: 9,
      }),
    )
  })

  it('Student A: invalid grade period key deny', async () => {
    const db = authedDb(STUDENT_UID)
    await assertFails(
      updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), {
        akademikNotlar: {
          invalid_period: [{ ad: 'X', vize: 10, final: 10, ekler: [] }],
        },
        donemOrtalamalari: {},
        genelOrt: '',
        lastUpdate: '2026-08-21T12:00:00.000Z',
      }),
    )
  })

  it('Student A: grade fields without lastUpdate deny', async () => {
    const db = authedDb(STUDENT_UID)
    await assertFails(
      updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), {
        akademikNotlar: validStudentGradePayload().akademikNotlar,
        genelOrt: '86',
      }),
    )
  })

  it('Student B: Student A doc update deny', async () => {
    const db = authedDb(OTHER_STUDENT_UID)
    await assertFails(updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), validStudentGradePayload()))
  })

  it('delegated canManageAttendance student: own grade update allow', async () => {
    const db = authedDb(ATTENDANCE_UID)
    await assertSucceeds(
      updateDoc(doc(db, 'ogrenciler', ATTENDANCE_STUDENT_DOC), validStudentGradePayload('2_Guz')),
    )
  })

  it('graduate: grade write deny', async () => {
    const db = authedDb(GRADUATE_UID)
    await assertFails(updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), validStudentGradePayload()))
  })

  it('admin: official grade update allow (regression)', async () => {
    const db = authedDb(ADMIN_UID)
    await assertSucceeds(
      updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), {
        akademikNotlar: {
          '1_Guz': [{ ad: 'Resmî Ders', vize: 70, final: 80, ort: 76, harf: 'BB', ekler: [] }],
        },
        donemOrtalamalari: { '1_Guz': '76' },
        genelOrt: '76',
        lastUpdate: '2026-08-21T12:00:00.000Z',
      }),
    )
  })

  it('student: audit log create deny', async () => {
    const db = authedDb(STUDENT_UID)
    await assertFails(
      addDoc(collection(db, 'islem_loglari'), {
        islem: 'Not Güncelleme',
        actorUid: STUDENT_UID,
        yapan: 'Ali Veli',
        rol: 'student',
        timestamp: serverTimestamp(),
      }),
    )
  })
})

describe('ogrenciler bulk class promotion', () => {
  it('admin: valid 0→1, 1→2, 2→3, 3→4 transitions allow', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      for (const sinif of ['0', '1', '2', '3']) {
        await setDoc(doc(db, 'ogrenciler', `promotion-${sinif}`), {
          adSoyad: `Öğrenci ${sinif}`,
          username: `student-${sinif}`,
          ownerUid: `owner-${sinif}`,
          sinif,
        })
      }
    })

    const db = authedDb(ADMIN_UID)
    for (const [current, target] of [['0', '1'], ['1', '2'], ['2', '3'], ['3', '4']]) {
      await assertSucceeds(
        updateDoc(doc(db, 'ogrenciler', `promotion-${current}`), {
          sinif: target,
          updatedAt: '2026-08-21T12:00:00.000Z',
        }),
      )
    }
  })

  it('student, delegated student and graduate: class promotion deny', async () => {
    for (const uid of [STUDENT_UID, ATTENDANCE_UID, GRADUATE_UID]) {
      const db = authedDb(uid)
      await assertFails(
        updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), {
          sinif: '2',
          updatedAt: '2026-08-21T12:00:00.000Z',
        }),
      )
    }
  })

  it('admin: 4→5, skipped transition and invalid class values deny', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'ogrenciler', 'promotion-4'), {
        adSoyad: 'Son Sınıf',
        username: 'last-year',
        sinif: '4',
      })
    })
    const db = authedDb(ADMIN_UID)
    await assertFails(
      updateDoc(doc(db, 'ogrenciler', 'promotion-4'), {
        sinif: '5',
        updatedAt: '2026-08-21T12:00:00.000Z',
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), {
        sinif: '3',
        updatedAt: '2026-08-21T12:00:00.000Z',
      }),
    )
    for (const invalid of ['5', '-1', 'Hazırlık', 2, null]) {
      await assertFails(
        updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), {
          sinif: invalid,
          updatedAt: '2026-08-21T12:00:00.000Z',
        }),
      )
    }
  })

  it('admin: promotion requires exactly sinif + updatedAt', async () => {
    const db = authedDb(ADMIN_UID)
    await assertFails(updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), { sinif: '2' }))
    await assertFails(
      updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), {
        sinif: '2',
        updatedAt: '2026-08-21T12:00:00.000Z',
        extra: 'nope',
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), {
        sinif: '2',
        updatedAt: '2026-08-21T12:00:00.000Z',
        ownerUid: 'hack',
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), {
        sinif: '2',
        updatedAt: '2026-08-21T12:00:00.000Z',
        username: 'new-identity',
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'ogrenciler', STUDENT_DOC), {
        sinif: '2',
        updatedAt: '2026-08-21T12:00:00.000Z',
        odaNo: 99,
      }),
    )
  })
})

describe('yoklama_roster', () => {
  it('unauth deny', async () => {
    const db = unauthedDb()
    await assertFails(getDoc(doc(db, 'yoklama_roster', STUDENT_DOC)))
    await assertFails(getDocs(collection(db, 'yoklama_roster')))
  })

  it('normal student: read/write deny', async () => {
    const db = authedDb(STUDENT_UID)
    await assertFails(getDoc(doc(db, 'yoklama_roster', STUDENT_DOC)))
    await assertFails(getDocs(collection(db, 'yoklama_roster')))
    await assertFails(
      setDoc(doc(db, 'yoklama_roster', 'x'), {
        studentId: 'x',
        adSoyad: 'X',
        odaNo: 1,
      }),
    )
  })

  it('attendance student: read allow; write deny', async () => {
    const db = authedDb(ATTENDANCE_UID)
    await assertSucceeds(getDoc(doc(db, 'yoklama_roster', STUDENT_DOC)))
    await assertSucceeds(getDocs(collection(db, 'yoklama_roster')))
    await assertFails(
      setDoc(doc(db, 'yoklama_roster', 'x'), {
        studentId: 'x',
        adSoyad: 'X',
        odaNo: 1,
      }),
    )
    await assertFails(deleteDoc(doc(db, 'yoklama_roster', STUDENT_DOC)))
  })

  it('delegated canManageAttendance: roster list allow; ogrenciler list deny', async () => {
    const db = authedDb(ATTENDANCE_UID)
    await assertSucceeds(getDocs(collection(db, 'yoklama_roster')))
    await assertFails(getDocs(collection(db, 'ogrenciler')))
  })

  it('admin: CRUD allow; schema guards', async () => {
    const db = authedDb(ADMIN_UID)
    await assertSucceeds(getDocs(collection(db, 'yoklama_roster')))
    await assertSucceeds(
      setDoc(doc(db, 'yoklama_roster', 'r1'), {
        studentId: 'r1',
        adSoyad: 'Roster',
        odaNo: 4,
      }),
    )
    await assertFails(
      setDoc(doc(db, 'yoklama_roster', 'r2'), {
        studentId: 'r2',
        adSoyad: 'Bad',
        odaNo: 1,
        username: 'nope',
      }),
    )
    await assertFails(
      setDoc(doc(db, 'yoklama_roster', 'r3'), {
        studentId: 'wrong',
        adSoyad: 'Bad',
        odaNo: 1,
      }),
    )
    await assertSucceeds(deleteDoc(doc(db, 'yoklama_roster', 'r1')))
  })
})

describe('yoklamalar', () => {
  const validCreate = {
    vakit: 'Sabah',
    tarih: '2026-02-01',
    timestamp: new Date('2026-02-01'),
    sistemeGirisZamani: new Date('2026-02-01'),
    gelenOgrenciler: ['Ali Veli'],
    gelmeyenOgrenciler: [],
    izinliOgrenciler: [],
    kaydeden: 'Nöbetçi',
  }

  it('unauth: read/write deny', async () => {
    const db = unauthedDb()
    await assertFails(getDoc(doc(db, 'yoklamalar', 'yok-1')))
    await assertFails(setDoc(doc(db, 'yoklamalar', 'n'), validCreate))
  })

  it('normal student: read allow; write deny', async () => {
    const db = authedDb(STUDENT_UID)
    await assertSucceeds(getDoc(doc(db, 'yoklamalar', 'yok-1')))
    await assertFails(setDoc(doc(db, 'yoklamalar', 'n'), validCreate))
    await assertFails(
      updateDoc(doc(db, 'yoklamalar', 'yok-1'), { gelenOgrenciler: [] }),
    )
    await assertFails(deleteDoc(doc(db, 'yoklamalar', 'yok-1')))
  })

  it('attendance student: create/update allow; delete deny; schema/identity guards', async () => {
    const db = authedDb(ATTENDANCE_UID)
    await assertSucceeds(getDoc(doc(db, 'yoklamalar', 'yok-1')))
    await assertSucceeds(setDoc(doc(db, 'yoklamalar', 'yok-new'), validCreate))
    await assertSucceeds(
      updateDoc(doc(db, 'yoklamalar', 'yok-1'), {
        gelenOgrenciler: [],
        gelmeyenOgrenciler: ['Ali Veli'],
        izinliOgrenciler: [],
        sonDuzenleyen: 'Nöbetçi',
        duzenlemeTarihi: new Date(),
      }),
    )
    await assertFails(deleteDoc(doc(db, 'yoklamalar', 'yok-1')))
    await assertFails(
      setDoc(doc(db, 'yoklamalar', 'bad'), {
        ...validCreate,
        vakit: 'Gece',
      }),
    )
    await assertFails(
      setDoc(doc(db, 'yoklamalar', 'extra'), {
        ...validCreate,
        note: 'nope',
      }),
    )
    await assertFails(updateDoc(doc(db, 'yoklamalar', 'yok-1'), { vakit: 'Yatsı' }))
    await assertFails(updateDoc(doc(db, 'yoklamalar', 'yok-1'), { tarih: '2099-01-01' }))
  })

  it('admin: read/create/update/delete allow', async () => {
    const db = authedDb(ADMIN_UID)
    await assertSucceeds(getDoc(doc(db, 'yoklamalar', 'yok-1')))
    await assertSucceeds(setDoc(doc(db, 'yoklamalar', 'yok-admin'), validCreate))
    await assertSucceeds(
      updateDoc(doc(db, 'yoklamalar', 'yok-1'), {
        gelenOgrenciler: ['Ali Veli'],
        gelmeyenOgrenciler: [],
        izinliOgrenciler: [],
        sonDuzenleyen: 'Admin',
        duzenlemeTarihi: new Date(),
      }),
    )
    await assertSucceeds(deleteDoc(doc(db, 'yoklamalar', 'yok-1')))
  })

  it('invalid create schema deny', async () => {
    const db = authedDb(ATTENDANCE_UID)
    const { kaydeden: _k, ...missingKaydeden } = validCreate
    await assertFails(setDoc(doc(db, 'yoklamalar', 'miss'), missingKaydeden))
    await assertFails(
      setDoc(doc(db, 'yoklamalar', 'bad-ts'), {
        ...validCreate,
        timestamp: '2026-02-01',
      }),
    )
    await assertFails(
      setDoc(doc(db, 'yoklamalar', 'bad-list'), {
        ...validCreate,
        gelenOgrenciler: 'Ali Veli',
      }),
    )
  })

  it('invalid update schema deny', async () => {
    const db = authedDb(ATTENDANCE_UID)
    await assertFails(updateDoc(doc(db, 'yoklamalar', 'yok-1'), { vakit: 'Yatsı' }))
    await assertFails(updateDoc(doc(db, 'yoklamalar', 'yok-1'), { tarih: '2099-01-01' }))
    await assertFails(updateDoc(doc(db, 'yoklamalar', 'yok-1'), { timestamp: new Date() }))
    await assertFails(
      updateDoc(doc(db, 'yoklamalar', 'yok-1'), {
        gelenOgrenciler: 'not-a-list',
        gelmeyenOgrenciler: [],
        izinliOgrenciler: [],
        sonDuzenleyen: 'Nöbetçi',
        duzenlemeTarihi: new Date(),
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'yoklamalar', 'yok-1'), {
        gelenOgrenciler: [],
        gelmeyenOgrenciler: [],
        izinliOgrenciler: [],
        sonDuzenleyen: 123,
        duzenlemeTarihi: new Date(),
      }),
    )
  })
})

describe('duyurular', () => {
  const validCreate = {
    baslik: 'Yeni',
    icerik: 'Metin',
    etkinlikTarihi: null,
    hatirlatmaGun: 0,
    tarih: new Date('2026-02-01'),
  }

  it('unauth: read/write deny', async () => {
    const db = unauthedDb()
    await assertFails(getDoc(doc(db, 'duyurular', 'duy-1')))
    await assertFails(setDoc(doc(db, 'duyurular', 'x'), validCreate))
  })

  it('normal student: read/list allow; write deny', async () => {
    const db = authedDb(STUDENT_UID)
    await assertSucceeds(getDoc(doc(db, 'duyurular', 'duy-1')))
    await assertSucceeds(getDocs(collection(db, 'duyurular')))
    await assertFails(addDoc(collection(db, 'duyurular'), validCreate))
    await assertFails(
      updateDoc(doc(db, 'duyurular', 'duy-1'), { baslik: 'Hack', icerik: 'x', hatirlatmaGun: 0 }),
    )
    await assertFails(deleteDoc(doc(db, 'duyurular', 'duy-1')))
  })

  it('graduate: read allow; write deny', async () => {
    const db = authedDb(GRADUATE_UID)
    await assertSucceeds(getDoc(doc(db, 'duyurular', 'duy-1')))
    await assertFails(addDoc(collection(db, 'duyurular'), validCreate))
  })

  it('delegated: CRUD allow', async () => {
    const db = authedDb(ATTENDANCE_UID)
    await assertSucceeds(getDocs(collection(db, 'duyurular')))
    await assertSucceeds(addDoc(collection(db, 'duyurular'), validCreate))
    await assertSucceeds(
      updateDoc(doc(db, 'duyurular', 'duy-1'), {
        baslik: 'Güncel',
        icerik: 'Yeni metin',
        etkinlikTarihi: '2026-03-01',
        hatirlatmaGun: 2,
      }),
    )
    await assertSucceeds(deleteDoc(doc(db, 'duyurular', 'duy-1')))
  })

  it('admin: CRUD allow', async () => {
    const db = authedDb(ADMIN_UID)
    await assertSucceeds(addDoc(collection(db, 'duyurular'), validCreate))
    await assertSucceeds(
      setDoc(doc(db, 'duyurular', 'duy-admin'), {
        ...validCreate,
        baslik: 'Admin',
      }),
    )
    await assertSucceeds(deleteDoc(doc(db, 'duyurular', 'duy-admin')))
  })

  it('schema: extra/missing/invalid type/timestamp tamper deny', async () => {
    const db = authedDb(ADMIN_UID)
    const { tarih: _t, ...missingTarih } = validCreate
    await assertFails(addDoc(collection(db, 'duyurular'), missingTarih))
    await assertFails(
      addDoc(collection(db, 'duyurular'), {
        ...validCreate,
        extra: 'nope',
      }),
    )
    await assertFails(
      addDoc(collection(db, 'duyurular'), {
        ...validCreate,
        hatirlatmaGun: '0',
      }),
    )
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'duyurular', 'duy-ts'), {
        baslik: 'T',
        icerik: 'C',
        etkinlikTarihi: null,
        hatirlatmaGun: 0,
        tarih: new Date('2026-01-01'),
      })
    })
    await assertFails(
      updateDoc(doc(db, 'duyurular', 'duy-ts'), {
        baslik: 'T2',
        icerik: 'C2',
        etkinlikTarihi: null,
        hatirlatmaGun: 0,
        tarih: new Date('2026-02-01'),
      }),
    )
  })
})

describe('gunluk_gorevler', () => {
  const validDuty = {
    imam: 'Ali Veli',
    muezzin: 'Ayşe',
    guncellemeZamani: new Date('2026-08-17'),
  }

  it('unauth deny', async () => {
    const db = unauthedDb()
    await assertFails(getDoc(doc(db, 'gunluk_gorevler', '2026-08-17')))
    await assertFails(setDoc(doc(db, 'gunluk_gorevler', '2026-08-18'), validDuty))
  })

  it('normal student: known doc get allow; list/write deny', async () => {
    const db = authedDb(STUDENT_UID)
    await assertSucceeds(getDoc(doc(db, 'gunluk_gorevler', '2026-08-17')))
    await assertFails(getDocs(collection(db, 'gunluk_gorevler')))
    await assertFails(setDoc(doc(db, 'gunluk_gorevler', '2026-08-18'), validDuty))
  })

  it('graduate: read/write deny', async () => {
    const db = authedDb(GRADUATE_UID)
    await assertFails(getDoc(doc(db, 'gunluk_gorevler', '2026-08-17')))
    await assertFails(getDocs(collection(db, 'gunluk_gorevler')))
  })

  it('delegated: get/list/CRUD allow', async () => {
    const db = authedDb(ATTENDANCE_UID)
    await assertSucceeds(getDoc(doc(db, 'gunluk_gorevler', '2026-08-17')))
    await assertSucceeds(getDocs(collection(db, 'gunluk_gorevler')))
    await assertSucceeds(setDoc(doc(db, 'gunluk_gorevler', '2026-08-18'), validDuty))
    await assertSucceeds(
      updateDoc(doc(db, 'gunluk_gorevler', '2026-08-17'), {
        imam: 'Nöbetçi',
        muezzin: 'Ali Veli',
        guncellemeZamani: new Date(),
      }),
    )
    await assertSucceeds(deleteDoc(doc(db, 'gunluk_gorevler', '2026-08-18')))
  })

  it('admin: CRUD allow', async () => {
    const db = authedDb(ADMIN_UID)
    await assertSucceeds(getDocs(collection(db, 'gunluk_gorevler')))
    await assertSucceeds(setDoc(doc(db, 'gunluk_gorevler', '2026-08-19'), validDuty))
    await assertSucceeds(deleteDoc(doc(db, 'gunluk_gorevler', '2026-08-19')))
  })

  it('schema: invalid doc id/extra field/empty imam/wrong timestamp deny', async () => {
    const db = authedDb(ADMIN_UID)
    await assertFails(setDoc(doc(db, 'gunluk_gorevler', 'bad-id'), validDuty))
    await assertFails(
      setDoc(doc(db, 'gunluk_gorevler', '2026-08-20'), {
        ...validDuty,
        extra: 'nope',
      }),
    )
    await assertFails(
      setDoc(doc(db, 'gunluk_gorevler', '2026-08-20'), {
        imam: '',
        muezzin: 'Ayşe',
        guncellemeZamani: new Date(),
      }),
    )
    await assertFails(
      setDoc(doc(db, 'gunluk_gorevler', '2026-08-20'), {
        imam: 'Ali',
        muezzin: 'Ayşe',
        guncellemeZamani: '2026-08-20',
      }),
    )
  })
})

describe('evciTalepleri', () => {
  const validStudentCreate = {
    ownerUid: STUDENT_UID,
    ogrenciAd: 'Ali Veli',
    gidisTarihi: '2026-09-01',
    donusTarihi: '2026-09-03',
    sebep: 'Ziyaret',
    durum: 'Beklemede',
    tarih: new Date().toISOString(),
  }

  it('unauth deny', async () => {
    const db = unauthedDb()
    await assertFails(getDoc(doc(db, 'evciTalepleri', 'leave-a')))
    await assertFails(addDoc(collection(db, 'evciTalepleri'), validStudentCreate))
  })

  it('student A: own create/query allow; guards', async () => {
    const db = authedDb(STUDENT_UID)
    await assertSucceeds(addDoc(collection(db, 'evciTalepleri'), validStudentCreate))
    await assertFails(
      addDoc(collection(db, 'evciTalepleri'), {
        ...validStudentCreate,
        ownerUid: OTHER_STUDENT_UID,
      }),
    )
    await assertFails(
      addDoc(collection(db, 'evciTalepleri'), {
        ...validStudentCreate,
        ogrenciAd: 'Sahte İsim',
      }),
    )
    await assertSucceeds(
      getDocs(query(collection(db, 'evciTalepleri'), where('ownerUid', '==', STUDENT_UID))),
    )
    await assertFails(getDocs(collection(db, 'evciTalepleri')))
    await assertFails(getDoc(doc(db, 'evciTalepleri', 'leave-b')))
    await assertFails(
      updateDoc(doc(db, 'evciTalepleri', 'leave-a'), { durum: 'Onaylandı' }),
    )
    await assertFails(deleteDoc(doc(db, 'evciTalepleri', 'leave-a')))
  })

  it('admin: list/respond allow; tamper/delete deny', async () => {
    const db = authedDb(ADMIN_UID)
    await assertSucceeds(getDocs(collection(db, 'evciTalepleri')))
    await assertSucceeds(
      updateDoc(doc(db, 'evciTalepleri', 'leave-a'), {
        durum: 'Onaylandı',
        onaylayanAdmin: 'Admin',
        islemTarihi: new Date().toISOString(),
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'evciTalepleri', 'leave-a'), {
        durum: 'Onaylandı',
        onaylayanAdmin: 'Admin',
        islemTarihi: new Date().toISOString(),
        ownerUid: OTHER_STUDENT_UID,
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'evciTalepleri', 'leave-a'), {
        durum: 'Onaylandı',
        onaylayanAdmin: 'Admin',
        islemTarihi: new Date().toISOString(),
        sebep: 'changed',
      }),
    )
    await assertFails(deleteDoc(doc(db, 'evciTalepleri', 'leave-a')))
  })

  it('delegated and graduate: read/write deny', async () => {
    const dbAtt = authedDb(ATTENDANCE_UID)
    await assertFails(getDoc(doc(dbAtt, 'evciTalepleri', 'leave-a')))
    await assertFails(addDoc(collection(dbAtt, 'evciTalepleri'), validStudentCreate))

    const dbGrad = authedDb(GRADUATE_UID)
    await assertFails(getDoc(doc(dbGrad, 'evciTalepleri', 'leave-a')))
  })

  it('legacy missing ownerUid: student read deny; admin read allow', async () => {
    const dbStudent = authedDb(STUDENT_UID)
    await assertFails(getDoc(doc(dbStudent, 'evciTalepleri', 'leave-legacy')))

    const dbAdmin = authedDb(ADMIN_UID)
    await assertSucceeds(getDoc(doc(dbAdmin, 'evciTalepleri', 'leave-legacy')))
  })

  it('invalid create schema deny', async () => {
    const db = authedDb(STUDENT_UID)
    await assertFails(
      addDoc(collection(db, 'evciTalepleri'), {
        ...validStudentCreate,
        durum: 'Onaylandı',
      }),
    )
    await assertFails(
      addDoc(collection(db, 'evciTalepleri'), {
        ...validStudentCreate,
        onaylayanAdmin: 'Admin',
      }),
    )
  })
})

const VALID_LANDING = {
  hero: {
    eyebrow: 'E',
    title: 'T',
    description: 'D',
    tags: ['a'],
  },
  hakkimizda: { label: 'H', title: 'HT', paragraphs: ['p'] },
  kurucu: {
    label: 'K',
    title: 'KT',
    intro: 'I',
    name: 'N',
    bullets: ['b'],
  },
  misyon: { title: 'M', paragraphs: ['mp'] },
  vizyon: { title: 'V', paragraphs: ['vp'], bullets: ['vb'] },
  galeri: [{ id: '1', src: '/g.svg', label: 'G', gradient: 'from-a to-b' }],
  iletisim: { address: 'A', phone: 'P', email: 'e@x.com' },
  updatedAt: '2026-08-17T13:00:00.000Z',
  updatedBy: 'Admin',
}

const VALID_WELCOME = {
  welcomeTitle: 'Mezun Ağı',
  welcomeMessage: 'Yurt arkadaşlarınızın güncel hayat hikâyelerini keşfedin.',
  updatedAt: '2026-08-17T13:00:00.000Z',
}

const VALID_GRADUATE_CREATE = {
  adSoyad: 'Yeni Mezun',
  girisYili: 2021,
  bolum: 'Tıp',
  mezuniyetYili: 2025,
  evlilikDurumu: 'Bekar',
  cocukSayisi: 0,
  gorev: 'Doktor',
  calistigiYer: 'Ankara',
  sehir: 'Ankara',
  iletisim: 'yeni@example.com',
  photoUrl: 'https://example.com/n.jpg',
  notlar: 'Not',
  sosyalMedya: 'https://example.com/n',
  createdAt: '2026-08-17T00:00:00.000Z',
  updatedAt: '2026-08-17T00:00:00.000Z',
}

describe('ayarlar', () => {
  it('unauth: mezun_giris get/write deny', async () => {
    const db = unauthedDb()
    await assertFails(getDoc(doc(db, 'ayarlar', 'mezun_giris')))
    await assertFails(getDocs(collection(db, 'ayarlar')))
    await assertFails(
      setDoc(doc(db, 'ayarlar', 'mezun_giris'), { welcomeTitle: 'X' }, { merge: true }),
    )
  })

  it('student and delegated: read/write deny', async () => {
    for (const uid of [STUDENT_UID, ATTENDANCE_UID]) {
      const db = authedDb(uid)
      await assertFails(getDoc(doc(db, 'ayarlar', 'mezun_giris')))
      await assertFails(
        setDoc(
          doc(db, 'ayarlar', 'mezun_giris'),
          { welcomeTitle: 'Hack', welcomeMessage: 'H', updatedAt: 'now' },
          { merge: true },
        ),
      )
    }
  })

  it('graduate: read/write deny', async () => {
    const db = authedDb(GRADUATE_UID)
    await assertFails(getDoc(doc(db, 'ayarlar', 'mezun_giris')))
    await assertFails(
      setDoc(
        doc(db, 'ayarlar', 'mezun_giris'),
        { welcomeTitle: 'Hack', welcomeMessage: 'H', updatedAt: 'now' },
        { merge: true },
      ),
    )
  })

  it('admin: read + safe config update allow; password/username/extra/delete/create deny', async () => {
    const db = authedDb(ADMIN_UID)
    await assertSucceeds(getDoc(doc(db, 'ayarlar', 'mezun_giris')))
    await assertFails(getDocs(collection(db, 'ayarlar')))
    await assertSucceeds(
      setDoc(
        doc(db, 'ayarlar', 'mezun_giris'),
        {
          welcomeTitle: 'Yeni Başlık',
          welcomeMessage: 'Yeni mesaj',
          updatedAt: '2026-08-17T14:00:00.000Z',
        },
        { merge: true },
      ),
    )
    await assertSucceeds(
      updateDoc(doc(db, 'ayarlar', 'mezun_giris'), {
        enabled: false,
        updatedAt: '2026-08-17T14:01:00.000Z',
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'ayarlar', 'mezun_giris'), {
        password: 'secret',
        updatedAt: '2026-08-17T14:02:00.000Z',
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'ayarlar', 'mezun_giris'), {
        username: 'mezun.portal',
        updatedAt: '2026-08-17T14:03:00.000Z',
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'ayarlar', 'mezun_giris'), {
        extra: 'nope',
        updatedAt: '2026-08-17T14:04:00.000Z',
      }),
    )
    await assertFails(deleteDoc(doc(db, 'ayarlar', 'mezun_giris')))
    await assertFails(
      setDoc(doc(db, 'ayarlar', 'yeni'), {
        welcomeTitle: 'X',
        welcomeMessage: 'Y',
        updatedAt: 'now',
      }),
    )
    await assertFails(getDoc(doc(db, 'ayarlar', 'mezun_giris_legacy_username')))
  })

  it('admin: leftover username unchanged allow; password re-add deny', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'ayarlar', 'mezun_giris'), {
        welcomeTitle: 'Mezun Ağı',
        welcomeMessage: 'Msg',
        updatedAt: '2026-08-17T12:00:00.000Z',
        username: 'mezun.portal',
      })
    })
    const db = authedDb(ADMIN_UID)
    await assertSucceeds(
      setDoc(
        doc(db, 'ayarlar', 'mezun_giris'),
        {
          welcomeTitle: 'Güncel',
          welcomeMessage: 'Msg2',
          updatedAt: '2026-08-17T15:00:00.000Z',
        },
        { merge: true },
      ),
    )
    await assertFails(
      updateDoc(doc(db, 'ayarlar', 'mezun_giris'), {
        password: 'backdoor',
      }),
    )
  })
})

describe('site_ayarlari', () => {
  it('unauth: landing get allow; list/write deny', async () => {
    const db = unauthedDb()
    await assertSucceeds(getDoc(doc(db, 'site_ayarlari', 'landing')))
    await assertFails(getDocs(collection(db, 'site_ayarlari')))
    await assertFails(setDoc(doc(db, 'site_ayarlari', 'landing'), VALID_LANDING))
    await assertFails(getDoc(doc(db, 'site_ayarlari', 'other')))
  })

  it('student/delegated/graduate: landing get allow; write deny', async () => {
    for (const uid of [STUDENT_UID, ATTENDANCE_UID, GRADUATE_UID]) {
      const db = authedDb(uid)
      await assertSucceeds(getDoc(doc(db, 'site_ayarlari', 'landing')))
      await assertFails(setDoc(doc(db, 'site_ayarlari', 'landing'), VALID_LANDING))
      await assertFails(getDoc(doc(db, 'site_ayarlari', 'other')))
    }
  })

  it('admin: landing get/create/update allow; extra field/wrong type/delete/other deny', async () => {
    const db = authedDb(ADMIN_UID)
    await assertSucceeds(getDoc(doc(db, 'site_ayarlari', 'landing')))
    await assertFails(getDocs(collection(db, 'site_ayarlari')))
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await deleteDoc(doc(context.firestore(), 'site_ayarlari', 'landing'))
    })
    await assertSucceeds(setDoc(doc(db, 'site_ayarlari', 'landing'), VALID_LANDING))
    await assertFails(
      setDoc(doc(db, 'site_ayarlari', 'landing'), {
        ...VALID_LANDING,
        secret: 'nope',
      }),
    )
    await assertFails(
      setDoc(doc(db, 'site_ayarlari', 'landing'), {
        ...VALID_LANDING,
        galeri: 'not-a-list',
      }),
    )
    await assertFails(
      setDoc(doc(db, 'site_ayarlari', 'landing'), {
        ...VALID_LANDING,
        updatedAt: 123,
      }),
    )
    await assertFails(deleteDoc(doc(db, 'site_ayarlari', 'landing')))
    await assertFails(getDoc(doc(db, 'site_ayarlari', 'other')))
    await assertFails(setDoc(doc(db, 'site_ayarlari', 'other'), VALID_LANDING))
    await assertFails(deleteDoc(doc(db, 'site_ayarlari', 'other')))
    await assertSucceeds(
      setDoc(doc(db, 'site_ayarlari', 'landing'), {
        ...VALID_LANDING,
        updatedBy: 'Yeni Admin',
      }),
    )
  })
})

describe('mezunlar', () => {
  it('unauth: get/list/write deny', async () => {
    const db = unauthedDb()
    await assertFails(getDoc(doc(db, 'mezunlar', 'mez-1')))
    await assertFails(getDocs(collection(db, 'mezunlar')))
    await assertFails(addDoc(collection(db, 'mezunlar'), VALID_GRADUATE_CREATE))
  })

  it('student and delegated: get/list/write deny', async () => {
    for (const uid of [STUDENT_UID, ATTENDANCE_UID]) {
      const db = authedDb(uid)
      await assertFails(getDoc(doc(db, 'mezunlar', 'mez-1')))
      await assertFails(getDocs(collection(db, 'mezunlar')))
      await assertFails(addDoc(collection(db, 'mezunlar'), VALID_GRADUATE_CREATE))
      await assertFails(updateDoc(doc(db, 'mezunlar', 'mez-1'), { notlar: 'x' }))
      await assertFails(deleteDoc(doc(db, 'mezunlar', 'mez-1')))
    }
  })

  it('graduate: get/list/orderBy allow; create/update/delete deny', async () => {
    const db = authedDb(GRADUATE_UID)
    await assertSucceeds(getDoc(doc(db, 'mezunlar', 'mez-1')))
    await assertSucceeds(getDocs(collection(db, 'mezunlar')))
    await assertSucceeds(
      getDocs(query(collection(db, 'mezunlar'), orderBy('girisYili', 'desc'))),
    )
    await assertFails(addDoc(collection(db, 'mezunlar'), VALID_GRADUATE_CREATE))
    await assertFails(updateDoc(doc(db, 'mezunlar', 'mez-1'), { notlar: 'hack' }))
    await assertFails(deleteDoc(doc(db, 'mezunlar', 'mez-1')))
  })

  it('admin: CRUD allow', async () => {
    const db = authedDb(ADMIN_UID)
    await assertSucceeds(getDoc(doc(db, 'mezunlar', 'mez-1')))
    await assertSucceeds(getDocs(collection(db, 'mezunlar')))
    await assertSucceeds(addDoc(collection(db, 'mezunlar'), VALID_GRADUATE_CREATE))
    await assertSucceeds(
      updateDoc(doc(db, 'mezunlar', 'mez-1'), {
        adSoyad: 'Mezun Bir',
        girisYili: 2018,
        bolum: 'Hukuk',
        evlilikDurumu: 'Evli',
        cocukSayisi: 1,
        updatedAt: '2026-08-17T16:00:00.000Z',
      }),
    )
    await assertSucceeds(deleteDoc(doc(db, 'mezunlar', 'mez-2')))
  })

  it('schema: extra field/wrong type/invalid update deny', async () => {
    const db = authedDb(ADMIN_UID)
    await assertFails(
      addDoc(collection(db, 'mezunlar'), {
        ...VALID_GRADUATE_CREATE,
        password: 'secret',
      }),
    )
    await assertFails(
      addDoc(collection(db, 'mezunlar'), {
        ...VALID_GRADUATE_CREATE,
        extra: 'nope',
      }),
    )
    await assertFails(
      addDoc(collection(db, 'mezunlar'), {
        ...VALID_GRADUATE_CREATE,
        girisYili: '2021',
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'mezunlar', 'mez-1'), {
        adSoyad: 'Mezun Bir',
        girisYili: 2018,
        role: 'admin',
        updatedAt: '2026-08-17T16:01:00.000Z',
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'mezunlar', 'mez-1'), {
        adSoyad: 'Mezun Bir',
        girisYili: 2018,
        createdAt: 'tampered',
        updatedAt: '2026-08-17T16:02:00.000Z',
      }),
    )
  })
})

describe('mezun_ayarlar', () => {
  it('unauth: get/write deny', async () => {
    const db = unauthedDb()
    await assertFails(getDoc(doc(db, 'mezun_ayarlar', 'karsilama')))
    await assertFails(getDocs(collection(db, 'mezun_ayarlar')))
    await assertFails(setDoc(doc(db, 'mezun_ayarlar', 'karsilama'), VALID_WELCOME))
  })

  it('student and delegated: get/write deny', async () => {
    for (const uid of [STUDENT_UID, ATTENDANCE_UID]) {
      const db = authedDb(uid)
      await assertFails(getDoc(doc(db, 'mezun_ayarlar', 'karsilama')))
      await assertFails(getDocs(collection(db, 'mezun_ayarlar')))
      await assertFails(setDoc(doc(db, 'mezun_ayarlar', 'karsilama'), VALID_WELCOME))
      await assertFails(deleteDoc(doc(db, 'mezun_ayarlar', 'karsilama')))
    }
  })

  it('graduate: get allow; list/create/update/delete deny', async () => {
    const db = authedDb(GRADUATE_UID)
    await assertSucceeds(getDoc(doc(db, 'mezun_ayarlar', 'karsilama')))
    await assertFails(getDocs(collection(db, 'mezun_ayarlar')))
    await assertFails(setDoc(doc(db, 'mezun_ayarlar', 'karsilama'), VALID_WELCOME))
    await assertFails(
      updateDoc(doc(db, 'mezun_ayarlar', 'karsilama'), {
        welcomeTitle: 'Hack',
      }),
    )
    await assertFails(deleteDoc(doc(db, 'mezun_ayarlar', 'karsilama')))
    await assertFails(getDoc(doc(db, 'mezun_ayarlar', 'other')))
  })

  it('admin: get/create/update allow; extra/password/username/delete/other deny', async () => {
    const db = authedDb(ADMIN_UID)
    await assertSucceeds(getDoc(doc(db, 'mezun_ayarlar', 'karsilama')))
    await assertFails(getDocs(collection(db, 'mezun_ayarlar')))
    await assertSucceeds(
      setDoc(doc(db, 'mezun_ayarlar', 'karsilama'), {
        ...VALID_WELCOME,
        welcomeTitle: 'Yeni Başlık',
        welcomeMessage: 'Yeni mesaj',
      }),
    )
    await assertFails(
      setDoc(doc(db, 'mezun_ayarlar', 'karsilama'), {
        ...VALID_WELCOME,
        extra: 'nope',
      }),
    )
    await assertFails(
      setDoc(doc(db, 'mezun_ayarlar', 'karsilama'), {
        ...VALID_WELCOME,
        password: 'secret',
      }),
    )
    await assertFails(
      setDoc(doc(db, 'mezun_ayarlar', 'karsilama'), {
        ...VALID_WELCOME,
        username: 'mezun.portal',
      }),
    )
    await assertFails(
      setDoc(doc(db, 'mezun_ayarlar', 'karsilama'), {
        ...VALID_WELCOME,
        enabled: true,
      }),
    )
    await assertFails(
      setDoc(doc(db, 'mezun_ayarlar', 'karsilama'), {
        welcomeTitle: 1,
        welcomeMessage: 'Yeni mesaj',
        updatedAt: '2026-08-17T13:00:00.000Z',
      }),
    )
    await assertFails(deleteDoc(doc(db, 'mezun_ayarlar', 'karsilama')))
    await assertFails(getDoc(doc(db, 'mezun_ayarlar', 'other')))
    await assertFails(setDoc(doc(db, 'mezun_ayarlar', 'other'), VALID_WELCOME))

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await deleteDoc(doc(context.firestore(), 'mezun_ayarlar', 'karsilama'))
    })
    await assertSucceeds(setDoc(doc(db, 'mezun_ayarlar', 'karsilama'), VALID_WELCOME))
  })
})

describe('admin writeBatch (students.service paths)', () => {
  it('A) create ogrenciler + yoklama_roster allow', async () => {
    const db = authedDb(ADMIN_UID)
    const id = 'batch-create'
    const batch = writeBatch(db)
    batch.set(doc(db, 'ogrenciler', id), {
      adSoyad: 'Batch Create',
      username: 'batchcreate',
      odaNo: 10,
      role: 'student',
      canManageAttendance: false,
    })
    batch.set(doc(db, 'yoklama_roster', id), {
      studentId: id,
      adSoyad: 'Batch Create',
      odaNo: 10,
    })
    await assertSucceeds(batch.commit())
  })

  it('B) update ogrenciler ad/oda + yoklama_roster allow', async () => {
    const db = authedDb(ADMIN_UID)
    const batch = writeBatch(db)
    batch.update(doc(db, 'ogrenciler', STUDENT_DOC), {
      adSoyad: 'Ali Yeni',
      odaNo: 11,
      updatedAt: 'now',
    })
    batch.set(doc(db, 'yoklama_roster', STUDENT_DOC), {
      studentId: STUDENT_DOC,
      adSoyad: 'Ali Yeni',
      odaNo: 11,
    })
    await assertSucceeds(batch.commit())
  })

  it('C) permission + roster: ogrenciler + users + yoklama_roster allow', async () => {
    const db = authedDb(ADMIN_UID)
    const batch = writeBatch(db)
    batch.update(doc(db, 'ogrenciler', STUDENT_DOC), {
      canManageAttendance: true,
      updatedAt: 'now',
    })
    batch.update(doc(db, 'users', STUDENT_UID), {
      canManageAttendance: true,
      updatedAt: 'now',
    })
    batch.set(doc(db, 'yoklama_roster', STUDENT_DOC), {
      studentId: STUDENT_DOC,
      adSoyad: 'Ali Veli',
      odaNo: 1,
    })
    await assertSucceeds(batch.commit())
  })

  it('delete ogrenciler + yoklama_roster allow', async () => {
    const db = authedDb(ADMIN_UID)
    const batch = writeBatch(db)
    batch.delete(doc(db, 'ogrenciler', OTHER_DOC))
    batch.delete(doc(db, 'yoklama_roster', OTHER_DOC))
    await assertSucceeds(batch.commit())
  })
})

describe('yoneticiler deny-all', () => {
  const payload = { username: 'hack', adSoyad: 'Hack' }

  async function assertAllDenied(db) {
    await assertFails(getDoc(doc(db, 'yoneticiler', 'yon-1')))
    await assertFails(getDocs(collection(db, 'yoneticiler')))
    await assertFails(setDoc(doc(db, 'yoneticiler', 'yon-new'), payload))
    await assertFails(updateDoc(doc(db, 'yoneticiler', 'yon-1'), { adSoyad: 'X' }))
    await assertFails(deleteDoc(doc(db, 'yoneticiler', 'yon-1')))
  }

  it('unauth: get/list/create/update/delete deny', async () => {
    await assertAllDenied(unauthedDb())
  })

  it('student: all deny', async () => {
    await assertAllDenied(authedDb(STUDENT_UID))
  })

  it('delegated: all deny', async () => {
    await assertAllDenied(authedDb(ATTENDANCE_UID))
  })

  it('graduate: all deny', async () => {
    await assertAllDenied(authedDb(GRADUATE_UID))
  })

  it('admin: all deny', async () => {
    await assertAllDenied(authedDb(ADMIN_UID))
  })
})

describe('mali_islemler', () => {
  it('unauth: get/list/create/update/delete deny', async () => {
    const db = unauthedDb()
    await assertFails(getDoc(doc(db, 'mali_islemler', 'mali-1')))
    await assertFails(getDocs(collection(db, 'mali_islemler')))
    await assertFails(addDoc(collection(db, 'mali_islemler'), financeTransaction()))
    await assertFails(updateDoc(doc(db, 'mali_islemler', 'mali-1'), { kategori: 'Hack' }))
    await assertFails(deleteDoc(doc(db, 'mali_islemler', 'mali-1')))
  })

  it('student, delegated and graduate: all finance access deny', async () => {
    for (const uid of [STUDENT_UID, ATTENDANCE_UID, GRADUATE_UID]) {
      const db = authedDb(uid)
      await assertFails(getDoc(doc(db, 'mali_islemler', 'mali-1')))
      await assertFails(getDocs(collection(db, 'mali_islemler')))
      await assertFails(addDoc(collection(db, 'mali_islemler'), financeTransaction()))
      await assertFails(updateDoc(doc(db, 'mali_islemler', 'mali-1'), { kategori: 'Hack' }))
      await assertFails(deleteDoc(doc(db, 'mali_islemler', 'mali-1')))
    }
  })

  it('admin: valid create, list, edit and cancel allow', async () => {
    const db = authedDb(ADMIN_UID)
    await assertSucceeds(getDoc(doc(db, 'mali_islemler', 'mali-1')))
    await assertSucceeds(getDocs(query(collection(db, 'mali_islemler'), orderBy('tarih', 'desc'))))
    await assertSucceeds(addDoc(collection(db, 'mali_islemler'), financeTransaction({
      tur: 'gider',
      kategori: 'Market / Mutfak',
      taraf: 'Market',
      hesap: 'banka',
      fon: 'Genel',
    })))
    await assertSucceeds(addDoc(collection(db, 'mali_islemler'), financeTransaction({
      tur: 'fon_donusumu',
      paraBirimi: 'USD',
      hesap: 'banka',
      fon: 'Zekât',
      hedefFon: 'Bağış',
      hedefHesap: 'nakit',
      ogrenciId: STUDENT_DOC,
      kategori: 'Zekâtı Bağışa Dönüştürme',
      taraf: 'Ali Veli',
    })))
    await assertSucceeds(addDoc(collection(db, 'mali_islemler'), financeTransaction({
      tur: 'fon_donusumu',
      hesap: 'banka',
      fon: 'Bağış',
      hedefFon: 'Bağış',
      hedefHesap: 'nakit',
      ogrenciId: STUDENT_DOC,
      kategori: 'Bağış fonu konum değişimi',
      taraf: 'Ali Veli',
    })))
    await assertSucceeds(updateDoc(doc(db, 'mali_islemler', 'mali-1'), {
      kategori: 'Genel Bağış',
      updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(updateDoc(doc(db, 'mali_islemler', 'mali-1'), {
      durum: 'iptal',
      iptalNotu: 'Yanlış kayıt',
      updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(db, 'mali_islemler', 'mali-1'), {
      kategori: 'Sonradan düzenleme',
      updatedAt: serverTimestamp(),
    }))
  })

  it('admin: identity, schema and deletion guards apply', async () => {
    const db = authedDb(ADMIN_UID)
    await assertFails(addDoc(collection(db, 'mali_islemler'), financeTransaction({ createdByUid: STUDENT_UID })))
    await assertFails(addDoc(collection(db, 'mali_islemler'), financeTransaction({ createdByName: 'Hack' })))
    await assertFails(addDoc(collection(db, 'mali_islemler'), financeTransaction({ tutarKurus: 12.5 })))
    await assertFails(addDoc(collection(db, 'mali_islemler'), financeTransaction({ tarih: '12.09.2026' })))
    await assertFails(addDoc(collection(db, 'mali_islemler'), financeTransaction({ tarih: '2026-13-40' })))
    await assertFails(addDoc(collection(db, 'mali_islemler'), financeTransaction({ extra: 'nope' })))
    await assertFails(addDoc(collection(db, 'mali_islemler'), financeTransaction({
      tur: 'fon_donusumu',
      fon: 'Zekât',
      hedefFon: 'Genel',
      ogrenciId: STUDENT_DOC,
      kategori: 'Zekâtı Bağışa Dönüştürme',
      taraf: 'Ali Veli',
    })))
    await assertFails(addDoc(collection(db, 'mali_islemler'), financeTransaction({
      tur: 'fon_donusumu',
      fon: 'Zekât',
      hedefFon: 'Bağış',
      hedefHesap: 'other',
      ogrenciId: STUDENT_DOC,
      kategori: 'Zekâtı Bağışa Dönüştürme',
      taraf: 'Ali Veli',
    })))
    await assertFails(addDoc(collection(db, 'mali_islemler'), financeTransaction({
      tur: 'gelir',
      hedefHesap: 'banka',
      kategori: 'Bağış',
      taraf: 'Bağışçı',
    })))
    await assertFails(addDoc(collection(db, 'mali_islemler'), financeTransaction({
      tur: 'fon_donusumu',
      fon: 'Zekât',
      hedefFon: 'Bağış',
      hedefHesap: 'nakit',
      ogrenciId: STUDENT_DOC,
      kategori: 'Zekâtı Bağışa Dönüştürme',
      taraf: 'Başka İsim',
    })))
    await assertFails(addDoc(collection(db, 'mali_islemler'), financeTransaction({
      tur: 'fon_donusumu',
      fon: 'Bağış',
      hedefFon: 'Bağış',
      hedefHesap: 'nakit',
      kategori: 'Bağış fonu konum değişimi',
      taraf: 'Bağış fonu',
    })))
    await assertFails(updateDoc(doc(db, 'mali_islemler', 'mali-1'), {
      createdByUid: STUDENT_UID,
      updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(db, 'mali_islemler', 'mali-1'), {
      durum: 'iptal',
      iptalNotu: 'x',
      updatedAt: serverTimestamp(),
    }))
    await assertFails(deleteDoc(doc(db, 'mali_islemler', 'mali-1')))
  })
})

describe('islem_loglari', () => {
  it('unauth: read/write deny', async () => {
    const db = unauthedDb()
    await assertFails(getDoc(doc(db, 'islem_loglari', 'log-legacy')))
    await assertFails(getDocs(collection(db, 'islem_loglari')))
    await assertFails(addDoc(collection(db, 'islem_loglari'), adminAudit()))
    await assertFails(updateDoc(doc(db, 'islem_loglari', 'log-legacy'), { detay: 'x' }))
    await assertFails(deleteDoc(doc(db, 'islem_loglari', 'log-legacy')))
  })

  it('student: read/list/create/update/delete deny', async () => {
    const db = authedDb(STUDENT_UID)
    await assertFails(getDoc(doc(db, 'islem_loglari', 'log-legacy')))
    await assertFails(getDocs(collection(db, 'islem_loglari')))
    await assertFails(
      addDoc(collection(db, 'islem_loglari'), {
        ...delegatedAudit({ actorUid: STUDENT_UID, yapan: 'Ali Veli' }),
      }),
    )
    await assertFails(updateDoc(doc(db, 'islem_loglari', 'log-legacy'), { detay: 'x' }))
    await assertFails(deleteDoc(doc(db, 'islem_loglari', 'log-legacy')))
  })

  it('graduate: read/list/create/update/delete deny', async () => {
    const db = authedDb(GRADUATE_UID)
    await assertFails(getDoc(doc(db, 'islem_loglari', 'log-legacy')))
    await assertFails(getDocs(collection(db, 'islem_loglari')))
    await assertFails(
      addDoc(collection(db, 'islem_loglari'), {
        islem: 'Yoklama Kaydı',
        actorUid: GRADUATE_UID,
        yapan: 'Mezun',
        rol: 'graduate',
        timestamp: serverTimestamp(),
      }),
    )
    await assertFails(updateDoc(doc(db, 'islem_loglari', 'log-legacy'), { detay: 'x' }))
    await assertFails(deleteDoc(doc(db, 'islem_loglari', 'log-legacy')))
  })

  it('delegated: read/list deny', async () => {
    const db = authedDb(ATTENDANCE_UID)
    await assertFails(getDoc(doc(db, 'islem_loglari', 'log-legacy')))
    await assertFails(getDocs(collection(db, 'islem_loglari')))
  })

  it('delegated: valid Yoklama Kaydı create allow', async () => {
    const db = authedDb(ATTENDANCE_UID)
    await assertSucceeds(addDoc(collection(db, 'islem_loglari'), delegatedAudit()))
    await assertSucceeds(
      addDoc(collection(db, 'islem_loglari'), {
        islem: 'Yoklama Kaydı',
        actorUid: ATTENDANCE_UID,
        yapan: 'Nöbetçi',
        rol: 'student',
        timestamp: serverTimestamp(),
      }),
    )
  })

  it('delegated: wrong actorUid deny', async () => {
    const db = authedDb(ATTENDANCE_UID)
    await assertFails(
      addDoc(collection(db, 'islem_loglari'), delegatedAudit({ actorUid: ADMIN_UID })),
    )
  })

  it('delegated: wrong role deny', async () => {
    const db = authedDb(ATTENDANCE_UID)
    await assertFails(addDoc(collection(db, 'islem_loglari'), delegatedAudit({ rol: 'admin' })))
  })

  it('delegated: wrong yapan deny', async () => {
    const db = authedDb(ATTENDANCE_UID)
    await assertFails(addDoc(collection(db, 'islem_loglari'), delegatedAudit({ yapan: 'Hack' })))
  })

  it('delegated: other islem deny', async () => {
    const db = authedDb(ATTENDANCE_UID)
    await assertFails(
      addDoc(collection(db, 'islem_loglari'), delegatedAudit({ islem: 'Not Güncelleme' })),
    )
    await assertFails(
      addDoc(collection(db, 'islem_loglari'), delegatedAudit({ islem: 'Öğrenci Silme' })),
    )
    await assertFails(
      addDoc(collection(db, 'islem_loglari'), delegatedAudit({ islem: 'İzin Onayı' })),
    )
    await assertFails(
      addDoc(
        collection(db, 'islem_loglari'),
        delegatedAudit({ islem: 'Toplu Sınıf Yükseltme' }),
      ),
    )
    await assertFails(
      addDoc(
        collection(db, 'islem_loglari'),
        delegatedAudit({ islem: 'Mali Gelir Kaydı' }),
      ),
    )
  })

  it('delegated: wrong timestamp deny', async () => {
    const db = authedDb(ATTENDANCE_UID)
    await assertFails(
      addDoc(
        collection(db, 'islem_loglari'),
        delegatedAudit({ timestamp: new Date('2020-01-01T00:00:00.000Z') }),
      ),
    )
  })

  it('delegated: extra field deny', async () => {
    const db = authedDb(ATTENDANCE_UID)
    await assertFails(
      addDoc(collection(db, 'islem_loglari'), { ...delegatedAudit(), extra: 'nope' }),
    )
  })

  it('delegated: update/delete deny', async () => {
    const db = authedDb(ATTENDANCE_UID)
    await assertFails(updateDoc(doc(db, 'islem_loglari', 'log-legacy'), { detay: 'x' }))
    await assertFails(deleteDoc(doc(db, 'islem_loglari', 'log-legacy')))
  })

  it('admin: get/list allow including legacy without actorUid', async () => {
    const db = authedDb(ADMIN_UID)
    await assertSucceeds(getDoc(doc(db, 'islem_loglari', 'log-legacy')))
    await assertSucceeds(getDoc(doc(db, 'islem_loglari', 'log-new')))
    await assertSucceeds(getDocs(collection(db, 'islem_loglari')))
    await assertSucceeds(
      getDocs(query(collection(db, 'islem_loglari'), orderBy('timestamp', 'desc'), limit(8))),
    )
  })

  it('admin: valid create allow', async () => {
    const db = authedDb(ADMIN_UID)
    await assertSucceeds(addDoc(collection(db, 'islem_loglari'), adminAudit()))
    await assertSucceeds(
      addDoc(collection(db, 'islem_loglari'), adminAudit({ islem: 'Yoklama Kaydı' })),
    )
    await assertSucceeds(
      addDoc(
        collection(db, 'islem_loglari'),
        adminAudit({
          islem: 'Toplu Sınıf Yükseltme',
          detay: '4 öğrencinin sınıfı yükseltildi',
        }),
      ),
    )
    await assertSucceeds(
      addDoc(
        collection(db, 'islem_loglari'),
        adminAudit({ islem: 'Haftalık Mali Rapor Oluşturma', detay: '12 Eylül 2026 – 18 Eylül 2026' }),
      ),
    )
    await assertSucceeds(
      addDoc(
        collection(db, 'islem_loglari'),
        adminAudit({ islem: 'Zekât Bağış Dönüşümü', detay: '12 Eylül 2026 · öğrenci için dönüşüm' }),
      ),
    )
  })

  it('admin: wrong actorUid deny', async () => {
    const db = authedDb(ADMIN_UID)
    await assertFails(addDoc(collection(db, 'islem_loglari'), adminAudit({ actorUid: STUDENT_UID })))
  })

  it('admin: wrong role deny', async () => {
    const db = authedDb(ADMIN_UID)
    await assertFails(addDoc(collection(db, 'islem_loglari'), adminAudit({ rol: 'student' })))
  })

  it('admin: wrong yapan deny', async () => {
    const db = authedDb(ADMIN_UID)
    await assertFails(addDoc(collection(db, 'islem_loglari'), adminAudit({ yapan: 'Hack' })))
  })

  it('admin: wrong timestamp deny', async () => {
    const db = authedDb(ADMIN_UID)
    await assertFails(
      addDoc(
        collection(db, 'islem_loglari'),
        adminAudit({ timestamp: new Date('2020-01-01T00:00:00.000Z') }),
      ),
    )
  })

  it('admin: extra field deny', async () => {
    const db = authedDb(ADMIN_UID)
    await assertFails(addDoc(collection(db, 'islem_loglari'), { ...adminAudit(), extra: 'nope' }))
  })

  it('admin: unknown islem deny', async () => {
    const db = authedDb(ADMIN_UID)
    await assertFails(addDoc(collection(db, 'islem_loglari'), adminAudit({ islem: 'Sahte İşlem' })))
  })

  it('admin: update/delete deny', async () => {
    const db = authedDb(ADMIN_UID)
    await assertFails(updateDoc(doc(db, 'islem_loglari', 'log-legacy'), { detay: 'x' }))
    await assertFails(updateDoc(doc(db, 'islem_loglari', 'log-new'), { islem: 'Hack' }))
    await assertFails(deleteDoc(doc(db, 'islem_loglari', 'log-legacy')))
    await assertFails(deleteDoc(doc(db, 'islem_loglari', 'log-new')))
  })

  it('admin dashboard mixed timestamp query succeeds; string types sort before timestamps in desc', async () => {
    const db = authedDb(ADMIN_UID)
    const snap = await assertSucceeds(
      getDocs(query(collection(db, 'islem_loglari'), orderBy('timestamp', 'desc'), limit(8))),
    )
    const ids = snap.docs.map((d) => d.id)
    assert.equal(ids.includes('log-legacy'), true)
    assert.equal(ids.includes('log-new'), true)
    assert.equal(ids[0], 'log-legacy')
  })
})

// Sanity: suite loaded
assert.ok(PROJECT_ID)
