import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { toAuthEmail } from '../shared/authIdentity.mjs'
import { isPasswordOnlyDeleteUpdate } from '../shared/graduateAuth.mjs'
import {
  ADMIN_BINDING_STATUS,
  ADMIN_PASSWORD_STATUS,
  adminCollisionFlags,
  assertNoPasswordValueInAdminPayload,
  buildAdminCollisionIndex,
  buildAdminPasswordDeleteUpdate,
  classifyAdminBinding,
  classifyAdminPasswordCleanup,
  hasAdminPlaintextPasswordField,
  toAdminAuthManifestRow,
} from '../shared/adminAuth.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const OK_PROFILE = {
  role: 'admin',
  legacyCollection: 'yoneticiler',
  legacyDocId: 'adm-1',
  username: 'yonetici',
}

test('admin binding ok + password present/absent', () => {
  const present = classifyAdminBinding({
    legacyDocId: 'adm-1',
    username: 'yonetici',
    passwordPresent: true,
    authExists: true,
    profile: OK_PROFILE,
  })
  assert.equal(present.bindingStatus, ADMIN_BINDING_STATUS.OK)
  assert.equal(present.passwordStatus, ADMIN_PASSWORD_STATUS.PRESENT)
  assert.equal(present.manualReviewRequired, false)

  const absent = classifyAdminBinding({
    legacyDocId: 'adm-1',
    username: 'yonetici',
    passwordPresent: false,
    authExists: true,
    profile: OK_PROFILE,
  })
  assert.equal(absent.passwordStatus, ADMIN_PASSWORD_STATUS.ABSENT)
  assert.equal(absent.bindingStatus, ADMIN_BINDING_STATUS.OK)
})

test('duplicate admin username is never auto-matched', () => {
  const index = buildAdminCollisionIndex([{ username: 'yonetici' }, { username: 'Yonetici' }])
  const flags = adminCollisionFlags('yonetici', index)
  assert.equal(flags.duplicateUsername, true)

  const classified = classifyAdminBinding({
    legacyDocId: 'adm-1',
    username: 'yonetici',
    duplicateUsername: true,
    authExists: true,
    profile: OK_PROFILE,
    passwordPresent: true,
  })
  assert.equal(classified.bindingStatus, ADMIN_BINDING_STATUS.DUPLICATE_USERNAME)
  assert.equal(classified.manualReviewRequired, true)
  assert.equal(
    classifyAdminPasswordCleanup({
      bindingStatus: classified.bindingStatus,
      passwordPresent: true,
      manualReviewRequired: classified.manualReviewRequired,
    }).allowed,
    false,
  )
})

test('canonical email collision is manual review', () => {
  const index = buildAdminCollisionIndex([{ username: 'ali' }, { username: 'ali!' }])
  const flags = adminCollisionFlags('ali', index)
  assert.equal(flags.emailCollision, true)
  assert.equal(flags.duplicateUsername, false)
  assert.equal(flags.email, toAuthEmail('ali'))

  const classified = classifyAdminBinding({
    legacyDocId: 'adm-a',
    username: 'ali',
    emailCollision: true,
    authExists: true,
    profile: { ...OK_PROFILE, username: 'ali', legacyDocId: 'adm-a' },
  })
  assert.equal(classified.bindingStatus, ADMIN_BINDING_STATUS.DUPLICATE_USERNAME)
  assert.equal(classified.reason, 'canonical_email_collision')
  assert.equal(classified.manualReviewRequired, true)
})

