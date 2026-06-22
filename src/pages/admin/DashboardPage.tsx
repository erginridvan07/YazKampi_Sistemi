import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  School,
  Shield,
  UserCheck,
  XCircle,
} from 'lucide-react'
import { MetricCard } from '@/components/admin/MetricCard'
import { AttendanceTrendChart } from '@/components/admin/AttendanceTrendChart'
import { WeeklyAttendanceReportCard } from '@/components/admin/WeeklyAttendanceReportCard'
import { PageHeader } from '@/components/admin/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardDescription, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useAsync } from '@/hooks/useAsync'
import { fetchDashboardStats } from '@/services/dashboard.service'
import {
  fetchAnnouncements,
  fetchTodayDuty,
  filterAnnouncementsForDisplay,
} from '@/services/announcements.service'
import { fetchPendingLeaves, respondLeaveRequest } from '@/services/leaves.service'
import { fetchStudents } from '@/services/students.service'
import {
  buildMonthlyAbsenceTrend,
  buildWeeklyAttendanceReport,
  fetchAttendanceRecords,
} from '@/services/attendance.service'
import { logAudit, fetchRecentAuditLogs } from '@/services/audit.service'
import type { LeaveRequest } from '@/types'
import { askConfirm } from '@/stores/confirm.store'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'

type LeaveAction = 'Onaylandı' | 'Reddedildi'

