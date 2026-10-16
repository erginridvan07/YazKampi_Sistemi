import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/stores/auth.store'
import type { FinanceTransaction, FinanceTransactionInput } from '@/types'

const COL = 'mali_islemler'

function getAdminActor() {
  const currentUser = auth.currentUser
  const profile = useAuthStore.getState().profile
  if (!currentUser?.uid || !profile || profile.uid !== currentUser.uid || profile.role !== 'admin') {
    throw new Error('Bu işlem yalnızca yönetici hesabıyla yapılabilir.')
  }
  return { uid: currentUser.uid, name: profile.adSoyad.trim() || 'Yönetici' }
}

function cleanInput(input: FinanceTransactionInput): FinanceTransactionInput {
  const tarih = input.tarih.trim()
  const kategori = input.kategori.trim()
  const taraf = input.taraf.trim()
  const aciklama = input.aciklama.trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) throw new Error('Geçerli bir işlem tarihi seçin.')
  if (!Number.isSafeInteger(input.tutarKurus) || input.tutarKurus <= 0) {
    throw new Error('Geçerli bir tutar girin.')
  }
  if (!kategori || !taraf) throw new Error('Kategori ile kişi/kurum bilgisi zorunludur.')
  if (kategori.length > 80 || taraf.length > 120 || aciklama.length > 500) {
    throw new Error('Girdiğiniz açıklama çok uzun.')
  }

  const isFundConversion = input.tur === 'fon_donusumu'
  const isZakatConversion = isFundConversion && input.fon === 'Zekât'
  const isDonationAccountTransfer = isFundConversion && input.fon === 'Bağış' && input.hedefFon === 'Bağış'
  const ogrenciId = input.ogrenciId?.trim()
  const hedefHesap = input.hedefHesap ?? input.hesap
  if (isFundConversion && !['nakit', 'banka'].includes(hedefHesap)) {
    throw new Error('Paranın geçtiği yeri seçin.')
  }
  if (isFundConversion && !ogrenciId) {
    throw new Error('Fon dönüşümünde öğrenci seçimi zorunludur.')
  }
  if (isFundConversion && !isZakatConversion && !isDonationAccountTransfer) {
    throw new Error('Yalnız Zekât → Bağış dönüşümü veya Bağış fonu konum değişimi kaydedilebilir.')
  }
  return {
    tur: input.tur,
    tarih,
    tutarKurus: input.tutarKurus,
    paraBirimi: input.paraBirimi,
    hesap: input.hesap,
    fon: input.fon,
    kategori,
    taraf,
    aciklama,
    ...(isFundConversion
      ? {
          hedefFon: 'Bağış' as const,
          hedefHesap,
          ogrenciId,
        }
      : {}),
  }
}

export async function unlockFinanceArea(password: string): Promise<void> {
  const currentUser = auth.currentUser
  if (!currentUser?.email) throw new Error('Yönetici oturumu doğrulanamadı. Lütfen tekrar giriş yapın.')
  if (!password) throw new Error('Yönetici şifrenizi girin.')

  try {
    const credential = EmailAuthProvider.credential(currentUser.email, password)
    await reauthenticateWithCredential(currentUser, credential)
  } catch {
    throw new Error('Şifre doğrulanamadı.')
  }
}

export async function fetchFinanceTransactions(): Promise<FinanceTransaction[]> {
  const snapshot = await getDocs(query(collection(db, COL), orderBy('tarih', 'desc')))
  const transactions: FinanceTransaction[] = []
  snapshot.forEach((docSnap) => {
    transactions.push({ id: docSnap.id, ...docSnap.data() } as FinanceTransaction)
  })
  return transactions
}

export async function createFinanceTransaction(input: FinanceTransactionInput): Promise<void> {
  const actor = getAdminActor()
  const clean = cleanInput(input)
  await addDoc(collection(db, COL), {
    ...clean,
    durum: 'aktif',
    iptalNotu: '',
    createdByUid: actor.uid,
    createdByName: actor.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateFinanceTransaction(id: string, input: FinanceTransactionInput): Promise<void> {
  getAdminActor()
  const clean = cleanInput(input)
  await updateDoc(doc(db, COL, id), {
    ...clean,
    updatedAt: serverTimestamp(),
  })
}

export async function cancelFinanceTransaction(id: string, reason: string): Promise<void> {
  getAdminActor()
  const iptalNotu = reason.trim()
  if (iptalNotu.length < 3 || iptalNotu.length > 500) {
    throw new Error('İptal açıklaması en az 3, en fazla 500 karakter olmalıdır.')
  }
  await updateDoc(doc(db, COL, id), {
    durum: 'iptal',
    iptalNotu,
    updatedAt: serverTimestamp(),
  })
}