test('profile mismatch and missing / disabled / invalid username', () => {
  assert.equal(
    classifyAdminBinding({
      legacyDocId: 'adm-1',
      username: 'yonetici',
      authExists: true,
      profile: { ...OK_PROFILE, role: 'student' },
    }).bindingStatus,
    ADMIN_BINDING_STATUS.PROFILE_MISMATCH,
  )
  assert.equal(
    classifyAdminBinding({
      legacyDocId: 'adm-1',
      username: 'yonetici',
      authExists: true,
      profile: { ...OK_PROFILE, legacyDocId: 'other' },
    }).bindingStatus,
    ADMIN_BINDING_STATUS.PROFILE_MISMATCH,
  )
  assert.equal(
    classifyAdminBinding({
      legacyDocId: 'adm-1',
      username: 'yonetici',
      authExists: true,
      profile: null,
    }).bindingStatus,
    ADMIN_BINDING_STATUS.PROFILE_MISSING,
  )
  assert.equal(
    classifyAdminBinding({
      legacyDocId: 'adm-1',
      username: 'yonetici',
      authExists: true,
      authDisabled: true,
      profile: OK_PROFILE,
    }).bindingStatus,
    ADMIN_BINDING_STATUS.AUTH_DISABLED,
  )
  assert.equal(
    classifyAdminBinding({
      legacyDocId: 'adm-1',
      username: 'yonetici',
      authExists: false,
    }).bindingStatus,
    ADMIN_BINDING_STATUS.AUTH_MISSING,
  )
  assert.equal(
    classifyAdminBinding({
      legacyDocId: 'adm-1',
      username: '',
    }).bindingStatus,
    ADMIN_BINDING_STATUS.USERNAME_INVALID,
  )
  assert.equal(
    classifyAdminBinding({
      legacyDocId: 'adm-1',
      username: 'mezun.portal',
    }).bindingStatus,
    ADMIN_BINDING_STATUS.USERNAME_INVALID,
  )
})

test('password secrecy: value never enters classifier or manifest', () => {
  const data = { username: 'yonetici', password: 'SECRET_ADMIN_SHOULD_NOT_LEAK' }
  const classified = classifyAdminBinding({
    legacyDocId: 'adm-1',
    username: 'yonetici',
    passwordPresent: hasAdminPlaintextPasswordField(data),
    authExists: true,
    profile: OK_PROFILE,
  })
  const row = toAdminAuthManifestRow({
    legacyDocId: 'adm-1',
    username: 'yonetici',
    uid: 'uid-1',
    classified,
    cleanupEligible: true,
    timestamp: '2026-08-17T00:00:00.000Z',
  })
  assert.equal(classified.passwordPresent, true)
  assert.equal(JSON.stringify(classified).includes('SECRET_ADMIN_SHOULD_NOT_LEAK'), false)
  assert.equal(JSON.stringify(row).includes('SECRET_ADMIN_SHOULD_NOT_LEAK'), false)
  assert.equal(JSON.stringify(row).includes('"password":'), false)
  assertNoPasswordValueInAdminPayload({ classified, row, dataPasswordPresent: true })
})

test('cleanup write-mode guards', () => {
  assert.equal(
    classifyAdminPasswordCleanup({
      bindingStatus: ADMIN_BINDING_STATUS.OK,
      passwordPresent: true,
      manualReviewRequired: false,
    }).allowed,
    true,
  )
  assert.equal(
    classifyAdminPasswordCleanup({
      bindingStatus: ADMIN_BINDING_STATUS.OK,
      authDisabled: true,
      passwordPresent: true,
    }).allowed,
    false,
  )
  assert.equal(
    classifyAdminPasswordCleanup({
      bindingStatus: ADMIN_BINDING_STATUS.OK,
      passwordPresent: false,
    }).allowed,
    false,
  )
  assert.equal(
    classifyAdminPasswordCleanup({
      bindingStatus: ADMIN_BINDING_STATUS.PROFILE_MISMATCH,
      passwordPresent: true,
    }).allowed,
    false,
  )

  const sentinel = { _delete: true }
  const update = buildAdminPasswordDeleteUpdate(sentinel)
  assert.equal(isPasswordOnlyDeleteUpdate(update), true)
  assert.equal(Object.keys(update).join(','), 'password')
  assert.equal(update.password, sentinel)
})

test('client admin login does not read yoneticiler password', () => {
  const authService = readFileSync(join(ROOT, 'src', 'services', 'auth.service.ts'), 'utf8')
  assert.equal(authService.includes("collection(db, 'yoneticiler')"), false)
  assert.equal(authService.includes("doc(db, 'yoneticiler'"), false)
  assert.equal(authService.includes('signInWithEmailAndPassword'), true)
})
