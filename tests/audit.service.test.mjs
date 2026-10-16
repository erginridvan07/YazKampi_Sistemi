import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(path) {
  return readFileSync(join(ROOT, path), 'utf8')
}

test('A/B/C/D) audit service derives actorUid, uses serverTimestamp, and blocks arbitrary actor fields', () => {
  const service = read('src/services/audit.service.ts')

  assert.equal(service.includes('serverTimestamp()'), true)
  assert.equal(service.includes('auth.currentUser'), true)
  assert.equal(service.includes('actorUid: actor.actorUid'), true)
  assert.equal(service.includes('useAuthStore.getState().profile'), true)
  assert.equal(service.includes("getDoc(doc(db, USERS_COL, currentUser.uid))"), true)
  assert.equal(service.includes('new Date().toISOString()'), false)
  assert.equal(service.includes('entry.actorUid'), false)
  assert.equal(service.includes('entry.rol'), false)
  assert.equal(service.includes('entry.yapan'), false)
  assert.equal(service.includes('password'), false)
  assert.equal(service.includes('token'), false)
})

test('E/F/G) existing callers stay admin/delegated only and pass only islem/detay', () => {
  const dashboard = read('src/pages/admin/DashboardPage.tsx')
  const attendance = read('src/pages/shared/AttendancePage.tsx')
  const grades = read('src/pages/admin/GradesPage.tsx')
  const students = read('src/pages/admin/StudentsPage.tsx')
  const site = read('src/pages/admin/SitePage.tsx')
  const graduates = read('src/components/admin/GraduateSettingsSection.tsx')

  for (const source of [dashboard, attendance, grades, students, site, graduates]) {
    assert.equal(source.includes('logAudit({'), true)
  }

  for (const source of [dashboard, attendance, grades, students, site, graduates]) {
    assert.equal(source.includes('yapan:'), false)
    assert.equal(source.includes('rol:'), false)
    assert.equal(source.includes('actorUid:'), false)
  }

  const authService = read('src/services/auth.service.ts')
  assert.equal(authService.includes("collection(db, 'islem_loglari')"), false)

  const studentPages = [
    'src/pages/shared/ProfilePage.tsx',
    'src/pages/graduate/HomePage.tsx',
    'src/pages/LoginPage.tsx',
  ].map(read)

  for (const source of studentPages) {
    assert.equal(source.includes('logAudit('), false)
  }
})

