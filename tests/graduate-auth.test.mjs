import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { toAuthEmail } from '../shared/authIdentity.mjs'
import {
  GRADUATE_AUTH_STATUS,
  GRADUATE_AUTH_USERNAME,
  GRADUATE_LOGIN_MODE,
  GRADUATE_PASSWORD_STATUS,
  GRADUATE_ROTATION_STATUS,
  assessGraduateClientAuthOnlyReady,
  assertNoPasswordInReport,
  buildGraduateLoginPasswordDeleteUpdate,
  classifyGraduateAuthCheck,
  classifyGraduatePasswordCleanup,
  classifyGraduatePasswordRotation,
  isPasswordOnlyDeleteUpdate,
} from '../shared/graduateAuth.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function readSources() {
  return {
    authService: readFileSync(join(ROOT, 'src', 'services', 'auth.service.ts'), 'utf8'),
    graduatesService: readFileSync(join(ROOT, 'src', 'services', 'graduates.service.ts'), 'utf8'),
    adminSettings: readFileSync(
      join(ROOT, 'src', 'components', 'admin', 'GraduateSettingsSection.tsx'),
      'utf8',
    ),
  }
}

test('A) graduate login does not read Firestore password', () => {
  const { authService, graduatesService } = readSources()
  assert.equal(authService.includes('verifyGraduatePortalLogin'), false)
  assert.equal(graduatesService.includes('verifyGraduatePortalLogin'), false)
  assert.equal(authService.includes('settings.password'), false)
})

test('B) graduate login uses signInWithEmailAndPassword', () => {
  const { authService } = readSources()
  assert.equal(authService.includes('signInWithEmailAndPassword'), true)
  assert.equal(authService.includes("loginType === 'mezunlar'"), true)
  assert.equal(toAuthEmail(GRADUATE_AUTH_USERNAME), 'mezun.portal@gayevakfi.portal')
})

test('C) Auth fail has no legacy Firestore password fallback', () => {
  const { authService } = readSources()
  assert.equal(authService.includes('fetchGraduateLoginSettings'), false)
  assert.equal(authService.includes('verifyGraduatePortalLogin'), false)
  assert.match(authService, /GENERIC_LOGIN_ERROR/)
})

