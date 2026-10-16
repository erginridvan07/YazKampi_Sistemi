import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Ban,
  CircleDollarSign,
  Download,
  Landmark,
  LockKeyhole,
  Pencil,
  Plus,
  Unlock,
  WalletCards,
} from 'lucide-react'
import { PageHeader } from '@/components/admin/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardDescription, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { formatDateTR, todayISO } from '@/lib/dates'
import {
  calculateFinanceSummary,
  dayBefore,
  financeDirectionLabel,
  formatMoney,
  getFinanceWeekRange,
  parseMoneyToKurus,
  type FinanceCurrencyTotals,
  type FinanceSummary,
  type FinanceWeekRange,
} from '@/lib/financeHelpers'
import { downloadWeeklyFinancePdf, type FinanceReportSection } from '@/lib/pdf/financeWeeklyPdf'
import { useAsync } from '@/hooks/useAsync'
import { fetchStudentsList } from '@/services/students.service'
import {
  cancelFinanceTransaction,
  createFinanceTransaction,
  fetchFinanceTransactions,
  unlockFinanceArea,
  updateFinanceTransaction,
} from '@/services/finance.service'
import { logAudit } from '@/services/audit.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import type {
  FinanceAccount,
  FinanceCurrency,
  FinanceFund,
  FinanceTransaction,
  FinanceTransactionInput,
  FinanceTransactionType,
  Student,
} from '@/types'

type FinanceForm = Omit<FinanceTransactionInput, 'tutarKurus'> & { tutar: string }

const FUND_OPTIONS: FinanceFund[] = ['Genel', 'Zekât', 'Bağış']
const INCOME_CATEGORIES = ['Bağış', 'Zekât', 'Genel Bağış', 'Yardım', 'Diğer']
const EMPTY_TRANSACTIONS: FinanceTransaction[] = []
const REPORT_SECTION_OPTIONS: Array<{ id: FinanceReportSection; label: string; description: string }> = [
  { id: 'summary', label: 'Haftalık özet', description: 'Devreden, gelir, gider ve kalan bakiyeler' },
  { id: 'funds', label: 'Fon bakiyeleri', description: 'Genel, Zekât ve Bağış fonları' },
  { id: 'carries', label: 'Dönem içi devirler', description: 'Bu hafta eklenen devir kayıtları' },
  { id: 'conversions', label: 'Fon ve konum dönüşümleri', description: 'Zekât/Bağış ve Banka/Nakit hareketleri' },
  { id: 'income', label: 'Gelirler', description: 'Bu haftaki gelir kayıtları' },
  { id: 'expense', label: 'Giderler', description: 'Bu haftaki gider kayıtları' },
  { id: 'accounts', label: 'Kasa ve banka bakiyesi', description: 'Nakit, banka ve toplam bakiyeler' },
]
const ALL_REPORT_SECTIONS = REPORT_SECTION_OPTIONS.map((section) => section.id)

function emptyFinanceForm(tur: FinanceTransactionType, tarih = todayISO()): FinanceForm {
  const isExpense = tur === 'gider'
  const isCarry = tur === 'devir'
  const isFundConversion = tur === 'fon_donusumu'
  return {
    tur,
    tarih,
    tutar: '',
    paraBirimi: 'TRY',
    hesap: isFundConversion ? 'banka' : 'nakit',
    fon: isFundConversion ? 'Zekât' : 'Genel',
    hedefFon: isFundConversion ? 'Bağış' : undefined,
    hedefHesap: isFundConversion ? 'banka' : undefined,
    ogrenciId: undefined,
    kategori: isFundConversion ? 'Zekâtı Bağışa Dönüştürme' : isCarry ? 'Açılış Bakiyesi' : isExpense ? '' : 'Bağış',
    taraf: isCarry ? 'Önceki dönem devri' : '',
    aciklama: '',
  }
}

function formFromTransaction(transaction: FinanceTransaction): FinanceForm {
  return {
    tur: transaction.tur,
    tarih: transaction.tarih,
    tutar: (transaction.tutarKurus / 100).toFixed(2).replace('.', ','),
    paraBirimi: transaction.paraBirimi,
    hesap: transaction.hesap,
    fon: transaction.fon,
    hedefFon: transaction.hedefFon,
    hedefHesap: transaction.hedefHesap ?? transaction.hesap,
    ogrenciId: transaction.ogrenciId,
    kategori: transaction.kategori,
    taraf: transaction.taraf,
    aciklama: transaction.aciklama,
  }
}