export function AdminDashboardPage() {
  const profile = useAuthStore((s) => s.profile)
  const showToast = useToastStore((s) => s.showToast)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const statsQuery = useAsync(fetchDashboardStats, [])
  const leavesQuery = useAsync(fetchPendingLeaves, [])
  const announcementsQuery = useAsync(async () => {
    const [announcements, duty] = await Promise.all([
      fetchAnnouncements(),
      fetchTodayDuty(),
    ])
    return filterAnnouncementsForDisplay(announcements, duty, true)
  }, [])

  const trendQuery = useAsync(async () => {
    const [students, records] = await Promise.all([fetchStudents(), fetchAttendanceRecords()])
    const studentNames = students.map((s) => s.adSoyad)
    return {
      monthly: buildMonthlyAbsenceTrend(records, studentNames),
      weekly: buildWeeklyAttendanceReport(records),
    }
  }, [])

  const auditQuery = useAsync(() => fetchRecentAuditLogs(8), [])

  const handleLeaveClick = async (leave: LeaveRequest, durum: LeaveAction) => {
    const isApprove = durum === 'Onaylandı'
    const confirmed = await askConfirm({
      title: isApprove ? 'İzin Talebini Onayla' : 'İzin Talebini Reddet',
      description: isApprove
        ? 'Bu öğrencinin evci izin talebini onaylamak istediğinize emin misiniz?'
        : 'Bu öğrencinin evci izin talebini reddetmek istediğinize emin misiniz?',
      confirmLabel: isApprove ? 'Evet, Onayla' : 'Evet, Reddet',
      cancelLabel: 'Vazgeç',
      variant: isApprove ? 'success' : 'danger',
      children: (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-bold text-slate-900">{leave.ogrenciAd}</p>
          <p className="mt-1 text-slate-600">
            {leave.gidisTarihi} → {leave.donusTarihi}
          </p>
          <p className="mt-3 rounded-xl bg-white px-3 py-2 italic text-slate-500">
            "{leave.sebep}"
          </p>
        </div>
      ),
    })

    if (!confirmed) return

    setProcessingId(leave.id)
    try {
      await respondLeaveRequest(leave.id, durum, profile?.adSoyad || 'Yönetici')
      await logAudit({
        islem: isApprove ? 'İzin Onayı' : 'İzin Reddi',
        detay: `${leave.ogrenciAd} · ${leave.gidisTarihi} → ${leave.donusTarihi}`,
        yapan: profile?.adSoyad || 'Yönetici',
        rol: 'admin',
      })
      showToast(
        'success',
        isApprove ? 'İzin talebi onaylandı' : 'İzin talebi reddedildi',
        `${leave.ogrenciAd} · ${leave.gidisTarihi} → ${leave.donusTarihi}`,
      )
      await leavesQuery.reload()
      await statsQuery.reload()
      await auditQuery.reload()
    } catch (err) {
      showToast('error', 'İşlem başarısız', err instanceof Error ? err.message : undefined)
    } finally {
      setProcessingId(null)
    }
  }

  if (statsQuery.loading) return <Spinner />

  const stats = statsQuery.data

  return (
    <div className="page-container">
      <PageHeader
        title="Yönetim Paneli"
        description={`Hoş geldin, ${profile?.adSoyad || 'Yönetici'}`}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Toplam Öğrenci" value={stats?.toplamOgrenci ?? 0} icon={School} tone="emerald" />
        <MetricCard label="Yoklama Yetkilisi" value={stats?.yetkiliOgrenci ?? 0} icon={Shield} tone="indigo" />
        <MetricCard
          label="Bekleyen İzin"
          value={stats?.bekleyenIzin ?? 0}
          icon={UserCheck}
          tone={stats && stats.bekleyenIzin > 0 ? 'rose' : 'amber'}
        />
        <MetricCard
          label="Riskli Devamsızlık (5+)"
          value={stats?.riskliDevamsizlik ?? 0}
          icon={AlertTriangle}
          tone={stats && stats.riskliDevamsizlik > 0 ? 'rose' : 'sky'}
        />
      </div>

      {trendQuery.data ? (
        <div className="mb-8 space-y-8">
          <AttendanceTrendChart data={trendQuery.data.monthly} />
          <WeeklyAttendanceReportCard data={trendQuery.data.weekly} />
        </div>
      ) : null}

      {leavesQuery.data && leavesQuery.data.length > 0 ? (
        <Card accent="warning" className="mb-8">
          <CardTitle>Bekleyen İzin Talepleri</CardTitle>
          <div className="mt-4 space-y-3">
            {leavesQuery.data.map((leave) => (
              <div
                key={leave.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
              >
                <div>
                  <p className="font-bold text-amber-900">{leave.ogrenciAd}</p>
                  <p className="text-sm text-amber-700">
                    {leave.gidisTarihi} → {leave.donusTarihi}
                  </p>
                  <p className="mt-2 text-sm italic text-slate-600">"{leave.sebep}"</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleLeaveClick(leave, 'Onaylandı')}
                    disabled={processingId === leave.id}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Onayla
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleLeaveClick(leave, 'Reddedildi')}
                    disabled={processingId === leave.id}
                  >
                    <XCircle className="h-4 w-4" /> Reddet
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card accent="primary" className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>Aktif Duyurular</CardTitle>
          <Link to="/admin/duyuru">
            <Button variant="secondary" size="sm">
              Tümünü Yönet
            </Button>
          </Link>
        </div>
        {announcementsQuery.loading ? (
          <Spinner label="Duyurular yükleniyor..." />
        ) : announcementsQuery.data && announcementsQuery.data.length > 0 ? (
          <div className="space-y-3">
            {announcementsQuery.data.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center gap-2">
                  <Badge tone={item.tone === 'bugun' ? 'danger' : item.tone === 'yaklasiyor' ? 'warning' : 'primary'}>
                    {item.type === 'duty' ? 'Görev' : 'Duyuru'}
                  </Badge>
                  <p className="font-bold text-slate-800">{item.title}</p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <CardDescription>Aktif duyuru bulunmuyor.</CardDescription>
        )}
      </Card>

      {auditQuery.data && auditQuery.data.length > 0 ? (
        <Card className="mb-8">
          <CardTitle>Son İşlemler</CardTitle>
          <div className="mt-4 space-y-2">
            {auditQuery.data.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/60"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{log.islem}</p>
                  {log.detay ? (
                    <p className="text-slate-500 dark:text-slate-400">{log.detay}</p>
                  ) : null}
                </div>
                <p className="text-xs text-slate-400">
                  {log.yapan} · {new Date(log.timestamp).toLocaleString('tr-TR')}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/admin/ogrenciler" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary-300 hover:shadow-md">
          <p className="font-bold text-slate-900">Öğrenci Yönetimi</p>
          <p className="mt-1 text-sm text-slate-500">Kayıt, düzenleme ve listeleme</p>
        </Link>
        <Link to="/admin/yoklama" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary-300 hover:shadow-md">
          <p className="font-bold text-slate-900">Namaz Yoklaması</p>
          <p className="mt-1 text-sm text-slate-500">Günlük yoklama kaydı</p>
        </Link>
        <Link to="/admin/raporlar" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary-300 hover:shadow-md">
          <p className="font-bold text-slate-900">Devamsızlık Raporları</p>
          <p className="mt-1 text-sm text-slate-500">Takvim ve istatistikler</p>
        </Link>
      </div>
    </div>
  )
}