test('D) admin web UI does not write or change password', () => {
  const { graduatesService, adminSettings } = readSources()
  assert.equal(adminSettings.includes('mezun-password'), false)
  assert.equal(adminSettings.includes('loginForm.password'), false)
  assert.equal(graduatesService.includes('syncGraduateFirebaseAccount'), false)
  assert.equal(/\bupdatePassword\s*\(/.test(graduatesService), false)
  assert.equal(graduatesService.includes('password: settings.password'), false)
})

test('E) client does not write role=graduate', () => {
  const { authService, graduatesService } = readSources()
  assert.equal(authService.includes("role: 'graduate'"), false)
  assert.equal(authService.includes('setDoc(doc(db, \'users\''), false)
  assert.equal(graduatesService.includes("role: 'graduate'"), false)
})

test('F) cleanup can delete only the password field', () => {
  const sentinel = { _delete: true }
  const update = buildGraduateLoginPasswordDeleteUpdate(sentinel)
  assert.equal(isPasswordOnlyDeleteUpdate(update), true)
  assert.equal(Object.keys(update).join(','), 'password')
  assert.equal(update.password, sentinel)

  const blocked = classifyGraduatePasswordCleanup({
    authStatus: GRADUATE_AUTH_STATUS.OK,
    clientAuthOnlyReady: false,
    passwordPresent: true,
  })
  assert.equal(blocked.allowed, false)

  const ready = classifyGraduatePasswordCleanup({
    authStatus: GRADUATE_AUTH_STATUS.OK,
    clientAuthOnlyReady: true,
    passwordPresent: true,
  })
  assert.equal(ready.allowed, true)
})

test('G) rotation never classifies a Firestore password write as allowed', () => {
  const expectedEmail = toAuthEmail(GRADUATE_AUTH_USERNAME)
  const forbidden = classifyGraduatePasswordRotation({
    authExists: true,
    authEmail: expectedEmail,
    expectedEmail,
    authUid: 'uid-g',
    resolvedUid: 'uid-g',
    profileRole: 'graduate',
    newPasswordLength: 12,
    confirmMatches: true,
    writesFirestore: true,
  })
  assert.equal(forbidden.allowed, false)
  assert.equal(forbidden.status, GRADUATE_ROTATION_STATUS.FORBIDDEN_FIRESTORE_WRITE)

  const otherUser = classifyGraduatePasswordRotation({
    authExists: true,
    authEmail: expectedEmail,
    expectedEmail,
    authUid: 'uid-g',
    resolvedUid: 'someone-else',
    profileRole: 'graduate',
    newPasswordLength: 12,
    confirmMatches: true,
    writesFirestore: false,
  })
  assert.equal(otherUser.allowed, false)
})

test('graduate auth check statuses and password secrecy', () => {
  assert.equal(
    classifyGraduateAuthCheck({ authExists: false }).authStatus,
    GRADUATE_AUTH_STATUS.MISSING,
  )
  assert.equal(
    classifyGraduateAuthCheck({
      authExists: true,
      authDisabled: true,
      profile: { role: 'graduate' },
    }).authStatus,
    GRADUATE_AUTH_STATUS.DISABLED,
  )
  assert.equal(
    classifyGraduateAuthCheck({
      authExists: true,
      profile: { role: 'student' },
    }).authStatus,
    GRADUATE_AUTH_STATUS.PROFILE_INVALID,
  )
  const present = classifyGraduateAuthCheck({
    authExists: true,
    profile: { role: 'graduate' },
    loginDoc: { password: 'SECRET_SHOULD_NOT_LEAK', welcomeTitle: 'x' },
  })
  assert.equal(present.authStatus, GRADUATE_AUTH_STATUS.OK)
  assert.equal(present.passwordStatus, GRADUATE_PASSWORD_STATUS.PRESENT)
  assert.equal(JSON.stringify(present).includes('SECRET_SHOULD_NOT_LEAK'), false)
  assert.equal(GRADUATE_LOGIN_MODE, 'auth-only')
  assertNoPasswordInReport(present)
})

test('client source is Auth-only ready', () => {
  const ready = assessGraduateClientAuthOnlyReady(readSources())
  assert.deepEqual(ready.failures, [])
  assert.equal(ready.ready, true)
})

test('P3.1 welcome metadata uses mezun_ayarlar/karsilama, not mezun_giris', () => {
  const homePage = readFileSync(join(ROOT, 'src', 'pages', 'graduate', 'HomePage.tsx'), 'utf8')
  const { graduatesService, adminSettings, authService } = readSources()

  assert.equal(homePage.includes('fetchGraduateWelcomeSettings'), true)
  assert.equal(homePage.includes('DEFAULT_GRADUATE_WELCOME'), true)
  assert.equal(homePage.includes('fetchGraduateLoginSettings'), false)
  assert.equal(homePage.includes("ayarlar', 'mezun_giris"), false)
  assert.equal(homePage.includes('getDocs'), false)

  assert.equal(adminSettings.includes('saveGraduateWelcomeSettings'), true)
  assert.equal(adminSettings.includes('fetchGraduateWelcomeSettings'), true)
  assert.equal(adminSettings.includes('saveGraduateLoginSettings'), false)
  assert.equal(adminSettings.includes('fetchGraduateLoginSettings'), false)

  assert.equal(graduatesService.includes("doc(db, WELCOME_COL, WELCOME_DOC_ID)"), true)
  assert.match(graduatesService, /WELCOME_COL = 'mezun_ayarlar'/)
  assert.match(graduatesService, /WELCOME_DOC_ID = 'karsilama'/)
  assert.equal(graduatesService.includes("doc(db, 'ayarlar', 'mezun_giris')"), false)
  assert.equal(graduatesService.includes('saveGraduateLoginSettings'), false)
  assert.equal(graduatesService.includes('password:'), false)
  assert.equal(graduatesService.includes('username:'), false)
  assert.equal(graduatesService.includes('enabled:'), false)

  assert.equal(authService.includes('fetchGraduateWelcomeSettings'), false)
  assert.equal(authService.includes('mezun_ayarlar'), false)
})