function amountText(amount: number, currency: FinanceCurrency): string {
  return formatMoney(amount, currency)
}

function accountLabel(account: FinanceAccount): string {
  return account === 'nakit' ? 'Nakit' : 'Banka'
}

function accountMovementLabel(transaction: FinanceTransaction): string {
  const source = accountLabel(transaction.hesap)
  const target = transaction.hedefHesap ?? transaction.hesap
  return transaction.tur === 'fon_donusumu' && target !== transaction.hesap
    ? `${source} → ${accountLabel(target)}`
    : source
}

function conversionLabel(transaction: FinanceTransaction): string {
  return transaction.fon === 'Bağış' && transaction.hedefFon === 'Bağış'
    ? 'Bağış Konum Değişimi'
    : 'Zekât → Bağış'
}

function typeTone(type: FinanceTransactionType): 'success' | 'danger' | 'primary' {
  if (type === 'gelir') return 'success'
  if (type === 'gider') return 'danger'
  return 'primary'
}

export function AdminFinancePage() {
  const profile = useAuthStore((state) => state.profile)
  const showToast = useToastStore((state) => state.showToast)
  const [unlockedUntil, setUnlockedUntil] = useState<number | null>(null)
  const [password, setPassword] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [editor, setEditor] = useState<{ transaction: FinanceTransaction | null; form: FinanceForm } | null>(null)
  const [saving, setSaving] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<FinanceTransaction | null>(null)
  const [cancelReason, setCancelReason] = useState('Yanlış kayıt')
  const [canceling, setCanceling] = useState(false)
  const [showCanceled, setShowCanceled] = useState(false)
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false)
  const [visibleReportSections, setVisibleReportSections] = useState<FinanceReportSection[]>(ALL_REPORT_SECTIONS)
  const [downloadingReport, setDownloadingReport] = useState(false)

  const unlocked = unlockedUntil !== null
  const transactionsQuery = useAsync(
    async () => (unlocked ? fetchFinanceTransactions() : []),
    [unlocked],
  )
  const studentsQuery = useAsync(
    async () => (unlocked ? fetchStudentsList() : []),
    [unlocked],
  )

  useEffect(() => {
    if (!unlockedUntil) return
    const delay = Math.max(unlockedUntil - Date.now(), 0)
    const timer = window.setTimeout(() => setUnlockedUntil(null), delay)
    return () => window.clearTimeout(timer)
  }, [unlockedUntil])

  const period = useMemo(() => {
    const anchor = new Date()
    anchor.setDate(anchor.getDate() + weekOffset * 7)
    return getFinanceWeekRange(anchor)
  }, [weekOffset])

  const transactions = transactionsQuery.data || EMPTY_TRANSACTIONS
  const summary = useMemo(
    () => calculateFinanceSummary(transactions, period.start, period.end),
    [transactions, period.end, period.start],
  )
  const shownTransactions = useMemo(() => {
    const openingDate = dayBefore(period.start)
    return transactions
      .filter((transaction) => (
        (transaction.tarih >= period.start && transaction.tarih <= period.end)
        || (transaction.tur === 'devir' && transaction.tarih === openingDate)
      ))
      .filter((transaction) => showCanceled || transaction.durum !== 'iptal')
      .sort((left, right) => right.tarih.localeCompare(left.tarih))
  }, [period.end, period.start, showCanceled, transactions])
  const expenseCategoryOptions = useMemo(() => [...new Set(
    transactions
      .filter((transaction) => transaction.tur === 'gider' && transaction.durum === 'aktif')
      .map((transaction) => transaction.kategori.trim())
      .filter(Boolean),
  )].sort((left, right) => left.localeCompare(right, 'tr')), [transactions])
  const hasOpeningBalance = transactions.some((transaction) => transaction.tur === 'devir' && transaction.durum === 'aktif')

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault()
    setUnlocking(true)
    try {
      await unlockFinanceArea(password)
      setPassword('')
      setUnlockedUntil(Date.now() + 15 * 60 * 1000)
      showToast('success', 'Kasa alanı açıldı', 'Bu tarayıcı sekmesinde 15 dakika açık kalacak.')
    } catch (error) {
      showToast('error', 'Kasa alanı açılamadı', error instanceof Error ? error.message : undefined)
    } finally {
      setUnlocking(false)
    }
  }

  const openCreate = (tur: FinanceTransactionType) => {
    const date = tur === 'devir' ? dayBefore(period.start) : todayISO()
    setEditor({ transaction: null, form: emptyFinanceForm(tur, date) })
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editor) return
    const tutarKurus = parseMoneyToKurus(editor.form.tutar)
    if (!tutarKurus) {
      showToast('error', 'Geçerli bir tutar girin', 'Örnek: 1.250,50')
      return
    }

    const isFundConversion = editor.form.tur === 'fon_donusumu'
    const input: FinanceTransactionInput = {
      tur: editor.form.tur,
      tarih: editor.form.tarih,
      tutarKurus,
      paraBirimi: editor.form.paraBirimi,
      hesap: editor.form.hesap,
      fon: editor.form.fon,
      kategori: editor.form.kategori,
      taraf: editor.form.taraf,
      aciklama: editor.form.aciklama,
      ...(isFundConversion
        ? {
            hedefFon: 'Bağış' as const,
            hedefHesap: editor.form.hedefHesap ?? editor.form.hesap,
            ogrenciId: editor.form.ogrenciId,
          }
        : {}),
    }

    setSaving(true)
    try {
      if (editor.transaction) {
        await updateFinanceTransaction(editor.transaction.id, input)
        await logAudit({ islem: 'Mali İşlem Düzenleme', detay: `${input.tarih} · ${input.kategori}` })
        showToast('success', 'Mali kayıt güncellendi')
      } else {
        await createFinanceTransaction(input)
        const islem = input.tur === 'gelir'
          ? 'Mali Gelir Kaydı'
          : input.tur === 'gider'
            ? 'Mali Gider Kaydı'
            : input.tur === 'devir'
              ? 'Mali Devir Kaydı'
              : input.fon === 'Bağış'
                ? 'Bağış Konum Değişimi'
                : 'Zekât Bağış Dönüşümü'
        const accountMovement = input.tur === 'fon_donusumu' && input.hedefHesap !== input.hesap
          ? ` · ${accountLabel(input.hesap)} → ${accountLabel(input.hedefHesap ?? input.hesap)}`
          : ''
        await logAudit({ islem, detay: `${input.tarih} · ${input.kategori}${accountMovement}` })
        showToast('success', `${input.tur === 'fon_donusumu' && input.fon === 'Bağış' ? 'Bağış konum değişimi' : financeDirectionLabel(input.tur)} kaydı eklendi`)
      }
      setEditor(null)
      await transactionsQuery.reload()
    } catch (error) {
      showToast('error', 'Kayıt başarısız', error instanceof Error ? error.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    setCanceling(true)
    try {
      await cancelFinanceTransaction(cancelTarget.id, cancelReason)
      await logAudit({ islem: 'Mali İşlem İptali', detay: `${cancelTarget.tarih} · ${cancelTarget.kategori}` })
      showToast('success', 'Mali kayıt iptal edildi', 'Kayıt silinmedi; rapor hesaplarından çıkarıldı.')
      setCancelTarget(null)
      setCancelReason('Yanlış kayıt')
      await transactionsQuery.reload()
    } catch (error) {
      showToast('error', 'İptal işlemi başarısız', error instanceof Error ? error.message : undefined)
    } finally {
      setCanceling(false)
    }
  }

  const handleDownloadReport = async () => {
    setDownloadingReport(true)
    try {
      await downloadWeeklyFinancePdf({
        period,
        summary,
        generatedBy: profile?.adSoyad || 'Yönetici',
        visibleSections: visibleReportSections,
      })
      await logAudit({ islem: 'Haftalık Mali Rapor Oluşturma', detay: period.label })
      showToast('success', 'Haftalık mali rapor indirildi')
      setReportPreviewOpen(false)
    } catch (error) {
      showToast('error', 'Rapor oluşturulamadı', error instanceof Error ? error.message : undefined)
    } finally {
      setDownloadingReport(false)
    }
  }

  const toggleReportSection = (section: FinanceReportSection) => {
    setVisibleReportSections((current) => current.includes(section)
      ? current.filter((item) => item !== section)
      : [...current, section])
  }

  if (!unlocked) {
    return (
      <div className="page-container">
        <PageHeader title="Kasa / Gelir-Gider" description="Hassas mali kayıt alanı" />
        <Card accent="primary" className="mx-auto mt-8 max-w-xl">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-primary-100 p-3 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
              <LockKeyhole className="h-7 w-7" />
            </div>
            <div>
              <CardTitle>Kasa alanı kilitli</CardTitle>
              <CardDescription className="mt-2">
                Devam etmek için mevcut yönetici şifrenizi girin. Şifre kaydedilmez; bu sekme 15 dakika açık kalır.
              </CardDescription>
            </div>
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleUnlock}>
            <Input
              id="finance-password"
              label="Yönetici şifresi"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <Button type="submit" fullWidth disabled={unlocking}>
              <Unlock className="h-4 w-4" /> {unlocking ? 'Doğrulanıyor...' : 'Kasa Alanını Aç'}
            </Button>
          </form>
        </Card>
      </div>
    )
  }

  if (transactionsQuery.loading) return <Spinner label="Mali kayıtlar yükleniyor..." />

  return (
    <div className="page-container">
      <PageHeader
        title="Kasa / Gelir-Gider"
        description="Gelirleri, giderleri ve haftalık bakiyeyi tek yerden takip edin."
        action={
          <Button variant="secondary" size="sm" onClick={() => setUnlockedUntil(null)}>
            <LockKeyhole className="h-4 w-4" /> Kilitle
          </Button>
        }
      />

      <Card accent="primary" className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Önceki hafta" onClick={() => setWeekOffset((value) => value - 1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-52 text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300">Haftalık dönem</p>
              <p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{period.label}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Sonraki hafta" onClick={() => setWeekOffset((value) => value + 1)}>
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:flex">
            <Button variant="secondary" onClick={() => openCreate('devir')}>
              <WalletCards className="h-4 w-4" /> Devir Ekle
            </Button>
            <Button onClick={() => openCreate('gelir')}>
              <Plus className="h-4 w-4" /> Gelir Ekle
            </Button>
            <Button variant="danger" onClick={() => openCreate('gider')}>
              <Plus className="h-4 w-4" /> Gider Ekle
            </Button>
            <Button variant="secondary" onClick={() => openCreate('fon_donusumu')}>
              <ArrowRightLeft className="h-4 w-4" /> Fon / Konum Dönüşümü
            </Button>
            <Button variant="accent" onClick={() => setReportPreviewOpen(true)}>
              <Download className="h-4 w-4" /> Haftalık Rapor
            </Button>
          </div>
        </div>
      </Card>

      {!hasOpeningBalance ? (
        <Card accent="warning" className="mb-6 border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-amber-950 dark:text-amber-100">Başlangıç bakiyesi henüz girilmedi</CardTitle>
              <CardDescription className="mt-1 text-amber-800 dark:text-amber-200">
                İlk kez kullanmadan önce kasadaki ve bankadaki devreden tutarları ayrı ayrı ekleyin.
              </CardDescription>
            </div>
            <Button variant="accent" onClick={() => openCreate('devir')}>Başlangıç Bakiyesi Ekle</Button>
          </div>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceMetric label="Devreden" amounts={summary.opening} icon={WalletCards} tone="primary" />
        <FinanceMetric label="Bu Haftaki Gelir" amounts={summary.income} icon={CircleDollarSign} tone="success" />
        <FinanceMetric label="Bu Haftaki Gider" amounts={summary.expense} icon={Landmark} tone="danger" />
        <FinanceMetric label="Kalan Bakiye" amounts={summary.closing} icon={WalletCards} tone="warning" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <BalanceCard title="Nakit" amounts={{ TRY: summary.accountBalances.TRY.nakit, EUR: summary.accountBalances.EUR.nakit, USD: summary.accountBalances.USD.nakit }} />
        <BalanceCard title="Banka" amounts={{ TRY: summary.accountBalances.TRY.banka, EUR: summary.accountBalances.EUR.banka, USD: summary.accountBalances.USD.banka }} />
      </div>

      <Card accent="primary" className="mb-6">
        <CardTitle>Fon Bakiyeleri</CardTitle>
        <CardDescription className="mt-1">Zekât, bağış ve genel kaynaklar birbirinden ayrı hesaplanır.</CardDescription>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {FUND_OPTIONS.map((fund) => (
            <div key={fund} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
              <p className="font-semibold text-slate-700 dark:text-slate-200">{fund}</p>
              <p className="mt-2 font-bold text-slate-900 dark:text-slate-100">{amountText(summary.fundBalances[fund].TRY, 'TRY')}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{amountText(summary.fundBalances[fund].EUR, 'EUR')}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{amountText(summary.fundBalances[fund].USD, 'USD')}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card accent="primary" className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Haftanın Mali Hareketleri</CardTitle>
            <CardDescription className="mt-1">Dönem başı devri dahil tüm hareketleri düzenleyin veya kaldırın. Kaldırılan kayıtlar rapor toplamlarına dahil edilmez.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowCanceled((value) => !value)}>
            {showCanceled ? 'İptalleri Gizle' : 'İptalleri Göster'}
          </Button>
        </div>

        {transactionsQuery.error ? (
          <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-400">{transactionsQuery.error}</p>
        ) : null}

        <div className="mt-4 space-y-3">
          {shownTransactions.length > 0 ? shownTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className={`rounded-2xl border p-4 ${transaction.durum === 'iptal'
                ? 'border-slate-200 bg-slate-50/70 opacity-70 dark:border-slate-800 dark:bg-slate-900/40'
                : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50'}`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={typeTone(transaction.tur)}>{transaction.tur === 'fon_donusumu' ? conversionLabel(transaction) : financeDirectionLabel(transaction.tur)}</Badge>
                    {transaction.durum === 'iptal' ? <Badge tone="default">İptal</Badge> : null}
                    <p className="font-bold text-slate-900 dark:text-slate-100">{transaction.taraf}</p>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{formatDateTR(transaction.tarih)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {transaction.kategori} · {transaction.tur === 'fon_donusumu' ? `${transaction.fon} → ${transaction.hedefFon}` : transaction.fon} · {accountMovementLabel(transaction)} · {transaction.paraBirimi}
                  </p>
                  {transaction.aciklama ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{transaction.aciklama}</p> : null}
                  {transaction.durum === 'iptal' ? <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">İptal: {transaction.iptalNotu}</p> : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                  <p className={`mr-2 text-lg font-bold ${transaction.tur === 'gelir' ? 'text-emerald-600 dark:text-emerald-300' : transaction.tur === 'gider' ? 'text-rose-600 dark:text-rose-300' : 'text-primary-700 dark:text-primary-300'}`}>
                    {transaction.tur === 'gider' ? '−' : transaction.tur === 'fon_donusumu' ? '↔' : '+'}{amountText(transaction.tutarKurus, transaction.paraBirimi)}
                  </p>
                  {transaction.durum === 'aktif' ? (
                    <>
                      <Button variant="ghost" size="icon" aria-label="Kaydı düzenle" onClick={() => setEditor({ transaction, form: formFromTransaction(transaction) })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Kaydı kaldır" onClick={() => setCancelTarget(transaction)}>
                        <Ban className="h-4 w-4 text-rose-600 dark:text-rose-300" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
              <p className="font-semibold text-slate-700 dark:text-slate-200">Bu hafta henüz mali hareket yok.</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gelir veya gider ekleyerek başlayabilirsiniz.</p>
            </div>
          )}
        </div>
      </Card>

      <FinanceEditor
        editor={editor}
        saving={saving}
        students={studentsQuery.data ?? []}
        expenseCategoryOptions={expenseCategoryOptions}
        onClose={() => !saving && setEditor(null)}
        onChange={(form) => setEditor((current) => current ? { ...current, form } : current)}
        onSubmit={handleSave}
      />

      <FinanceReportPreview
        open={reportPreviewOpen}
        period={period}
        summary={summary}
        visibleSections={visibleReportSections}
        downloading={downloadingReport}
        onClose={() => !downloadingReport && setReportPreviewOpen(false)}
        onToggle={toggleReportSection}
        onShowAll={() => setVisibleReportSections(ALL_REPORT_SECTIONS)}
        onDownload={() => void handleDownloadReport()}
      />

      <Modal
        open={cancelTarget !== null}
        onClose={() => !canceling && setCancelTarget(null)}
        title="Mali kaydı kaldır"
        description="Kayıt ekrandan ve rapor toplamlarından çıkarılır. Denetim için yalnız iptal kaydı saklanır."
      >
        <div className="space-y-4">
          <p className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
            {cancelTarget ? `${formatDateTR(cancelTarget.tarih)} · ${cancelTarget.taraf} · ${amountText(cancelTarget.tutarKurus, cancelTarget.paraBirimi)}` : ''}
          </p>
          <Input id="finance-cancel-reason" label="İptal açıklaması" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" fullWidth onClick={() => setCancelTarget(null)} disabled={canceling}>Vazgeç</Button>
            <Button variant="danger" fullWidth onClick={() => void handleCancel()} disabled={canceling}>{canceling ? 'Kaldırılıyor...' : 'Kaydı Kaldır'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function FinanceMetric({ label, amounts, icon: Icon, tone }: {
  label: string
  amounts: FinanceCurrencyTotals
  icon: typeof WalletCards
  tone: 'primary' | 'success' | 'danger' | 'warning'
}) {
  const toneClasses = {
    primary: 'bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    danger: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  }[tone]

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">{amountText(amounts.TRY, 'TRY')}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{amountText(amounts.EUR, 'EUR')}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{amountText(amounts.USD, 'USD')}</p>
        </div>
        <div className={`rounded-2xl p-3 ${toneClasses}`}><Icon className="h-5 w-5" /></div>
      </div>
    </Card>
  )
}

function BalanceCard({ title, amounts }: { title: string; amounts: FinanceCurrencyTotals }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {title === 'Nakit' ? <WalletCards className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
        </div>
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{amountText(amounts.TRY, 'TRY')}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{amountText(amounts.EUR, 'EUR')}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{amountText(amounts.USD, 'USD')}</p>
        </div>
      </div>
    </Card>
  )
}

function FinanceReportPreview({
  open,
  period,
  summary,
  visibleSections,
  downloading,
  onClose,
  onToggle,
  onShowAll,
  onDownload,
}: {
  open: boolean
  period: FinanceWeekRange
  summary: FinanceSummary
  visibleSections: FinanceReportSection[]
  downloading: boolean
  onClose: () => void
  onToggle: (section: FinanceReportSection) => void
  onShowAll: () => void
  onDownload: () => void
}) {
  const active = summary.periodTransactions.filter((transaction) => transaction.durum === 'aktif')
  const counts: Record<FinanceReportSection, number> = {
    summary: 0,
    funds: 0,
    carries: active.filter((transaction) => transaction.tur === 'devir').length,
    conversions: active.filter((transaction) => transaction.tur === 'fon_donusumu').length,
    income: active.filter((transaction) => transaction.tur === 'gelir').length,
    expense: active.filter((transaction) => transaction.tur === 'gider').length,
    accounts: 0,
  }

  const detail = (section: FinanceReportSection): string => {
    if (section === 'summary') return `Kalan: ${amountText(summary.closing.TRY, 'TRY')}`
    if (section === 'funds') return `Bağış fonu: ${amountText(summary.fundBalances.Bağış.TRY, 'TRY')}`
    if (section === 'accounts') return `Nakit ${amountText(summary.accountBalances.TRY.nakit, 'TRY')} · Banka ${amountText(summary.accountBalances.TRY.banka, 'TRY')}`
    const count = counts[section]
    return count === 0 ? 'Bu hafta kayıt yok' : `${count} kayıt raporda listelenecek`
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Haftalık rapor önizlemesi"
      description={`${period.label} · PDF'de görmek istemediğiniz bölümleri gizleyebilirsiniz.`}
      className="max-w-2xl"
    >
      <div className="space-y-3">
        {REPORT_SECTION_OPTIONS.map((section) => {
          const visible = visibleSections.includes(section.id)
          return (
            <div key={section.id} className={`rounded-2xl border p-4 ${visible ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50' : 'border-slate-200 bg-slate-50/50 opacity-65 dark:border-slate-800 dark:bg-slate-900/40'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{section.label}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{section.description}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{visible ? detail(section.id) : "Bu bölüm PDF'de gizlenecek"}</p>
                </div>
                <Button variant={visible ? 'secondary' : 'ghost'} size="sm" onClick={() => onToggle(section.id)} disabled={downloading}>
                  {visible ? 'Gizle' : 'Göster'}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Button variant="secondary" fullWidth onClick={onShowAll} disabled={downloading || visibleSections.length === REPORT_SECTION_OPTIONS.length}>Tümünü Göster</Button>
        <Button fullWidth onClick={onDownload} disabled={downloading || visibleSections.length === 0}>
          <Download className="h-4 w-4" /> {downloading ? 'Hazırlanıyor...' : 'PDF İndir'}
        </Button>
      </div>
      {visibleSections.length === 0 ? <p className="mt-3 text-center text-sm text-rose-600 dark:text-rose-300">İndirmek için en az bir bölüm gösterilmelidir.</p> : null}
    </Modal>
  )
}

function FinanceEditor({
  editor,
  saving,
  students,
  expenseCategoryOptions,
  onClose,
  onChange,
  onSubmit,
}: {
  editor: { transaction: FinanceTransaction | null; form: FinanceForm } | null
  saving: boolean
  students: Student[]
  expenseCategoryOptions: string[]
  onClose: () => void
  onChange: (form: FinanceForm) => void
  onSubmit: (event: React.FormEvent) => void
}) {
  if (!editor) return null
  const { form, transaction } = editor
  const isExpense = form.tur === 'gider'
  const isCarry = form.tur === 'devir'
  const isFundConversion = form.tur === 'fon_donusumu'
  const isDonationAccountTransfer = isFundConversion && form.fon === 'Bağış' && form.hedefFon === 'Bağış'
  const categoryOptions = isExpense ? expenseCategoryOptions : INCOME_CATEGORIES
  const title = transaction
    ? 'Mali Kaydı Düzenle'
    : isFundConversion
      ? 'Fon / Konum Dönüşümü'
    : isCarry
      ? 'Devreden Bakiye Ekle'
      : isExpense
        ? 'Gider Ekle'
        : 'Gelir Ekle'

  const update = <K extends keyof FinanceForm>(key: K, value: FinanceForm[K]) => onChange({ ...form, [key]: value })

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={isFundConversion
        ? isDonationAccountTransfer
          ? 'Bağış fonu aynı kalır. Paranın yerini Banka hesabı ile Nakit kasa arasında seçtiğiniz öğrenci için kaydedebilirsiniz.'
          : 'Bu hareket gelir, gider ve toplam kasayı değiştirmez. Zekât fonunu Bağış fonuna aktarır; isterseniz paranın konumunu Banka ve Nakit arasında da taşırsınız.'
        : isCarry
          ? 'Bu tutarı haftalık başlangıç bakiyesi olarak kullanın.'
          : 'Tutarları Türkçe biçimde yazabilirsiniz: 1.250,50'}
      className="max-w-2xl"
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="finance-date" label="Tarih" type="date" value={form.tarih} onChange={(event) => update('tarih', event.target.value)} required />
          <Input id="finance-amount" label="Tutar" inputMode="decimal" placeholder="Örn. 1.250,50" value={form.tutar} onChange={(event) => update('tutar', event.target.value)} required />
          <Select id="finance-currency" label="Para birimi" value={form.paraBirimi} onChange={(event) => update('paraBirimi', event.target.value as FinanceCurrency)}>
            <option value="TRY">Türk Lirası (₺)</option>
            <option value="EUR">Euro (€)</option>
            <option value="USD">ABD Doları ($)</option>
          </Select>
          {isFundConversion ? (
            <Select
              id="finance-conversion-kind"
              label="İşlem türü"
              value={isDonationAccountTransfer ? 'bagis_konum' : 'zekat_bagis'}
              onChange={(event) => {
                const donationAccountTransfer = event.target.value === 'bagis_konum'
                onChange({
                  ...form,
                  fon: donationAccountTransfer ? 'Bağış' : 'Zekât',
                  hedefFon: 'Bağış',
                  kategori: donationAccountTransfer ? 'Bağış fonu konum değişimi' : 'Zekâtı Bağışa Dönüştürme',
                  taraf: form.ogrenciId ? form.taraf : '',
                })
              }}
            >
              <option value="zekat_bagis">Zekâtı bağışa çevir</option>
              <option value="bagis_konum">Bağış fonu konum değişimi</option>
            </Select>
          ) : null}
          <Select
            id="finance-account"
            label={isFundConversion ? 'Paranın bulunduğu yer' : 'Yer'}
            value={form.hesap}
            onChange={(event) => {
              const hesap = event.target.value as FinanceAccount
              onChange({
                ...form,
                hesap,
                hedefHesap: isFundConversion && (form.hedefHesap ?? form.hesap) === form.hesap ? hesap : form.hedefHesap,
              })
            }}
          >
            <option value="nakit">Nakit kasa</option>
            <option value="banka">Banka hesabı</option>
          </Select>
          {isFundConversion ? (
            <>
              <Select id="finance-target-account" label="Paranın geçtiği yer" value={form.hedefHesap ?? form.hesap} onChange={(event) => update('hedefHesap', event.target.value as FinanceAccount)}>
                <option value="nakit">Nakit kasa</option>
                <option value="banka">Banka hesabı</option>
              </Select>
              <div className="sm:col-span-2 rounded-xl border border-primary-200 bg-primary-50 p-3 text-sm font-semibold text-primary-800 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-200">
                {isDonationAccountTransfer
                  ? 'Bağış fonu sabit kalır. Aynı yeri seçerseniz para konumu da değişmez.'
                  : 'Zekât fonu → Bağış fonu. Aynı yeri seçerseniz para konumu değişmez.'}
              </div>
            </>
          ) : (
            <Select id="finance-fund" label="Fon türü" value={form.fon} onChange={(event) => update('fon', event.target.value as FinanceFund)}>
              {FUND_OPTIONS.map((fund) => <option key={fund} value={fund}>{fund}</option>)}
            </Select>
          )}
          {!isFundConversion ? (
            <div>
              <Input
                id="finance-category"
                label="Kategori"
                list="finance-category-options"
                placeholder={isExpense ? 'İlk kez siz yazın; sonrasında öneri olur' : undefined}
                value={form.kategori}
                onChange={(event) => update('kategori', event.target.value)}
                required
              />
              <datalist id="finance-category-options">
                {categoryOptions.map((category) => <option key={category} value={category} />)}
              </datalist>
            </div>
          ) : null}
        </div>
        {isFundConversion ? (
          <Select
            id="finance-student"
            label={isDonationAccountTransfer ? 'Hangi öğrenci için konum değiştirildi?' : 'Hangi öğrenci için dönüştürüldü?'}
            value={form.ogrenciId ?? ''}
            onChange={(event) => {
              const student = students.find((item) => item.id === event.target.value)
              onChange({ ...form, ogrenciId: student?.id, taraf: student?.adSoyad ?? '' })
            }}
            required
            disabled={saving || students.length === 0}
          >
            <option value="" disabled>{students.length === 0 ? 'Öğrenciler yükleniyor...' : 'Öğrenci seçin'}</option>
            {students.map((student) => <option key={student.id} value={student.id}>{student.adSoyad} · Oda {student.odaNo}</option>)}
          </Select>
        ) : !isFundConversion ? (
          <Input
            id="finance-party"
            label={isCarry ? 'Devir kaynağı' : isExpense ? 'Kime / nereye ödendi?' : 'Kimden geldi?'}
            value={form.taraf}
            onChange={(event) => update('taraf', event.target.value)}
            required
          />
        ) : null}
        <Textarea id="finance-note" label="Açıklama (isteğe bağlı)" value={form.aciklama} onChange={(event) => update('aciklama', event.target.value)} />
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={saving}>Vazgeç</Button>
          <Button type="submit" fullWidth disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
        </div>
      </form>
    </Modal>
  )
}
