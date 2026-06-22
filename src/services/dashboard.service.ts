import { fetchDashboardAttendanceStats } from '@/services/attendance.service'
import { fetchPendingLeaves } from '@/services/leaves.service'
import { fetchStudentsList } from '@/services/students.service'
import type { DashboardStats } from '@/types'

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const students = await fetchStudentsList()
  const names = students.map((s) => s.adSoyad)
  const [pending, attendance] = await Promise.all([
    fetchPendingLeaves(),
    fetchDashboardAttendanceStats(names),
  ])

  return {
    toplamOgrenci: students.length,
    yetkiliOgrenci: students.filter((s) => s.canManageAttendance).length,
    bekleyenIzin: pending.length,
    riskliDevamsizlik: attendance.riskliDevamsizlik,
  }
}
