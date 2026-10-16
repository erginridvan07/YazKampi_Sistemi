#!/usr/bin/env node
/**
 * Local Firebase Admin SDK migration tool (Spark-friendly).
 *
 * Default: DRY-RUN (read-only analysis).
 * Live writes: --apply-owner-uid | --provision-student=<id>
 * Generic --apply is DISABLED.
 *
 * Credential: GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials.
 * Never hard-code service account paths or keys.
 */

import { createRequire } from 'node:module'
import { createHash, randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isReservedUsername,
  tryToAuthEmail,
  toAuthEmail,
} from '../shared/authIdentity.mjs'
import {
  ATTENDANCE_ROSTER_COLLECTION,
  assertRosterEntryAllowlist,
  buildAttendanceRosterEntry,
  classifyAttendanceRosterAgainstSource,
  isEligibleAttendanceRosterSource,
  ROSTER_FORBIDDEN_KEYS,
} from '../shared/attendanceRoster.mjs'
import {
  buildStudentsByAdSoyadIndex,
  classifyLeaveOwnerRequest,
  isLeaveOwnerManualReview,
  LEAVE_OWNER_BACKFILL_ELIGIBLE,
  LEAVE_OWNER_STATUS,
  toLeaveOwnerManifestRow,
  verifyStudentOwnerIdentity,
} from '../shared/leaveOwner.mjs'
import {
  GRADUATE_AUTH_USERNAME as SHARED_GRADUATE_AUTH_USERNAME,
  GRADUATE_AUTH_STATUS,
  GRADUATE_LOGIN_COLLECTION,
  GRADUATE_LOGIN_DOC_ID,
  GRADUATE_LOGIN_MODE,
  GRADUATE_MIN_PASSWORD_LENGTH,
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
import {
  ADMIN_BINDING_STATUS,
  ADMIN_LEGACY_COLLECTION,
  ADMIN_PASSWORD_STATUS,
  adminCollisionFlags,
  assertNoPasswordValueInAdminPayload,
  buildAdminCollisionIndex,
  buildAdminPasswordDeleteUpdate,
  classifyAdminBinding,
  classifyAdminPasswordCleanup,
  emptyAdminBindingCounts,
  hasAdminPlaintextPasswordField,
  incrementAdminCounts,
  normalizeAdminUsername,
  toAdminAuthManifestRow,
} from '../shared/adminAuth.mjs'
import {
  AUDIT_LOG_COLLECTION,
  AUDIT_TIMESTAMP_NORMALIZE_ELIGIBLE,
  AUDIT_TIMESTAMP_STATUS,
  assertNoSensitiveAuditFields,
  buildAuditTimestampNormalizeUpdate,
  classifyAuditTimestamp,
  isAuditTimestampManualReview,
  isTimestampOnlyUpdate,
  parseLegacyIsoInstant,
  shouldNormalizeAuditTimestamp,
  toAuditTimestampManifestRow,
} from '../shared/auditTimestamps.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const FUNCTIONS_PKG = join(ROOT, 'functions', 'package.json')
const MANIFEST_PATH = join(ROOT, 'migration-manifest.local.json')
const CREDENTIALS_OUT_PATH = join(ROOT, 'migration-credentials.local.json')
const PASSWORD_CLEANUP_MANIFEST_PATH = join(ROOT, 'migration-password-cleanup.local.json')
const ATTENDANCE_ROSTER_MANIFEST_PATH = join(ROOT, 'migration-attendance-roster.local.json')
const LEAVE_OWNER_MANIFEST_PATH = join(ROOT, 'migration-leave-owner.local.json')
const ADMIN_AUTH_MANIFEST_PATH = join(ROOT, 'migration-admin-auth.local.json')
const AUDIT_TIMESTAMP_MANIFEST_PATH = join(ROOT, 'migration-audit-timestamps.local.json')
const GRADUATE_AUTH_USERNAME = SHARED_GRADUATE_AUTH_USERNAME

const COLLECTIONS = /** @type {const} */ (['ogrenciler', 'yoneticiler'])
/** Live ownerUid backfill is restricted to this production project id. */
const OWNER_BACKFILL_ALLOWED_PROJECT = 'yurtyonetimsistemi'

const STATUS = {
  READY: 'READY',
  ALREADY_MIGRATED: 'ALREADY_MIGRATED',
  SAFE_EXISTING: 'SAFE_EXISTING',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  INVALID_RECORD: 'INVALID_RECORD',
  RESERVED: 'RESERVED',
  COLLISION: 'COLLISION',
  ERROR: 'ERROR',
  APPLIED: 'APPLIED',
  SKIPPED: 'SKIPPED',
}

function printHelp() {
  console.log(`
Legacy Auth Migration (local Admin SDK)

Usage:
  npm run migrate:auth -- [options]

Options:
  --project=<id>              Required. Target Firebase project id (e.g. yurtyonetimsistemi)
  --collection=ogrenciler|yoneticiler
                              Limit to one legacy collection
  --limit=<N>                 Process at most N records (after inventory filters)
  --apply                     DISABLED (deprecated). Use explicit write modes instead.
  --apply-owner-uid           LIVE: set ownerUid only on OWNER_MISSING + verified students.
                              Requires --project=yurtyonetimsistemi. Does not touch passwords/attendance.
  --provision-student=<docId> LIVE: provision Auth+users+ownerUid for one ogrenciler doc.
                              Strict identity binding. Requires --project=yurtyonetimsistemi.
  --check-graduate-auth       READ-ONLY: shared mezun.portal Auth + users profile + mezun_giris.password presence.
  --check-graduate-profile    Alias of --check-graduate-auth.
  --check-admin-auth          READ-ONLY: yoneticiler Auth binding + plaintext password presence (never logs values).
  --cleanup-admin-passwords   LIVE: FieldValue.delete() on yoneticiler/{id}.password only (eligible ADMIN_BINDING_OK).
                              Requires --project=yurtyonetimsistemi + project confirmation. Never run this in S5.4-A.
  --cleanup-graduate-password LIVE: FieldValue.delete() on ayarlar/mezun_giris.password only.
                              Requires --project=yurtyonetimsistemi + project confirmation. Guards required.
  --rotate-graduate-password  LIVE: Admin SDK updateUser password for mezun.portal only (interactive, hidden).
                              Never writes Firestore. Requires --project=yurtyonetimsistemi + confirmation.
  --check-student-passwords   READ-ONLY: inventory ogrenciler.password + cleanup eligibility.
  --cleanup-student-passwords LIVE: FieldValue.delete() on ogrenciler.password only (eligible rows).
                              Requires --project=yurtyonetimsistemi. Never run with other write modes.
  --check-attendance-roster   READ-ONLY: compare ogrenciler ↔ yoklama_roster.
  --sync-attendance-roster    LIVE: create/update minimal yoklama_roster docs (no extra deletes).
                              Requires --project=yurtyonetimsistemi.
  --check-leave-owner         READ-ONLY: classify evciTalepleri ownerUid backfill readiness.
  --backfill-leave-owner      LIVE: set ownerUid on evciTalepleri for OWNER_SAFE_TO_BACKFILL only.
                              Requires --project=yurtyonetimsistemi.
  --check-audit-timestamps    READ-ONLY: classify islem_loglari.timestamp types (ISO vs Timestamp).
  --normalize-audit-timestamps LIVE: convert eligible ISO strings to Firestore Timestamp only.
                              Requires --project=yurtyonetimsistemi + project confirmation.
  --self-test                 Run local helper tests (no Firebase)
  --help                      Show this help

Environment:
  GOOGLE_APPLICATION_CREDENTIALS   Path to service account JSON (never commit)

Safety:
  - Default mode never writes.
  - Temporary passwords go only to migration-credentials.local.json (gitignored).
  - Manifest never contains passwords (Auth temp or legacy plaintext).
  - Legacy password fields are only removed via --cleanup-student-passwords (explicit).
  - --apply-owner-uid writes ONLY ogrenciler.ownerUid for safe missing candidates.
  - --provision-student creates Auth+profile+ownerUid with rollback on partial failure.
  - --sync-attendance-roster writes ONLY yoklama_roster minimal fields.
  - --check-leave-owner reads evciTalepleri + ogrenciler + users; never writes.
  - --backfill-leave-owner writes ONLY evciTalepleri.ownerUid for safe rows.
  - --check-audit-timestamps reads islem_loglari; never writes; never logs detay/names.
  - --normalize-audit-timestamps writes ONLY islem_loglari/{id}.timestamp for LEGACY_ISO rows.
  - --cleanup-graduate-password deletes ONLY ayarlar/mezun_giris.password.
  - --rotate-graduate-password updates ONLY mezun.portal Auth password; never writes Firestore or logs plaintext.
  - --check-admin-auth reads yoneticiler + Auth + users; never writes; never logs password values.
  - --cleanup-admin-passwords deletes ONLY yoneticiler/{id}.password for eligible bound admins.
  - Only one exclusive operation mode per run.
`)
}

function parseArgs(argv) {
  const opts = {
    project: null,
    collection: null,
    limit: null,
    apply: false,
    applyOwnerUid: false,
    provisionStudentId: null,
    checkGraduateAuth: false,
    checkAdminAuth: false,
    cleanupAdminPasswords: false,
    cleanupGraduatePassword: false,
    rotateGraduatePassword: false,
    checkStudentPasswords: false,
    cleanupStudentPasswords: false,
    checkAttendanceRoster: false,
    syncAttendanceRoster: false,
    checkLeaveOwner: false,
    backfillLeaveOwner: false,
    checkAuditTimestamps: false,
    normalizeAuditTimestamps: false,
    selfTest: false,
    help: false,
  }

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg === '--apply') opts.apply = true
    else if (arg === '--apply-owner-uid') opts.applyOwnerUid = true
    else if (arg === '--check-graduate-auth' || arg === '--check-graduate-profile') {
      opts.checkGraduateAuth = true
    }
    else if (arg === '--check-admin-auth') opts.checkAdminAuth = true
    else if (arg === '--cleanup-admin-passwords') opts.cleanupAdminPasswords = true
    else if (arg === '--cleanup-graduate-password') opts.cleanupGraduatePassword = true
    else if (arg === '--rotate-graduate-password') opts.rotateGraduatePassword = true
    else if (arg === '--check-student-passwords') opts.checkStudentPasswords = true
    else if (arg === '--cleanup-student-passwords') opts.cleanupStudentPasswords = true
    else if (arg === '--check-attendance-roster') opts.checkAttendanceRoster = true
    else if (arg === '--sync-attendance-roster') opts.syncAttendanceRoster = true
    else if (arg === '--check-leave-owner') opts.checkLeaveOwner = true
    else if (arg === '--backfill-leave-owner') opts.backfillLeaveOwner = true
    else if (arg === '--check-audit-timestamps') opts.checkAuditTimestamps = true
    else if (arg === '--normalize-audit-timestamps') opts.normalizeAuditTimestamps = true
    else if (arg === '--self-test') opts.selfTest = true
    else if (arg.startsWith('--provision-student=')) {
      opts.provisionStudentId = arg.slice('--provision-student='.length).trim()
    } else if (arg.startsWith('--project=')) opts.project = arg.slice('--project='.length).trim()
    else if (arg.startsWith('--collection=')) {
      opts.collection = arg.slice('--collection='.length).trim()
    } else if (arg.startsWith('--limit=')) {
      const n = Number(arg.slice('--limit='.length))
      opts.limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : null
    } else if (arg.startsWith('--password') || arg.startsWith('--new-password')) {
      throw new Error('Password must not be passed on the command line. Use interactive hidden prompt.')
    } else if (arg.trim()) {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return opts
}

function loadAdmin() {
  if (!existsSync(FUNCTIONS_PKG)) {
    throw new Error(
      'functions/package.json not found. Install functions deps: npm ci --prefix functions',
    )
  }
  const require = createRequire(FUNCTIONS_PKG)
  try {
    return require('firebase-admin')
  } catch {
    throw new Error(
      'firebase-admin not found. Run: npm ci --prefix functions',
    )
  }
}

function assertCredentialsHint() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_CONFIG) {
    // ADC may still work via gcloud; we only warn until initialize fails.
    console.warn(
      '[migrate:auth] GOOGLE_APPLICATION_CREDENTIALS is not set. Will try Application Default Credentials.',
    )
  }
}

function safeRef(collection, docId, username) {
  const basis = `${collection}/${docId}:${username || ''}`
  return createHash('sha256').update(basis).digest('hex').slice(0, 12)
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

function expectedRole(collection) {
  return collection === 'yoneticiler' ? 'admin' : 'student'
}

function generateTemporaryPassword() {
  // 32 bytes → base64url (~43 chars), high entropy; never log.
  return randomBytes(32).toString('base64url')
}

function runSelfTest() {
  const cases = [
    ['Ali', 'ali@gayevakfi.portal'],
    ['mezun.portal', 'mezun.portal@gayevakfi.portal'],
    ['  Test_User ', 'test_user@gayevakfi.portal'],
  ]
  for (const [input, expected] of cases) {
    const got = toAuthEmail(input)
    if (got !== expected) {
      throw new Error(`self-test toAuthEmail failed: ${input} → ${got} (expected ${expected})`)
    }
  }
  if (!isReservedUsername('mezun.portal')) {
    throw new Error('self-test reserved failed')
  }
  if (isReservedUsername('normal.user')) {
    throw new Error('self-test reserved false positive')
  }
  // Collision helper: different raw usernames, same email local-part after strip
  const a = tryToAuthEmail('ali!')
  const b = tryToAuthEmail('ali')
  if (!a.ok || !b.ok || a.email !== b.email) {
    throw new Error('self-test canonical collision vector failed')
  }
  const pwd = generateTemporaryPassword()
  try {
    parseArgs(['--password=SHOULD_NOT_APPEAR'])
    throw new Error('self-test must reject CLI password flags')
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('SHOULD_NOT_APPEAR')) {
      throw new Error('self-test leaked CLI password into error')
    }
    if (!msg.includes('command line')) {
      throw new Error(`self-test CLI password rejection failed: ${msg}`)
    }
  }

  // Ownership / permission helpers (S4.1)
  if (asAttendanceFlag(true) !== true || asAttendanceFlag('yes') !== false) {
    throw new Error('self-test attendance flag failed')
  }
  if (classifyOwnerUid('', 'uid1', true) !== 'OWNER_MISSING') {
    throw new Error('self-test OWNER_MISSING failed')
  }
  if (classifyOwnerUid('uid1', 'uid1', true) !== 'OWNER_OK') {
    throw new Error('self-test OWNER_OK failed')
  }
  if (classifyOwnerUid('uid2', 'uid1', true) !== 'OWNER_MISMATCH') {
    throw new Error('self-test OWNER_MISMATCH failed')
  }
  if (classifyOwnerUid('', 'uid1', false) !== 'OWNER_AMBIGUOUS') {
    throw new Error('self-test OWNER_AMBIGUOUS failed')
  }
  if (classifyPermission(true, false) !== 'PERMISSION_MISMATCH') {
    throw new Error('self-test PERMISSION_MISMATCH failed')
  }
  if (classifyPermission(undefined, false) !== 'PERMISSION_OK') {
    throw new Error('self-test PERMISSION_OK failed')
  }

  const eligible = {
    legacyCollection: 'ogrenciler',
    safeOwnerBackfillCandidate: true,
    ownerStatus: 'OWNER_MISSING',
    expectedOwnerUid: 'uid-abc',
  }
  if (!isEligibleOwnerBackfill(eligible)) {
    throw new Error('self-test eligible owner backfill failed')
  }
  if (
    isEligibleOwnerBackfill({ ...eligible, ownerStatus: 'OWNER_MISMATCH' }) ||
    isEligibleOwnerBackfill({ ...eligible, ownerStatus: 'OWNER_AMBIGUOUS' }) ||
    isEligibleOwnerBackfill({ ...eligible, ownerStatus: 'OWNER_OK' }) ||
    isEligibleOwnerBackfill({ ...eligible, expectedOwnerUid: null })
  ) {
    throw new Error('self-test owner backfill refusal failed')
  }

  // S4.3.1 — provision existing-Auth strict match
  const fullProfile = {
    role: 'student',
    legacyCollection: 'ogrenciler',
    legacyDocId: 'stu1',
    username: 'ali',
    canManageAttendance: true,
  }
  if (classifyProvisionExistingAuth(null, 'stu1', 'ali').kind !== 'manual_review') {
    throw new Error('self-test provision null profile must MANUAL_REVIEW')
  }
  if (
    classifyProvisionExistingAuth(
      { ...fullProfile, role: 'admin' },
      'stu1',
      'ali',
    ).kind !== 'manual_review'
  ) {
    throw new Error('self-test provision role mismatch must MANUAL_REVIEW')
  }
  if (
    classifyProvisionExistingAuth(
      { ...fullProfile, legacyDocId: 'other' },
      'stu1',
      'ali',
    ).kind !== 'manual_review'
  ) {
    throw new Error('self-test provision legacyDocId mismatch must MANUAL_REVIEW')
  }
  if (
    classifyProvisionExistingAuth(
      { role: 'student', legacyCollection: 'ogrenciler' },
      'stu1',
      'ali',
    ).kind !== 'manual_review'
  ) {
    throw new Error('self-test provision partial profile must MANUAL_REVIEW')
  }
  if (classifyProvisionExistingAuth(fullProfile, 'stu1', 'ali').kind !== 'fully_bound') {
    throw new Error('self-test provision full match must fully_bound')
  }

  // Migration SAFE_EXISTING may still classify soft matches — provision must not.
  const soft = classifyProfileMatch(
    { role: 'student', legacyCollection: 'ogrenciler', legacyDocId: 'stu1' },
    'ogrenciler',
    'stu1',
    'ali',
    'student',
  )
  if (soft.kind === 'exact' || soft.kind === 'safe') {
    // ok if dry-run allows soft; provision path must still reject
  }
  if (
    classifyProvisionExistingAuth(
      { role: 'student', legacyCollection: 'ogrenciler', legacyDocId: 'stu1' },
      'stu1',
      'ali',
    ).kind !== 'manual_review'
  ) {
    throw new Error('self-test provision rejects profile missing username')
  }

  if (
    shouldDeleteAuthOnProvisionFailure({
      createdAuthUserThisRun: true,
      phase: PROVISION_PHASE.AUTH_CREATED,
    }) !== true
  ) {
    throw new Error('self-test rollback only for created-this-run pre-commit')
  }
  if (
    shouldDeleteAuthOnProvisionFailure({
      createdAuthUserThisRun: false,
      phase: PROVISION_PHASE.AUTH_CREATED,
    }) !== false
  ) {
    throw new Error('self-test must never delete existing Auth')
  }
  if (
    shouldDeleteAuthOnProvisionFailure({
      createdAuthUserThisRun: true,
      phase: PROVISION_PHASE.FIRESTORE_COMMITTED,
    }) !== false
  ) {
    throw new Error('self-test must not delete Auth after Firestore commit')
  }

  // A) PENDING write fail → newly-created Auth rollback expected
  {
    const sim = simulateProvisionFailurePath({
      failAt: 'pending',
      createdAuthUserThisRun: true,
      rollbackSucceeds: true,
    })
    if (!sim.actions.includes('auth_delete_attempt') || sim.code !== 'PROVISION_FAILED') {
      throw new Error('self-test A: PENDING fail must rollback newly-created Auth')
    }
  }

  // B) PENDING fail + Auth rollback fail → MANUAL_RECOVERY
  {
    const sim = simulateProvisionFailurePath({
      failAt: 'pending',
      createdAuthUserThisRun: true,
      rollbackSucceeds: false,
    })
    if (sim.code !== 'MANUAL_RECOVERY') {
      throw new Error('self-test B: PENDING fail + rollback fail → MANUAL_RECOVERY')
    }
  }

  // C) Existing Auth + credential-path fail → never delete
  {
    const sim = simulateProvisionFailurePath({
      failAt: 'pending',
      createdAuthUserThisRun: false,
      rollbackSucceeds: true,
    })
    if (sim.actions.includes('auth_delete_attempt') || sim.code !== 'NO_AUTH_DELETE') {
      throw new Error('self-test C: existing Auth must never be deleted')
    }
  }

  // D) Firestore commit fail → rollback newly-created Auth
  {
    const sim = simulateProvisionFailurePath({
      failAt: 'firestore',
      createdAuthUserThisRun: true,
      rollbackSucceeds: true,
    })
    if (
      sim.phase !== PROVISION_PHASE.CREDENTIAL_PENDING_SAVED ||
      !sim.actions.includes('auth_delete_attempt') ||
      sim.code !== 'PROVISION_FAILED'
    ) {
      throw new Error('self-test D: Firestore fail must rollback newly-created Auth')
    }
  }

  // E) READY write fail after Firestore → no Auth delete, credential recovery
  {
    const sim = simulateProvisionFailurePath({
      failAt: 'ready',
      createdAuthUserThisRun: true,
      rollbackSucceeds: true,
    })
    if (
      sim.actions.includes('auth_delete_attempt') ||
      sim.code !== 'CREDENTIAL_RECOVERY_REQUIRED'
    ) {
      throw new Error('self-test E: READY fail must not delete Auth')
    }
  }

  // F) Full success → READY
  {
    const sim = simulateProvisionFailurePath({
      failAt: null,
      createdAuthUserThisRun: true,
    })
    if (sim.phase !== PROVISION_PHASE.CREDENTIAL_READY_SAVED || sim.code !== 'CREATED') {
      throw new Error('self-test F: full success must reach CREDENTIAL_READY_SAVED')
    }
  }

  if (
    resolveProvisionAttendance({
      isNewAuthUser: false,
      rosterAttendance: true,
      usersAttendance: false,
    }) !== false
  ) {
    throw new Error('self-test users attendance is canonical for existing Auth')
  }
  if (
    resolveProvisionAttendance({
      isNewAuthUser: true,
      rosterAttendance: true,
      usersAttendance: false,
    }) !== true
  ) {
    throw new Error('self-test new Auth may take roster attendance')
  }

  if (countLiveWriteModes({ apply: true, applyOwnerUid: true }) !== 2) {
    throw new Error('self-test multi write mode count failed')
  }
  if (
    countLiveWriteModes({
      apply: false,
      applyOwnerUid: false,
      provisionStudentId: 'x',
    }) !== 1
  ) {
    throw new Error('self-test single write mode count failed')
  }
  if (rejectLiveWriteModeFlags({ apply: true }) !== 'generic_apply_disabled') {
    throw new Error('self-test generic --apply must be disabled')
  }
  if (
    rejectLiveWriteModeFlags({
      apply: false,
      applyOwnerUid: true,
      provisionStudentId: 'x',
    }) !== 'multiple_write_modes'
  ) {
    throw new Error('self-test multi write mode rejection failed')
  }
  if (
    rejectLiveWriteModeFlags({
      apply: false,
      applyOwnerUid: true,
      provisionStudentId: null,
    }) !== null
  ) {
    throw new Error('self-test apply-owner-uid alone must be allowed')
  }

  // S5-P1 — password cleanup eligibility (never expose password values)
  {
    const boundProfile = {
      role: 'student',
      legacyCollection: 'ogrenciler',
      legacyDocId: 'stu1',
      username: 'ali',
    }
    const safe = classifyPasswordCleanupEligibility({
      studentDocId: 'stu1',
      studentData: { username: 'ali', ownerUid: 'uid1', password: 'SECRET_SHOULD_NOT_LEAK' },
      usersProfile: boundProfile,
    })
    if (safe.status !== 'PASSWORD_PRESENT_SAFE_TO_CLEAN' || !safe.eligible) {
      throw new Error('self-test password safe-to-clean failed')
    }
    if (JSON.stringify(safe).includes('SECRET_SHOULD_NOT_LEAK')) {
      throw new Error('self-test password secrecy leaked value into classification')
    }

    const absent = classifyPasswordCleanupEligibility({
      studentDocId: 'stu1',
      studentData: { username: 'ali', ownerUid: 'uid1' },
      usersProfile: boundProfile,
    })
    if (absent.status !== 'PASSWORD_ALREADY_ABSENT') {
      throw new Error('self-test password already absent failed')
    }

    const noOwner = classifyPasswordCleanupEligibility({
      studentDocId: 'stu1',
      studentData: { username: 'ali', password: 'x' },
      usersProfile: boundProfile,
    })
    if (noOwner.status !== 'PASSWORD_MANUAL_REVIEW' || noOwner.eligible) {
      throw new Error('self-test password missing owner must MANUAL_REVIEW')
    }

    const mismatch = classifyPasswordCleanupEligibility({
      studentDocId: 'stu1',
      studentData: { username: 'ali', ownerUid: 'uid1', password: 'x' },
      usersProfile: { ...boundProfile, legacyDocId: 'other' },
    })
    if (mismatch.status !== 'PASSWORD_MANUAL_REVIEW') {
      throw new Error('self-test password binding mismatch must MANUAL_REVIEW')
    }
  }

  if (
    classifyGraduateAuthCheck({ authExists: false, profile: null }).authStatus !==
    GRADUATE_AUTH_STATUS.MISSING
  ) {
    throw new Error('self-test graduate auth missing failed')
  }
  if (
    classifyGraduateAuthCheck({
      authExists: true,
      authDisabled: true,
      profile: { role: 'graduate' },
    }).authStatus !== GRADUATE_AUTH_STATUS.DISABLED
  ) {
    throw new Error('self-test graduate auth disabled failed')
  }
  if (
    classifyGraduateAuthCheck({
      authExists: true,
      profile: null,
    }).authStatus !== GRADUATE_AUTH_STATUS.PROFILE_INVALID
  ) {
    throw new Error('self-test graduate profile missing failed')
  }
  if (
    classifyGraduateAuthCheck({
      authExists: true,
      profile: { role: 'student' },
    }).authStatus !== GRADUATE_AUTH_STATUS.PROFILE_INVALID
  ) {
    throw new Error('self-test graduate role mismatch failed')
  }
  {
    const ok = classifyGraduateAuthCheck({
      authExists: true,
      authDisabled: false,
      profile: { role: 'graduate' },
      loginDoc: { welcomeTitle: 'x', password: 'SECRET_SHOULD_NOT_LEAK' },
    })
    if (ok.authStatus !== GRADUATE_AUTH_STATUS.OK) {
      throw new Error('self-test graduate auth ok failed')
    }
    if (ok.passwordStatus !== GRADUATE_PASSWORD_STATUS.PRESENT) {
      throw new Error('self-test graduate plaintext password present failed')
    }
    if (JSON.stringify(ok).includes('SECRET_SHOULD_NOT_LEAK')) {
      throw new Error('self-test graduate auth check leaked password value')
    }
  }
  if (
    classifyGraduateAuthCheck({
      authExists: true,
      profile: { role: 'graduate' },
      loginDoc: { welcomeTitle: 'x' },
    }).passwordStatus !== GRADUATE_PASSWORD_STATUS.ABSENT
  ) {
    throw new Error('self-test graduate plaintext password absent failed')
  }

  if (
    classifyGraduatePasswordCleanup({
      authStatus: GRADUATE_AUTH_STATUS.OK,
      clientAuthOnlyReady: false,
      passwordPresent: true,
    }).allowed
  ) {
    throw new Error('self-test cleanup must block when client not ready')
  }
  if (
    classifyGraduatePasswordCleanup({
      authStatus: GRADUATE_AUTH_STATUS.MISSING,
      clientAuthOnlyReady: true,
      passwordPresent: true,
    }).allowed
  ) {
    throw new Error('self-test cleanup must block when auth missing')
  }
  if (
    classifyGraduatePasswordCleanup({
      authStatus: GRADUATE_AUTH_STATUS.DISABLED,
      clientAuthOnlyReady: true,
      passwordPresent: true,
    }).allowed
  ) {
    throw new Error('self-test cleanup must block when auth disabled')
  }
  if (
    classifyGraduatePasswordCleanup({
      authStatus: GRADUATE_AUTH_STATUS.PROFILE_INVALID,
      clientAuthOnlyReady: true,
      passwordPresent: true,
    }).allowed
  ) {
    throw new Error('self-test cleanup must block when profile invalid')
  }
  if (
    classifyGraduatePasswordCleanup({
      authStatus: GRADUATE_AUTH_STATUS.OK,
      clientAuthOnlyReady: true,
      passwordPresent: false,
    }).allowed
  ) {
    throw new Error('self-test cleanup must block when password already absent')
  }
  if (
    !classifyGraduatePasswordCleanup({
      authStatus: GRADUATE_AUTH_STATUS.OK,
      clientAuthOnlyReady: true,
      passwordPresent: true,
    }).allowed
  ) {
    throw new Error('self-test cleanup should allow when guards pass')
  }

  {
    const sentinel = Symbol('FieldValue.delete')
    const update = buildGraduateLoginPasswordDeleteUpdate(sentinel)
    if (!isPasswordOnlyDeleteUpdate(update) || update.password !== sentinel) {
      throw new Error('self-test cleanup payload must delete only password')
    }
  }

  {
    const expectedEmail = toAuthEmail(GRADUATE_AUTH_USERNAME)
    if (
      classifyGraduatePasswordRotation({
        authExists: true,
        authEmail: expectedEmail,
        expectedEmail,
        authUid: 'uid-g',
        resolvedUid: 'uid-g',
        profileRole: 'graduate',
        newPasswordLength: 12,
        confirmMatches: true,
        writesFirestore: true,
      }).allowed
    ) {
      throw new Error('self-test rotation must never allow Firestore writes')
    }
    if (
      classifyGraduatePasswordRotation({
        authExists: true,
        authEmail: expectedEmail,
        expectedEmail,
        authUid: 'uid-g',
        resolvedUid: 'other-uid',
        profileRole: 'graduate',
        newPasswordLength: 12,
        confirmMatches: true,
      }).status !== GRADUATE_ROTATION_STATUS.TARGET_MISMATCH
    ) {
      throw new Error('self-test rotation must reject other Auth users')
    }
    if (
      classifyGraduatePasswordRotation({
        authExists: true,
        authEmail: expectedEmail,
        expectedEmail,
        authUid: 'uid-g',
        resolvedUid: 'uid-g',
        profileRole: 'graduate',
        newPasswordLength: 12,
        confirmMatches: false,
      }).allowed
    ) {
      throw new Error('self-test rotation confirm mismatch failed')
    }
    if (
      classifyGraduatePasswordRotation({
        authExists: true,
        authEmail: expectedEmail,
        expectedEmail,
        authUid: 'uid-g',
        resolvedUid: 'uid-g',
        profileRole: 'graduate',
        newPasswordLength: 4,
        confirmMatches: true,
      }).status !== GRADUATE_ROTATION_STATUS.PASSWORD_TOO_SHORT
    ) {
      throw new Error('self-test rotation short password failed')
    }
    const ready = classifyGraduatePasswordRotation({
      authExists: true,
      authEmail: expectedEmail,
      expectedEmail,
      authUid: 'uid-g',
      resolvedUid: 'uid-g',
      profileRole: 'graduate',
      newPasswordLength: 12,
      confirmMatches: true,
      writesFirestore: false,
    })
    if (!ready.allowed || ready.status !== GRADUATE_ROTATION_STATUS.READY) {
      throw new Error('self-test rotation ready failed')
    }
  }

  if (GRADUATE_LOGIN_MODE !== 'auth-only') {
    throw new Error('self-test graduate login mode must be auth-only')
  }
  {
    const clientReady = assessGraduateClientAuthOnlyReady(readGraduateClientSources())
    if (!clientReady.ready) {
      throw new Error(`self-test client auth-only not ready: ${clientReady.failures.join(',')}`)
    }
  }
  if (GRADUATE_MIN_PASSWORD_LENGTH < 6) {
    throw new Error('self-test graduate min password length failed')
  }

  assertNoPasswordInReport({
    authStatus: GRADUATE_AUTH_STATUS.OK,
    passwordStatus: GRADUATE_PASSWORD_STATUS.PRESENT,
  })

  if (
    rejectLiveWriteModeFlags({
      cleanupStudentPasswords: true,
      applyOwnerUid: true,
    }) !== 'multiple_write_modes'
  ) {
    throw new Error('self-test cleanup vs apply-owner-uid conflict failed')
  }
  if (
    rejectLiveWriteModeFlags({
      cleanupStudentPasswords: true,
      checkStudentPasswords: true,
    }) !== 'multiple_write_modes'
  ) {
    throw new Error('self-test cleanup vs check-passwords conflict failed')
  }
  if (
    rejectLiveWriteModeFlags({
      checkGraduateAuth: true,
      checkStudentPasswords: true,
    }) !== 'multiple_write_modes'
  ) {
    throw new Error('self-test dual check modes conflict failed')
  }
  if (
    rejectLiveWriteModeFlags({
      cleanupGraduatePassword: true,
      rotateGraduatePassword: true,
    }) !== 'multiple_write_modes'
  ) {
    throw new Error('self-test graduate cleanup vs rotate conflict failed')
  }
  if (
    rejectLiveWriteModeFlags({
      cleanupGraduatePassword: true,
      checkGraduateAuth: true,
    }) !== 'multiple_write_modes'
  ) {
    throw new Error('self-test graduate cleanup vs check conflict failed')
  }
  if (
    rejectLiveWriteModeFlags({
      checkAdminAuth: true,
      checkGraduateAuth: true,
    }) !== 'multiple_write_modes'
  ) {
    throw new Error('self-test admin vs graduate check conflict failed')
  }
  if (
    rejectLiveWriteModeFlags({
      cleanupAdminPasswords: true,
      checkAdminAuth: true,
    }) !== 'multiple_write_modes'
  ) {
    throw new Error('self-test admin cleanup vs check conflict failed')
  }
  if (
    rejectLiveWriteModeFlags({
      cleanupAdminPasswords: true,
      applyOwnerUid: true,
    }) !== 'multiple_write_modes'
  ) {
    throw new Error('self-test admin cleanup vs apply-owner conflict failed')
  }

  {
    const okProfile = {
      role: 'admin',
      legacyCollection: 'yoneticiler',
      legacyDocId: 'adm-1',
      username: 'yonetici',
    }
    const secretDoc = { username: 'yonetici', password: 'SECRET_ADMIN_SHOULD_NOT_LEAK' }
    const dupIndex = buildAdminCollisionIndex([
      { username: 'yonetici' },
      { username: 'Yonetici' },
    ])
    const dupFlags = adminCollisionFlags('yonetici', dupIndex)
    if (!dupFlags.duplicateUsername) {
      throw new Error('self-test admin duplicate username failed')
    }
    const dup = classifyAdminBinding({
      legacyDocId: 'adm-1',
      username: 'yonetici',
      passwordPresent: hasAdminPlaintextPasswordField(secretDoc),
      duplicateUsername: true,
      authExists: true,
      profile: okProfile,
    })
    if (dup.bindingStatus !== ADMIN_BINDING_STATUS.DUPLICATE_USERNAME || !dup.manualReviewRequired) {
      throw new Error('self-test admin duplicate must not auto-match')
    }
    if (JSON.stringify(dup).includes('SECRET_ADMIN_SHOULD_NOT_LEAK')) {
      throw new Error('self-test admin classifier leaked password value')
    }

    const collisionIndex = buildAdminCollisionIndex([
      { username: 'ali' },
      { username: 'ali!' },
    ])
    const collisionFlags = adminCollisionFlags('ali', collisionIndex)
    if (!collisionFlags.emailCollision || collisionFlags.duplicateUsername) {
      throw new Error('self-test admin email collision flags failed')
    }
    const collided = classifyAdminBinding({
      legacyDocId: 'adm-a',
      username: 'ali',
      emailCollision: true,
      authExists: true,
      profile: { ...okProfile, username: 'ali', legacyDocId: 'adm-a' },
    })
    if (
      collided.bindingStatus !== ADMIN_BINDING_STATUS.DUPLICATE_USERNAME ||
      collided.reason !== 'canonical_email_collision'
    ) {
      throw new Error('self-test admin email collision must MANUAL_REVIEW / no auto-match')
    }

    const mismatch = classifyAdminBinding({
      legacyDocId: 'adm-1',
      username: 'yonetici',
      authExists: true,
      profile: { ...okProfile, role: 'student' },
    })
    if (mismatch.bindingStatus !== ADMIN_BINDING_STATUS.PROFILE_MISMATCH) {
      throw new Error('self-test admin profile mismatch failed')
    }

    const disabled = classifyAdminBinding({
      legacyDocId: 'adm-1',
      username: 'yonetici',
      authExists: true,
      authDisabled: true,
      profile: okProfile,
    })
    if (disabled.bindingStatus !== ADMIN_BINDING_STATUS.AUTH_DISABLED) {
      throw new Error('self-test admin disabled failed')
    }

    const bound = classifyAdminBinding({
      legacyDocId: 'adm-1',
      username: 'yonetici',
      passwordPresent: true,
      authExists: true,
      profile: okProfile,
    })
    if (bound.bindingStatus !== ADMIN_BINDING_STATUS.OK || bound.manualReviewRequired) {
      throw new Error('self-test admin binding ok failed')
    }
    if (bound.passwordStatus !== ADMIN_PASSWORD_STATUS.PRESENT) {
      throw new Error('self-test admin password present failed')
    }

    if (
      classifyAdminPasswordCleanup({
        bindingStatus: ADMIN_BINDING_STATUS.OK,
        passwordPresent: true,
        manualReviewRequired: false,
      }).allowed !== true
    ) {
      throw new Error('self-test admin cleanup eligible failed')
    }
    if (
      classifyAdminPasswordCleanup({
        bindingStatus: ADMIN_BINDING_STATUS.OK,
        authDisabled: true,
        passwordPresent: true,
      }).allowed
    ) {
      throw new Error('self-test admin cleanup must block disabled')
    }
    if (
      classifyAdminPasswordCleanup({
        bindingStatus: ADMIN_BINDING_STATUS.PROFILE_MISMATCH,
        passwordPresent: true,
      }).allowed
    ) {
      throw new Error('self-test admin cleanup must block mismatch')
    }

    const deletePayload = buildAdminPasswordDeleteUpdate({ _delete: true })
    if (!isPasswordOnlyDeleteUpdate(deletePayload)) {
      throw new Error('self-test admin cleanup payload must be password-only delete')
    }
    assertNoPasswordValueInAdminPayload({
      bindingStatus: bound.bindingStatus,
      passwordStatus: bound.passwordStatus,
      passwordPresent: true,
    })
  }

  if (!isLiveWriteProjectAllowed('yurtyonetimsistemi')) {
    throw new Error('self-test production project must be allowed for live writes')
  }
  if (isLiveWriteProjectAllowed('other-project')) {
    throw new Error('self-test wrong project must be denied for live writes')
  }

  // P2.3 — attendance roster builder allowlist
  {
    const entry = buildAttendanceRosterEntry('stu1', {
      adSoyad: 'Ali Veli',
      odaNo: 3,
      password: 'secret',
      username: 'ali',
      ownerUid: 'uid',
      canManageAttendance: true,
      akademikNotlar: { x: [] },
      photoUrl: 'http://x',
      role: 'student',
      legacyCollection: 'ogrenciler',
      legacyDocId: 'stu1',
      bolum: 'Hukuk',
    })
    if (!entry || entry.studentId !== 'stu1' || entry.adSoyad !== 'Ali Veli' || entry.odaNo !== 3) {
      throw new Error('self-test roster builder fields failed')
    }
    if (!assertRosterEntryAllowlist(entry)) {
      throw new Error('self-test roster allowlist failed')
    }
    for (const key of ROSTER_FORBIDDEN_KEYS) {
      if (Object.prototype.hasOwnProperty.call(entry, key)) {
        throw new Error(`self-test roster leaked forbidden key: ${key}`)
      }
    }
    if (isEligibleAttendanceRosterSource('', { adSoyad: 'A', odaNo: 1 })) {
      throw new Error('self-test empty studentId must be ineligible')
    }
    if (isEligibleAttendanceRosterSource('stu1', { adSoyad: '  ', odaNo: 1 })) {
      throw new Error('self-test blank adSoyad must be ineligible')
    }
    if (classifyAttendanceRosterAgainstSource('stu1', { adSoyad: 'Ali', odaNo: 1 }, null) !== 'ROSTER_MISSING') {
      throw new Error('self-test ROSTER_MISSING failed')
    }
    if (
      classifyAttendanceRosterAgainstSource(
        'stu1',
        { adSoyad: 'Ali', odaNo: 1 },
        { studentId: 'stu1', adSoyad: 'Ali', odaNo: 1 },
      ) !== 'ROSTER_OK'
    ) {
      throw new Error('self-test ROSTER_OK failed')
    }
    if (
      classifyAttendanceRosterAgainstSource(
        'stu1',
        { adSoyad: 'Ali', odaNo: 1 },
        { studentId: 'stu1', adSoyad: 'Ali', odaNo: 2 },
      ) !== 'ROSTER_MISMATCH'
    ) {
      throw new Error('self-test ROSTER_MISMATCH failed')
    }
    if (
      classifyAttendanceRosterAgainstSource('stu1', { adSoyad: '', odaNo: 1 }, null) !==
      'ROSTER_INVALID_SOURCE'
    ) {
      throw new Error('self-test ROSTER_INVALID_SOURCE failed')
    }
  }

  if (
    rejectLiveWriteModeFlags({
      syncAttendanceRoster: true,
      applyOwnerUid: true,
    }) !== 'multiple_write_modes'
  ) {
    throw new Error('self-test sync-roster vs apply-owner conflict failed')
  }
  if (
    rejectLiveWriteModeFlags({
      syncAttendanceRoster: true,
      checkAttendanceRoster: true,
    }) !== 'multiple_write_modes'
  ) {
    throw new Error('self-test sync vs check roster conflict failed')
  }

  // S5.2-P1 — leave ownerUid classification
  {
    const usersByUid = new Map([
      [
        'uid-ali',
        {
          role: 'student',
          legacyCollection: 'ogrenciler',
          legacyDocId: 'stu-ali',
        },
      ],
      [
        'uid-wrong',
        {
          role: 'student',
          legacyCollection: 'ogrenciler',
          legacyDocId: 'other-doc',
        },
      ],
    ])

    const studentsByAdSoyad = buildStudentsByAdSoyadIndex([
      { id: 'stu-ali', data: { adSoyad: 'Ali Veli', ownerUid: 'uid-ali' } },
      { id: 'stu-dup-a', data: { adSoyad: 'Dup Name', ownerUid: 'uid-a' } },
      { id: 'stu-dup-b', data: { adSoyad: 'Dup Name', ownerUid: 'uid-b' } },
      { id: 'stu-nouid', data: { adSoyad: 'No Owner', odaNo: 1 } },
      {
        id: 'stu-bad-bind',
        data: { adSoyad: 'Bad Bind', ownerUid: 'uid-wrong' },
      },
    ])

    const safe = classifyLeaveOwnerRequest({
      leaveRequestId: 'leave-safe',
      leaveData: { ogrenciAd: 'Ali Veli', tarih: '2026-01-01' },
      studentsByAdSoyad,
      usersByUid,
    })
    if (safe.status !== LEAVE_OWNER_STATUS.OWNER_SAFE_TO_BACKFILL) {
      throw new Error(`self-test leave safe backfill failed: ${safe.status}`)
    }
    if (safe.expectedOwnerUid !== 'uid-ali' || safe.matchedStudentId !== 'stu-ali') {
      throw new Error('self-test leave safe expectedOwnerUid failed')
    }

    const ok = classifyLeaveOwnerRequest({
      leaveRequestId: 'leave-ok',
      leaveData: { ogrenciAd: 'Ali Veli', ownerUid: 'uid-ali', tarih: '2026-01-02' },
      studentsByAdSoyad,
      usersByUid,
    })
    if (ok.status !== LEAVE_OWNER_STATUS.OWNER_OK) {
      throw new Error(`self-test leave owner ok failed: ${ok.status}`)
    }

    const ambiguous = classifyLeaveOwnerRequest({
      leaveRequestId: 'leave-amb',
      leaveData: { ogrenciAd: 'Dup Name', tarih: '2026-01-03' },
      studentsByAdSoyad,
      usersByUid,
    })
    if (ambiguous.status !== LEAVE_OWNER_STATUS.OWNER_AMBIGUOUS) {
      throw new Error(`self-test leave ambiguous failed: ${ambiguous.status}`)
    }

    const notFound = classifyLeaveOwnerRequest({
      leaveRequestId: 'leave-miss',
      leaveData: { ogrenciAd: 'Unknown Person', tarih: '2026-01-04' },
      studentsByAdSoyad,
      usersByUid,
    })
    if (notFound.status !== LEAVE_OWNER_STATUS.OWNER_NOT_FOUND) {
      throw new Error(`self-test leave not found failed: ${notFound.status}`)
    }

    const invalid = classifyLeaveOwnerRequest({
      leaveRequestId: 'leave-invalid',
      leaveData: { ogrenciAd: 'No Owner', tarih: '2026-01-05' },
      studentsByAdSoyad,
      usersByUid,
    })
    if (invalid.status !== LEAVE_OWNER_STATUS.OWNER_IDENTITY_INVALID) {
      throw new Error(`self-test leave identity invalid failed: ${invalid.status}`)
    }

    const mismatch = classifyLeaveOwnerRequest({
      leaveRequestId: 'leave-mismatch',
      leaveData: {
        ogrenciAd: 'Ali Veli',
        ownerUid: 'someone-else',
        tarih: '2026-01-06',
      },
      studentsByAdSoyad,
      usersByUid,
    })
    if (mismatch.status !== LEAVE_OWNER_STATUS.OWNER_MISMATCH) {
      throw new Error(`self-test leave mismatch failed: ${mismatch.status}`)
    }

    const badBind = classifyLeaveOwnerRequest({
      leaveRequestId: 'leave-bad-bind',
      leaveData: { ogrenciAd: 'Bad Bind', tarih: '2026-01-07' },
      studentsByAdSoyad,
      usersByUid,
    })
    if (badBind.status !== LEAVE_OWNER_STATUS.OWNER_IDENTITY_INVALID) {
      throw new Error(`self-test leave bad binding failed: ${badBind.status}`)
    }

    const identity = verifyStudentOwnerIdentity(
      'stu-ali',
      { ownerUid: 'uid-ali' },
      usersByUid.get('uid-ali'),
    )
    if (!identity.valid || identity.expectedOwnerUid !== 'uid-ali') {
      throw new Error('self-test verifyStudentOwnerIdentity ok failed')
    }

    const manifestRow = toLeaveOwnerManifestRow(safe)
    if (
      manifestRow.leaveRequestId !== 'leave-safe' ||
      'sebep' in manifestRow ||
      'password' in manifestRow
    ) {
      throw new Error('self-test leave manifest row failed')
    }

    if (!LEAVE_OWNER_BACKFILL_ELIGIBLE.has(LEAVE_OWNER_STATUS.OWNER_SAFE_TO_BACKFILL)) {
      throw new Error('self-test leave backfill eligible set failed')
    }
    if (!isLeaveOwnerManualReview(LEAVE_OWNER_STATUS.OWNER_AMBIGUOUS)) {
      throw new Error('self-test leave manual review ambiguous failed')
    }
    if (isLeaveOwnerManualReview(LEAVE_OWNER_STATUS.OWNER_OK)) {
      throw new Error('self-test leave manual review ok must be false')
    }
  }

  {
    const isoZ = classifyAuditTimestamp({ timestamp: '2026-01-01T00:00:00.000Z' })
    if (isoZ.status !== AUDIT_TIMESTAMP_STATUS.LEGACY_ISO || isoZ.parsedIso !== true) {
      throw new Error('self-test valid ISO must be LEGACY_ISO')
    }
    const offset = parseLegacyIsoInstant('2026-08-18T21:00:00+03:00')
    if (!offset || offset.toISOString() !== '2026-08-18T18:00:00.000Z') {
      throw new Error('self-test timezone offset ISO must preserve instant')
    }
    const invalid = classifyAuditTimestamp({ timestamp: 'not-iso' })
    if (invalid.status !== AUDIT_TIMESTAMP_STATUS.INVALID || shouldNormalizeAuditTimestamp(invalid.status)) {
      throw new Error('self-test invalid string must be MANUAL_REVIEW / not normalized')
    }
    const alreadyOk = classifyAuditTimestamp({
      timestamp: {
        seconds: 1_700_000_000,
        nanoseconds: 0,
        toDate() {
          return new Date(1_700_000_000_000)
        },
      },
    })
    if (alreadyOk.status !== AUDIT_TIMESTAMP_STATUS.OK || shouldNormalizeAuditTimestamp(alreadyOk.status)) {
      throw new Error('self-test Timestamp already OK must be idempotent')
    }
    const missing = classifyAuditTimestamp({})
    if (missing.status !== AUDIT_TIMESTAMP_STATUS.MISSING || !isAuditTimestampManualReview(missing.status)) {
      throw new Error('self-test missing timestamp failed')
    }
    const update = buildAuditTimestampNormalizeUpdate({ seconds: 1, toDate() { return new Date(1000) } })
    if (!isTimestampOnlyUpdate(update)) {
      throw new Error('self-test timestamp update must be timestamp-only')
    }
    const row = toAuditTimestampManifestRow({
      docId: 'log-1',
      status: AUDIT_TIMESTAMP_STATUS.LEGACY_ISO,
      parsedIso: true,
    })
    if ('detay' in row || 'yapan' in row || 'timestamp' in row) {
      throw new Error('self-test audit manifest row leaked content')
    }
    assertNoSensitiveAuditFields(row)
    if (!AUDIT_TIMESTAMP_NORMALIZE_ELIGIBLE.has(AUDIT_TIMESTAMP_STATUS.LEGACY_ISO)) {
      throw new Error('self-test LEGACY_ISO must be normalize eligible')
    }
  }

  if (
    rejectLiveWriteModeFlags({
      backfillLeaveOwner: true,
      checkLeaveOwner: true,
    }) !== 'multiple_write_modes'
  ) {
    throw new Error('self-test backfill vs check leave owner conflict failed')
  }
  if (
    rejectLiveWriteModeFlags({
      backfillLeaveOwner: true,
      syncAttendanceRoster: true,
    }) !== 'multiple_write_modes'
  ) {
    throw new Error('self-test backfill leave vs sync roster conflict failed')
  }
  if (
    rejectLiveWriteModeFlags({
      normalizeAuditTimestamps: true,
      checkAuditTimestamps: true,
    }) !== 'multiple_write_modes'
  ) {
    throw new Error('self-test normalize vs check audit timestamps conflict failed')
  }
  if (
    rejectLiveWriteModeFlags({
      normalizeAuditTimestamps: true,
      applyOwnerUid: true,
    }) !== 'multiple_write_modes'
  ) {
    throw new Error('self-test normalize audit vs other write mode conflict failed')
  }
  if (
    rejectLiveWriteModeFlags({
      normalizeAuditTimestamps: true,
    }) !== null
  ) {
    throw new Error('self-test normalize audit timestamps alone must be allowed')
  }

  console.log('[self-test] OK (no secrets printed)')
}

/**
 * @param {Array<{collection: string, id: string, username: string, email: string|null, data: object}>} records
 */
function detectCollisions(records) {
  /** @type {Map<string, typeof records>} */
  const byUsernameExact = new Map()
  /** @type {Map<string, typeof records>} */
  const byEmail = new Map()

  for (const rec of records) {
    if (!rec.username) continue
    const uKey = `${rec.collection}::${rec.username}`
    if (!byUsernameExact.has(uKey)) byUsernameExact.set(uKey, [])
    byUsernameExact.get(uKey).push(rec)

    if (rec.email) {
      if (!byEmail.has(rec.email)) byEmail.set(rec.email, [])
      byEmail.get(rec.email).push(rec)
    }
  }

  /** @type {Set<string>} doc keys that collide */
  const collisionKeys = new Set()
  /** @type {string[]} */
  const notes = []

  for (const [uKey, group] of byUsernameExact) {
    if (group.length > 1) {
      for (const r of group) collisionKeys.add(`${r.collection}/${r.id}`)
      notes.push(`duplicate_username:${uKey}:count=${group.length}`)
    }
  }

  // Cross-collection same exact username
  /** @type {Map<string, Set<string>>} */
  const usernameCollections = new Map()
  for (const rec of records) {
    if (!rec.username) continue
    if (!usernameCollections.has(rec.username)) usernameCollections.set(rec.username, new Set())
    usernameCollections.get(rec.username).add(rec.collection)
  }
  for (const [username, cols] of usernameCollections) {
    if (cols.size > 1) {
      for (const rec of records) {
        if (rec.username === username) collisionKeys.add(`${rec.collection}/${rec.id}`)
      }
      notes.push(`cross_collection_username:${safeRef('x', 'x', username)}`)
    }
  }

  for (const [email, group] of byEmail) {
    if (group.length <= 1) continue
    const collections = new Set(group.map((g) => g.collection))
    const usernames = new Set(group.map((g) => g.username))
    const isCross = collections.size > 1
    const isCanonicalClash = usernames.size > 1
    if (isCross || isCanonicalClash || group.length > 1 && group.filter((g) => g.collection === group[0].collection).length > 1 && isCanonicalClash) {
      for (const r of group) collisionKeys.add(`${r.collection}/${r.id}`)
      notes.push(
        `email_collision:${createHash('sha256').update(email).digest('hex').slice(0, 12)}:n=${group.length}:cross=${isCross}:multiUser=${isCanonicalClash}`,
      )
    }
  }

  // Same-collection duplicate exact username already covered.
  // Same email from different usernames in same collection:
  for (const [, group] of byEmail) {
    if (group.length <= 1) continue
    const byCol = new Map()
    for (const r of group) {
      if (!byCol.has(r.collection)) byCol.set(r.collection, [])
      byCol.get(r.collection).push(r)
    }
    for (const [, colGroup] of byCol) {
      const names = new Set(colGroup.map((r) => r.username))
      if (names.size > 1) {
        for (const r of colGroup) collisionKeys.add(`${r.collection}/${r.id}`)
      }
    }
  }

  return { collisionKeys, notes }
}

function classifyProfileMatch(profile, collection, docId, username, role) {
  if (!profile) return { kind: 'missing' }

  const collectionOk = !profile.legacyCollection || profile.legacyCollection === collection
  const docOk = !profile.legacyDocId || profile.legacyDocId === docId
  const roleOk = !profile.role || profile.role === role
  const usernameOk = !profile.username || profile.username === username

  const fullyBound =
    profile.legacyCollection === collection &&
    profile.legacyDocId === docId &&
    profile.role === role &&
    profile.username === username

  if (fullyBound) return { kind: 'already' }

  if (collectionOk && docOk && roleOk && usernameOk) {
    return { kind: 'safe_existing' }
  }

  return { kind: 'conflict' }
}

/** App treats only strict === true as attendance permission. */
function asAttendanceFlag(value) {
  return value === true
}

/**
 * @param {unknown} currentOwnerUid
 * @param {string|null} expectedUid
 * @param {boolean} verifiedUnique
 */
function classifyOwnerUid(currentOwnerUid, expectedUid, verifiedUnique) {
  if (!verifiedUnique || !expectedUid) return 'OWNER_AMBIGUOUS'
  const current = typeof currentOwnerUid === 'string' ? currentOwnerUid.trim() : ''
  if (!current) return 'OWNER_MISSING'
  if (current === expectedUid) return 'OWNER_OK'
  return 'OWNER_MISMATCH'
}

function classifyPermission(legacyValue, usersValue) {
  return asAttendanceFlag(legacyValue) === asAttendanceFlag(usersValue)
    ? 'PERMISSION_OK'
    : 'PERMISSION_MISMATCH'
}

/**
 * Index student users by legacyDocId for uniqueness checks.
 * @param {FirebaseFirestore.Firestore} db
 */
async function loadStudentUsersByLegacyDocId(db) {
  const snap = await db.collection('users').where('role', '==', 'student').get()
  /** @type {Map<string, Array<{ uid: string, data: Record<string, unknown> }>>} */
  const byLegacyDocId = new Map()

  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {}
    if (data.legacyCollection && data.legacyCollection !== 'ogrenciler') continue
    const legacyDocId = typeof data.legacyDocId === 'string' ? data.legacyDocId : ''
    if (!legacyDocId) continue
    if (!byLegacyDocId.has(legacyDocId)) byLegacyDocId.set(legacyDocId, [])
    byLegacyDocId.get(legacyDocId).push({ uid: docSnap.id, data })
  }

  return byLegacyDocId
}

/**
 * Enrich a student migration result with ownerUid / attendance parity (read-only).
 * Verified binding requires exactly one users profile with:
 * role=student, legacyCollection=ogrenciler, legacyDocId=studentId
 * and auth-path uid agreement when present.
 */
function enrichStudentOwnershipParity(rec, result, byLegacyDocId) {
  if (rec.collection !== 'ogrenciler') return result

  const candidates = byLegacyDocId.get(rec.id) || []
  const fullyBoundCandidates = candidates.filter(
    (c) =>
      c.data.role === 'student' &&
      c.data.legacyCollection === 'ogrenciler' &&
      c.data.legacyDocId === rec.id,
  )

  const uniqueVerified = fullyBoundCandidates.length === 1
  const expectedOwnerUid = uniqueVerified ? fullyBoundCandidates[0].uid : null

  if (
    uniqueVerified &&
    result.uid &&
    result.uid !== expectedOwnerUid
  ) {
    return {
      ...result,
      expectedOwnerUid: null,
      ownerStatus: 'OWNER_AMBIGUOUS',
      permissionStatus: null,
      permissionDetail: null,
      safeOwnerBackfillCandidate: false,
    }
  }

  // Prefer auth-path fully migrated/safe statuses; otherwise still use legacyDocId index if unique.
  const identityTrusted =
    uniqueVerified &&
    (result.status === STATUS.ALREADY_MIGRATED ||
      result.status === STATUS.SAFE_EXISTING ||
      result.status === STATUS.APPLIED ||
      (result.uid && result.uid === expectedOwnerUid))

  if (!uniqueVerified || !identityTrusted) {
    return {
      ...result,
      expectedOwnerUid: null,
      ownerStatus: 'OWNER_AMBIGUOUS',
      permissionStatus: null,
      permissionDetail: null,
      safeOwnerBackfillCandidate: false,
    }
  }

  const profile = fullyBoundCandidates[0].data
  const ownerStatus = classifyOwnerUid(rec.data.ownerUid, expectedOwnerUid, true)
  const legacyAttendance = asAttendanceFlag(rec.data.canManageAttendance)
  const usersAttendance = asAttendanceFlag(profile.canManageAttendance)
  const permissionStatus = classifyPermission(legacyAttendance, usersAttendance)

  return {
    ...result,
    expectedOwnerUid,
    ownerStatus,
    permissionStatus,
    permissionDetail:
      permissionStatus === 'PERMISSION_MISMATCH'
        ? { legacy: legacyAttendance, users: usersAttendance }
        : null,
    safeOwnerBackfillCandidate: ownerStatus === 'OWNER_MISSING',
  }
}

/** Strict gate for --apply-owner-uid writes. */
function isEligibleOwnerBackfill(row) {
  return (
    row.legacyCollection === 'ogrenciler' &&
    row.safeOwnerBackfillCandidate === true &&
    row.ownerStatus === 'OWNER_MISSING' &&
    typeof row.expectedOwnerUid === 'string' &&
    row.expectedOwnerUid.trim().length > 0
  )
}

/**
 * Live ownerUid patch for safe candidates only.
 * Double-checks Firestore before update; never overwrites mismatch.
 * @param {FirebaseFirestore.Firestore} db
 * @param {object[]} candidates
 */
async function applyOwnerUidBackfill(db, candidates) {
  /** @type {object[]} */
  const outcomes = []

  for (const row of candidates) {
    if (!isEligibleOwnerBackfill(row)) {
      outcomes.push({
        ...row,
        ownerUidApplied: false,
        ownerApplyStatus: 'SKIPPED_NOT_ELIGIBLE',
        ownerUidPreviousState: null,
        resultingOwnerUid: null,
      })
      continue
    }

    const expectedOwnerUid = row.expectedOwnerUid.trim()
    const studentRef = db.collection('ogrenciler').doc(row.legacyDocId)

    try {
      const userSnap = await db.collection('users').doc(expectedOwnerUid).get()
      if (!userSnap.exists) {
        outcomes.push({
          ...row,
          ownerUidApplied: false,
          ownerApplyStatus: 'MANUAL_REVIEW',
          ownerUidPreviousState: null,
          resultingOwnerUid: null,
          safeOwnerBackfillCandidate: false,
          reasons: [...(row.reasons || []), 'owner_apply_user_missing'],
        })
        continue
      }

      const profile = userSnap.data() || {}
      if (
        profile.role !== 'student' ||
        profile.legacyCollection !== 'ogrenciler' ||
        profile.legacyDocId !== row.legacyDocId
      ) {
        outcomes.push({
          ...row,
          ownerUidApplied: false,
          ownerApplyStatus: 'MANUAL_REVIEW',
          ownerStatus: 'OWNER_AMBIGUOUS',
          ownerUidPreviousState: null,
          resultingOwnerUid: null,
          safeOwnerBackfillCandidate: false,
          reasons: [...(row.reasons || []), 'owner_apply_identity_changed'],
        })
        continue
      }

      const liveSnap = await studentRef.get()
      if (!liveSnap.exists) {
        outcomes.push({
          ...row,
          ownerUidApplied: false,
          ownerApplyStatus: 'ERROR',
          ownerUidPreviousState: null,
          resultingOwnerUid: null,
          reasons: [...(row.reasons || []), 'owner_apply_student_doc_missing'],
        })
        continue
      }

      const live = liveSnap.data() || {}
      const current =
        typeof live.ownerUid === 'string' ? live.ownerUid.trim() : ''

      if (current === expectedOwnerUid) {
        outcomes.push({
          ...row,
          ownerUidApplied: false,
          ownerApplyStatus: 'OWNER_ALREADY_OK',
          ownerStatus: 'OWNER_OK',
          ownerUidPreviousState: current,
          resultingOwnerUid: current,
          safeOwnerBackfillCandidate: false,
          ownerAppliedAt: new Date().toISOString(),
        })
        continue
      }

      if (current) {
        outcomes.push({
          ...row,
          ownerUidApplied: false,
          ownerApplyStatus: 'MANUAL_REVIEW',
          ownerStatus: 'OWNER_MISMATCH',
          ownerUidPreviousState: current,
          resultingOwnerUid: current,
          safeOwnerBackfillCandidate: false,
          reasons: [...(row.reasons || []), 'owner_apply_abort_mismatch'],
        })
        continue
      }

      // Field-only patch — never overwrite the whole student document.
      await studentRef.update({ ownerUid: expectedOwnerUid })

      outcomes.push({
        ...row,
        ownerUidApplied: true,
        ownerApplyStatus: 'OWNER_UID_APPLIED',
        ownerStatus: 'OWNER_OK',
        ownerUidPreviousState: null,
        resultingOwnerUid: expectedOwnerUid,
        addedOwnerUid: true,
        safeOwnerBackfillCandidate: false,
        ownerAppliedAt: new Date().toISOString(),
      })
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : ''
      outcomes.push({
        ...row,
        ownerUidApplied: false,
        ownerApplyStatus: 'ERROR',
        reasons: [
          ...(row.reasons || []),
          `owner_apply_exception:${code || (error instanceof Error ? error.message : 'unknown')}`,
        ],
      })
    }
  }

  return outcomes
}

async function confirmApplyOwnerUid(projectId) {
  console.log('')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('  OWNER UID BACKFILL WILL MODIFY LIVE FIRESTORE DATA')
  console.log(`  TARGET PROJECT: ${projectId}`)
  console.log('  - Writes ONLY ogrenciler/{id}.ownerUid')
  console.log('  - Only OWNER_MISSING + verified identity candidates')
  console.log('  - Never overwrites OWNER_MISMATCH / OWNER_AMBIGUOUS')
  console.log('  - Does NOT touch password / canManageAttendance / notes')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('')

  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question(`Type the project ID ("${projectId}") to continue: `)
    if (answer.trim() !== projectId) {
      throw new Error('Project confirmation mismatch — aborting without ownerUid writes.')
    }
  } finally {
    rl.close()
  }
}

async function confirmProvisionStudent(projectId, legacyDocId) {
  console.log('')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('  STUDENT PROVISIONING WILL MODIFY LIVE FIREBASE DATA')
  console.log(`  TARGET PROJECT: ${projectId}`)
  console.log(`  STUDENT DOC: ogrenciler/${legacyDocId}`)
  console.log('  - May create Auth user + users/{uid}')
  console.log('  - May set ogrenciler.ownerUid')
  console.log('  - Strict identity binding (partial Auth/profile → MANUAL_REVIEW)')
  console.log('  - Does NOT auto-bind mismatched / partial existing Auth')
  console.log('  - Does NOT write plaintext password to Firestore')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('')

  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question(`Type the project ID ("${projectId}") to continue: `)
    if (answer.trim() !== projectId) {
      throw new Error('Project confirmation mismatch — aborting without provisioning.')
    }
  } finally {
    rl.close()
  }
}

/**
 * Provisioning requires EXACT full binding — SAFE_EXISTING / partial profiles are MANUAL_REVIEW.
 */
function classifyProvisionExistingAuth(profile, legacyDocId, username) {
  if (!profile) return { kind: 'manual_review', reason: 'existing_auth_profile_missing' }

  const roleOk = profile.role === 'student'
  const collectionOk = profile.legacyCollection === 'ogrenciler'
  const docOk = profile.legacyDocId === legacyDocId
  const usernameOk = profile.username === username

  if (roleOk && collectionOk && docOk && usernameOk) {
    return { kind: 'fully_bound' }
  }

  return { kind: 'manual_review', reason: 'existing_auth_partial_or_mismatched_profile' }
}

const PROVISION_PHASE = {
  NONE: 'NONE',
  AUTH_CREATED: 'AUTH_CREATED',
  CREDENTIAL_PENDING_SAVED: 'CREDENTIAL_PENDING_SAVED',
  FIRESTORE_COMMITTED: 'FIRESTORE_COMMITTED',
  CREDENTIAL_READY_SAVED: 'CREDENTIAL_READY_SAVED',
}

/**
 * Auth delete only for newly-created accounts that have not yet reached a committed
 * Firestore provision. Never delete after FIRESTORE_COMMITTED / READY, and never
 * delete existing Auth users.
 */
function shouldDeleteAuthOnProvisionFailure({ createdAuthUserThisRun, phase }) {
  if (createdAuthUserThisRun !== true) return false
  if (phase === PROVISION_PHASE.FIRESTORE_COMMITTED) return false
  if (phase === PROVISION_PHASE.CREDENTIAL_READY_SAVED) return false
  return (
    phase === PROVISION_PHASE.AUTH_CREATED ||
    phase === PROVISION_PHASE.CREDENTIAL_PENDING_SAVED
  )
}

/**
 * Pure recovery policy for new-Auth provision failure paths (self-testable).
 * @returns {{ attemptAuthDelete: boolean, codeOnRollbackOk?: string, codeOnRollbackFail?: string, codeWithoutDelete?: string }}
 */
function decideProvisionRecovery({ createdAuthUserThisRun, phase }) {
  if (!shouldDeleteAuthOnProvisionFailure({ createdAuthUserThisRun, phase })) {
    if (createdAuthUserThisRun !== true) {
      return { attemptAuthDelete: false, codeWithoutDelete: 'NO_AUTH_DELETE' }
    }
    if (phase === PROVISION_PHASE.FIRESTORE_COMMITTED) {
      return {
        attemptAuthDelete: false,
        codeWithoutDelete: 'CREDENTIAL_RECOVERY_REQUIRED',
      }
    }
    return { attemptAuthDelete: false, codeWithoutDelete: 'MANUAL_RECOVERY' }
  }
  return {
    attemptAuthDelete: true,
    codeOnRollbackOk: 'PROVISION_FAILED',
    codeOnRollbackFail: 'MANUAL_RECOVERY',
  }
}

/**
 * Simulates failure-path decisions without Firebase I/O (self-test only).
 * @param {'pending' | 'firestore' | 'ready' | null} failAt
 */
function simulateProvisionFailurePath({
  failAt,
  createdAuthUserThisRun,
  rollbackSucceeds = true,
}) {
  /** @type {string[]} */
  const actions = []
  let phase = PROVISION_PHASE.NONE

  actions.push('auth_create')
  phase = PROVISION_PHASE.AUTH_CREATED

  if (failAt === 'pending') {
    const decision = decideProvisionRecovery({ createdAuthUserThisRun, phase })
    if (!decision.attemptAuthDelete) {
      return { actions, phase, code: decision.codeWithoutDelete }
    }
    actions.push('auth_delete_attempt')
    if (!rollbackSucceeds) {
      return { actions, phase, code: decision.codeOnRollbackFail }
    }
    actions.push('auth_deleted')
    return { actions, phase, code: decision.codeOnRollbackOk }
  }

  actions.push('pending_saved')
  phase = PROVISION_PHASE.CREDENTIAL_PENDING_SAVED

  if (failAt === 'firestore') {
    const decision = decideProvisionRecovery({ createdAuthUserThisRun, phase })
    if (!decision.attemptAuthDelete) {
      return { actions, phase, code: decision.codeWithoutDelete }
    }
    actions.push('auth_delete_attempt')
    if (!rollbackSucceeds) {
      return { actions, phase, code: decision.codeOnRollbackFail }
    }
    actions.push('auth_deleted')
    return { actions, phase, code: decision.codeOnRollbackOk }
  }

  actions.push('firestore_committed')
  phase = PROVISION_PHASE.FIRESTORE_COMMITTED

  if (failAt === 'ready') {
    const decision = decideProvisionRecovery({ createdAuthUserThisRun, phase })
    return { actions, phase, code: decision.codeWithoutDelete }
  }

  actions.push('ready_saved')
  phase = PROVISION_PHASE.CREDENTIAL_READY_SAVED
  return { actions, phase, code: 'CREATED' }
}

/**
 * Best-effort Auth rollback for newly created users. Never deletes existing Auth.
 * @returns {Promise<'deleted' | 'failed' | 'not_attempted' | 'skipped_existing'>}
 */
async function attemptProvisionAuthRollback({
  auth,
  uid,
  createdAuthUserThisRun,
  phase,
  legacyDocId,
  username,
}) {
  if (!shouldDeleteAuthOnProvisionFailure({ createdAuthUserThisRun, phase })) {
    return createdAuthUserThisRun === true ? 'not_attempted' : 'skipped_existing'
  }
  if (!uid) return 'not_attempted'

  try {
    await auth.deleteUser(uid)
    try {
      removeCredentialEntry({ legacyDocId, username })
    } catch {
      // Auth already rolled back; credential cleanup is best-effort.
    }
    return 'deleted'
  } catch (rollbackError) {
    const rollbackMsg =
      rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
    console.error('[provision-student] MANUAL_RECOVERY required')
    console.error(`  uid=${uid} legacyDocId=${legacyDocId}`)
    console.error(`  Auth rollback failed: ${rollbackMsg}`)
    console.error('  Pending credential retained if present (no password logged)')
    return 'failed'
  }
}

/**
 * Existing fully-bound Auth: users/{uid}.canManageAttendance is canonical.
 * New Auth: roster value seeds users profile.
 */
function resolveProvisionAttendance({ isNewAuthUser, rosterAttendance, usersAttendance }) {
  if (isNewAuthUser) return rosterAttendance === true
  return usersAttendance === true
}

function countLiveWriteModes(opts) {
  let n = 0
  if (opts.apply) n += 1
  if (opts.applyOwnerUid) n += 1
  if (opts.provisionStudentId) n += 1
  if (opts.cleanupStudentPasswords) n += 1
  if (opts.cleanupGraduatePassword) n += 1
  if (opts.cleanupAdminPasswords) n += 1
  if (opts.rotateGraduatePassword) n += 1
  if (opts.syncAttendanceRoster) n += 1
  if (opts.backfillLeaveOwner) n += 1
  if (opts.normalizeAuditTimestamps) n += 1
  return n
}

function countExclusiveModes(opts) {
  let n = countLiveWriteModes(opts)
  if (opts.checkGraduateAuth) n += 1
  if (opts.checkAdminAuth) n += 1
  if (opts.checkStudentPasswords) n += 1
  if (opts.checkAttendanceRoster) n += 1
  if (opts.checkLeaveOwner) n += 1
  if (opts.checkAuditTimestamps) n += 1
  return n
}

/**
 * @returns {string|null} rejection reason code, or null if write-mode flags are OK
 */
function rejectLiveWriteModeFlags(opts) {
  if (countExclusiveModes(opts) > 1) return 'multiple_write_modes'
  if (opts.apply) return 'generic_apply_disabled'
  return null
}

function isLiveWriteProjectAllowed(projectId) {
  return projectId === OWNER_BACKFILL_ALLOWED_PROJECT
}

/** True if ogrenciler.password field is present (value never returned/logged). */
function hasLegacyPasswordField(data) {
  if (!data || typeof data !== 'object') return false
  return Object.prototype.hasOwnProperty.call(data, 'password')
}

/**
 * Password cleanup eligibility — never includes password value.
 * @returns {{ status: string, passwordPresent: boolean, eligible: boolean, reason?: string }}
 */
function classifyPasswordCleanupEligibility({
  studentDocId,
  studentData,
  usersProfile,
}) {
  const passwordPresent = hasLegacyPasswordField(studentData)
  const ownerUid =
    typeof studentData?.ownerUid === 'string' ? studentData.ownerUid.trim() : ''
  const username =
    typeof studentData?.username === 'string' ? studentData.username.trim() : ''

  if (!passwordPresent) {
    return {
      status: 'PASSWORD_ALREADY_ABSENT',
      passwordPresent: false,
      eligible: false,
    }
  }

  if (!ownerUid) {
    return {
      status: 'PASSWORD_MANUAL_REVIEW',
      passwordPresent: true,
      eligible: false,
      reason: 'missing_ownerUid',
    }
  }

  if (!usersProfile) {
    return {
      status: 'PASSWORD_MANUAL_REVIEW',
      passwordPresent: true,
      eligible: false,
      reason: 'users_profile_missing',
    }
  }

  const bindingOk =
    usersProfile.role === 'student' &&
    usersProfile.legacyCollection === 'ogrenciler' &&
    usersProfile.legacyDocId === studentDocId &&
    usersProfile.username === username

  if (!bindingOk) {
    return {
      status: 'PASSWORD_MANUAL_REVIEW',
      passwordPresent: true,
      eligible: false,
      reason: 'identity_binding_mismatch',
    }
  }

  return {
    status: 'PASSWORD_PRESENT_SAFE_TO_CLEAN',
    passwordPresent: true,
    eligible: true,
  }
}

function readGraduateClientSources() {
  return {
    authService: readFileSync(join(ROOT, 'src', 'services', 'auth.service.ts'), 'utf8'),
    graduatesService: readFileSync(join(ROOT, 'src', 'services', 'graduates.service.ts'), 'utf8'),
    adminSettings: readFileSync(
      join(ROOT, 'src', 'components', 'admin', 'GraduateSettingsSection.tsx'),
      'utf8',
    ),
  }
}

async function confirmProjectId(projectId, title, details) {
  console.log('')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log(`  ${title}`)
  console.log(`  TARGET PROJECT: ${projectId}`)
  for (const line of details) {
    console.log(`  - ${line}`)
  }
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('')

  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question(`Type the project ID ("${projectId}") to continue: `)
    if (answer.trim() !== projectId) {
      throw new Error('Project confirmation mismatch — aborting without writes.')
    }
  } finally {
    rl.close()
  }
}

/**
 * Hidden TTY password prompt. Never echoes. Does not accept argv/env passwords.
 */
async function readHiddenPassword(promptText) {
  if (!input.isTTY || !output.isTTY) {
    throw new Error('Interactive TTY required for password input (do not pipe or pass --password).')
  }

  output.write(promptText)
  return new Promise((resolve, reject) => {
    const chars = []
    const previousRaw = input.isRaw
    const onData = (chunk) => {
      const text = chunk.toString('utf8')
      for (const ch of text) {
        if (ch === '\n' || ch === '\r') {
          cleanup()
          output.write('\n')
          resolve(chars.join(''))
          return
        }
        if (ch === '\u0003') {
          cleanup()
          output.write('\n')
          reject(new Error('Cancelled'))
          return
        }
        if (ch === '\u007f' || ch === '\b') {
          chars.pop()
          continue
        }
        if (ch >= ' ') chars.push(ch)
      }
    }
    const cleanup = () => {
      input.off('data', onData)
      if (typeof input.setRawMode === 'function') {
        input.setRawMode(Boolean(previousRaw))
      }
      input.pause()
    }
    if (typeof input.setRawMode === 'function') input.setRawMode(true)
    input.resume()
    input.on('data', onData)
  })
}

async function loadGraduateAuthSnapshot(admin) {
  const auth = admin.auth()
  const db = admin.firestore()
  const email = toAuthEmail(GRADUATE_AUTH_USERNAME)

  let authUser = null
  try {
    authUser = await auth.getUserByEmail(email)
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    if (code !== 'auth/user-not-found') throw error
  }

  let profile = null
  if (authUser) {
    const snap = await db.collection('users').doc(authUser.uid).get()
    profile = snap.exists ? snap.data() : null
  }

  const loginSnap = await db.collection(GRADUATE_LOGIN_COLLECTION).doc(GRADUATE_LOGIN_DOC_ID).get()
  const loginDoc = loginSnap.exists ? loginSnap.data() : null

  const classified = classifyGraduateAuthCheck({
    authExists: Boolean(authUser),
    authDisabled: Boolean(authUser?.disabled),
    profile,
    loginDoc,
  })

  return {
    email,
    authUser,
    profile,
    loginDoc,
    loginExists: loginSnap.exists,
    classified,
  }
}

/**
 * READ-ONLY: shared graduate Auth + users/{uid} + mezun_giris.password presence. No auto-fix.
 */
async function checkGraduateAuth(admin, projectId) {
  const snapshot = await loadGraduateAuthSnapshot(admin)
  const clientReady = assessGraduateClientAuthOnlyReady(readGraduateClientSources())
  const cleanup = classifyGraduatePasswordCleanup({
    authStatus: snapshot.classified.authStatus,
    clientAuthOnlyReady: clientReady.ready,
    passwordPresent: snapshot.classified.passwordPresent,
  })

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'CHECK-GRADUATE-AUTH',
    projectId,
    authUsername: GRADUATE_AUTH_USERNAME,
    uid: snapshot.authUser?.uid || null,
    disabled: Boolean(snapshot.authUser?.disabled),
    authStatus: snapshot.classified.authStatus,
    passwordStatus: snapshot.classified.passwordStatus,
    role: snapshot.classified.role,
    clientAuthOnlyReady: clientReady.ready,
    clientReadyFailures: clientReady.failures,
    cleanupAllowed: cleanup.allowed,
    cleanupReason: cleanup.reason,
    note: 'READ-ONLY. Password values are never read into this report. No auto-fix.',
  }

  assertNoPasswordInReport(report)
  writeFileSync(MANIFEST_PATH, JSON.stringify(report, null, 2), 'utf8')
  console.log('[check-graduate-auth] authStatus:', report.authStatus)
  console.log('[check-graduate-auth] passwordStatus:', report.passwordStatus)
  if (report.uid) console.log('[check-graduate-auth] uid:', report.uid)
  if (report.role) console.log('[check-graduate-auth] role:', report.role)
  console.log('[check-graduate-auth] disabled:', report.disabled)
  console.log('[check-graduate-auth] clientAuthOnlyReady:', report.clientAuthOnlyReady)
  console.log('[check-graduate-auth] cleanupAllowed:', report.cleanupAllowed)
  console.log(`Manifest written: ${MANIFEST_PATH}`)
  return report
}

async function getAuthUserByEmailSafe(auth, email) {
  try {
    return await auth.getUserByEmail(email)
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    if (code !== 'auth/user-not-found') throw error
    return null
  }
}

async function confirmCleanupAdminPasswords(projectId) {
  await confirmProjectId(projectId, 'LIVE FIRESTORE FIELD WILL BE DELETED', [
    'Deletes ONLY yoneticiler/{id}.password via FieldValue.delete()',
    'Only ADMIN_BINDING_OK + Auth enabled + password present + no manual review',
    'Does NOT touch Auth, users profiles, username, or other yoneticiler fields',
    'Password VALUES are never logged',
  ])
}

/**
 * READ-ONLY inventory (live:false) or eligible password-field delete (live:true).
 * Never logs or stores password values.
 */
async function runAdminAuthPass(admin, projectId, { live }) {
  const db = admin.firestore()
  const auth = admin.auth()
  const FieldValue = admin.firestore.FieldValue
  const snap = await db.collection(ADMIN_LEGACY_COLLECTION).get()
  const timestamp = new Date().toISOString()

  const sourceRows = snap.docs.map((docSnap) => {
    const data = docSnap.data() || {}
    return {
      id: docSnap.id,
      username: normalizeAdminUsername(data.username),
      passwordPresent: hasAdminPlaintextPasswordField(data),
      ref: docSnap.ref,
    }
  })

  const collisionIndex = buildAdminCollisionIndex(sourceRows)
  const counts = emptyAdminBindingCounts()
  const rows = []
  let manualReviewRequired = 0
  let cleanupEligible = 0
  let cleaned = 0
  let cleanErrors = 0

  for (const source of sourceRows) {
    const flags = adminCollisionFlags(source.username, collisionIndex)
    const skipAuthLookup = flags.duplicateUsername || flags.emailCollision || !flags.emailOk

    let authUser = null
    let profile = null
    if (!skipAuthLookup && flags.email) {
      authUser = await getAuthUserByEmailSafe(auth, flags.email)
      if (authUser) {
        const profileSnap = await db.collection('users').doc(authUser.uid).get()
        profile = profileSnap.exists ? profileSnap.data() : null
      }
    }

    const classified = classifyAdminBinding({
      legacyDocId: source.id,
      username: source.username,
      passwordPresent: source.passwordPresent,
      duplicateUsername: flags.duplicateUsername,
      emailCollision: flags.emailCollision,
      authExists: Boolean(authUser),
      authDisabled: Boolean(authUser?.disabled),
      profile,
    })

    const cleanup = classifyAdminPasswordCleanup({
      bindingStatus: classified.bindingStatus,
      authDisabled: Boolean(authUser?.disabled),
      passwordPresent: classified.passwordPresent,
      manualReviewRequired: classified.manualReviewRequired,
    })

    incrementAdminCounts(counts, classified)
    if (classified.manualReviewRequired) manualReviewRequired += 1
    if (cleanup.allowed) cleanupEligible += 1

    let didClean = false
    if (live && cleanup.allowed) {
      try {
        const update = buildAdminPasswordDeleteUpdate(FieldValue.delete())
        if (!isPasswordOnlyDeleteUpdate(update)) {
          throw new Error('Refusing cleanup: payload is not password-only delete')
        }
        await source.ref.update(update)
        didClean = true
        cleaned += 1
      } catch (error) {
        cleanErrors += 1
        const msg = error instanceof Error ? error.message : String(error)
        rows.push({
          ...toAdminAuthManifestRow({
            legacyDocId: source.id,
            username: source.username,
            uid: authUser?.uid || null,
            classified,
            cleanupEligible: false,
            timestamp,
          }),
          cleaned: false,
          cleanError: msg,
        })
        continue
      }
    }

    rows.push({
      ...toAdminAuthManifestRow({
        legacyDocId: source.id,
        username: source.username,
        uid: authUser?.uid || null,
        classified,
        cleanupEligible: cleanup.allowed,
        timestamp,
      }),
      cleaned: didClean,
    })
  }

  const summary = {
    generatedAt: timestamp,
    mode: live ? 'CLEANUP-ADMIN-PASSWORDS' : 'CHECK-ADMIN-AUTH',
    projectId,
    collection: ADMIN_LEGACY_COLLECTION,
    adminsTotal: snap.size,
    ...counts,
    manualReviewRequired,
    cleanupEligible,
    cleaned,
    cleanErrors,
    note: 'Password VALUES are never read into this report. Duplicate usernames and canonical email collisions are never auto-matched.',
    rows,
  }

  assertNoPasswordValueInAdminPayload(summary)
  writeFileSync(ADMIN_AUTH_MANIFEST_PATH, JSON.stringify(summary, null, 2), 'utf8')

  console.log(`[${live ? 'cleanup' : 'check'}-admin-auth] Admins total:`, summary.adminsTotal)
  console.log('  ADMIN_BINDING_OK:', summary.ADMIN_BINDING_OK)
  console.log('  ADMIN_AUTH_MISSING:', summary.ADMIN_AUTH_MISSING)
  console.log('  ADMIN_PROFILE_MISSING:', summary.ADMIN_PROFILE_MISSING)
  console.log('  ADMIN_PROFILE_MISMATCH:', summary.ADMIN_PROFILE_MISMATCH)
  console.log('  ADMIN_AUTH_DISABLED:', summary.ADMIN_AUTH_DISABLED)
  console.log('  ADMIN_USERNAME_INVALID:', summary.ADMIN_USERNAME_INVALID)
  console.log('  ADMIN_DUPLICATE_USERNAME:', summary.ADMIN_DUPLICATE_USERNAME)
  console.log('Password:')
  console.log('  ADMIN_PASSWORD_PRESENT:', summary.ADMIN_PASSWORD_PRESENT)
  console.log('  ADMIN_PASSWORD_ABSENT:', summary.ADMIN_PASSWORD_ABSENT)
  console.log('  manualReviewRequired:', summary.manualReviewRequired)
  console.log('  cleanupEligible:', summary.cleanupEligible)
  if (live) {
    console.log('  cleaned:', cleaned)
    console.log('  cleanErrors:', cleanErrors)
  }
  console.log(`Manifest written: ${ADMIN_AUTH_MANIFEST_PATH}`)
  console.log('(password values were never written to console or manifest.)')
  return summary
}

async function cleanupGraduatePassword(admin, projectId) {
  const snapshot = await loadGraduateAuthSnapshot(admin)
  const clientReady = assessGraduateClientAuthOnlyReady(readGraduateClientSources())
  const decision = classifyGraduatePasswordCleanup({
    authStatus: snapshot.classified.authStatus,
    clientAuthOnlyReady: clientReady.ready,
    passwordPresent: snapshot.classified.passwordPresent,
  })

  if (!decision.allowed) {
    console.error('[cleanup-graduate-password] blocked:', decision.reason)
    console.error('  authStatus:', snapshot.classified.authStatus)
    console.error('  passwordStatus:', snapshot.classified.passwordStatus)
    console.error('  clientAuthOnlyReady:', clientReady.ready)
    if (clientReady.failures.length) {
      console.error('  clientReadyFailures:', clientReady.failures.join(', '))
    }
    throw new Error(`Graduate password cleanup blocked: ${decision.reason}`)
  }

  await confirmProjectId(projectId, 'LIVE FIRESTORE FIELD WILL BE DELETED', [
    'Deletes ONLY ayarlar/mezun_giris.password via FieldValue.delete()',
    'Does NOT touch welcomeTitle, welcomeMessage, enabled, username, Auth, or mezunlar',
    'Password VALUES are never logged',
  ])

  const db = admin.firestore()
  const FieldValue = admin.firestore.FieldValue
  const update = buildGraduateLoginPasswordDeleteUpdate(FieldValue.delete())
  if (!isPasswordOnlyDeleteUpdate(update)) {
    throw new Error('Refusing cleanup: payload is not password-only delete')
  }

  const ref = db.collection(GRADUATE_LOGIN_COLLECTION).doc(GRADUATE_LOGIN_DOC_ID)
  const before = await ref.get()
  const beforeKeys = before.exists ? Object.keys(before.data() || {}) : []
  await ref.update(update)

  const after = await ref.get()
  const afterData = after.exists ? after.data() || {} : {}
  const afterKeys = Object.keys(afterData)
  const passwordGone = !Object.prototype.hasOwnProperty.call(afterData, 'password')
  const otherKeysIntact = beforeKeys
    .filter((key) => key !== 'password')
    .every((key) => afterKeys.includes(key))

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'CLEANUP-GRADUATE-PASSWORD',
    projectId,
    authUsername: GRADUATE_AUTH_USERNAME,
    uid: snapshot.authUser?.uid || null,
    passwordDeleted: passwordGone,
    otherConfigFieldsIntact: otherKeysIntact,
    remainingFieldNames: afterKeys.filter((key) => key !== 'password'),
  }
  assertNoPasswordInReport(report)
  writeFileSync(MANIFEST_PATH, JSON.stringify(report, null, 2), 'utf8')
  console.log('[cleanup-graduate-password] passwordDeleted:', passwordGone)
  console.log('[cleanup-graduate-password] otherConfigFieldsIntact:', otherKeysIntact)
  console.log(`Manifest written: ${MANIFEST_PATH}`)
  return report
}

async function rotateGraduatePassword(admin, projectId) {
  const snapshot = await loadGraduateAuthSnapshot(admin)
  const expectedEmail = snapshot.email
  const precheck = classifyGraduatePasswordRotation({
    authExists: Boolean(snapshot.authUser),
    authEmail: snapshot.authUser?.email || null,
    expectedEmail,
    authUid: snapshot.authUser?.uid || null,
    resolvedUid: snapshot.authUser?.uid || null,
    profileRole: snapshot.classified.role,
    newPasswordLength: GRADUATE_MIN_PASSWORD_LENGTH,
    confirmMatches: true,
    writesFirestore: false,
  })

  if (!snapshot.authUser || precheck.status === GRADUATE_ROTATION_STATUS.AUTH_MISSING) {
    throw new Error('Graduate password rotation blocked: GRADUATE_AUTH_MISSING')
  }
  if (snapshot.classified.role !== 'graduate') {
    throw new Error('Graduate password rotation blocked: GRADUATE_PROFILE_INVALID')
  }
  if (snapshot.authUser.email !== expectedEmail) {
    throw new Error('Graduate password rotation blocked: ROTATION_TARGET_MISMATCH')
  }

  await confirmProjectId(projectId, 'LIVE FIREBASE AUTH PASSWORD WILL BE CHANGED', [
    'Updates ONLY the mezun.portal Auth user password',
    'Does NOT write Firestore, manifest, or console with the password',
    'Does NOT apply to any other Auth account',
  ])

  const first = await readHiddenPassword('New graduate password (hidden): ')
  const second = await readHiddenPassword('Confirm new graduate password (hidden): ')
  const decision = classifyGraduatePasswordRotation({
    authExists: true,
    authEmail: snapshot.authUser.email,
    expectedEmail,
    authUid: snapshot.authUser.uid,
    resolvedUid: snapshot.authUser.uid,
    profileRole: snapshot.classified.role,
    newPasswordLength: first.length,
    confirmMatches: first === second,
    writesFirestore: false,
  })

  if (!decision.allowed) {
    throw new Error(`Graduate password rotation blocked: ${decision.status}`)
  }

  await admin.auth().updateUser(snapshot.authUser.uid, { password: first })

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'ROTATE-GRADUATE-PASSWORD',
    projectId,
    authUsername: GRADUATE_AUTH_USERNAME,
    uid: snapshot.authUser.uid,
    rotated: true,
    firestoreWritten: false,
  }
  assertNoPasswordInReport(report)
  console.log('[rotate-graduate-password] rotated: true')
  console.log('[rotate-graduate-password] uid:', snapshot.authUser.uid)
  console.log('[rotate-graduate-password] firestoreWritten: false')
  return report
}

function readCredentialsStore() {
  if (!existsSync(CREDENTIALS_OUT_PATH)) {
    return { warning: 'SENSITIVE temporary passwords. Never commit.', users: [] }
  }
  try {
    const parsed = JSON.parse(readFileSync(CREDENTIALS_OUT_PATH, 'utf8'))
    return {
      warning:
        parsed.warning ||
        'SENSITIVE temporary passwords. Deliver offline, then delete this file. Never commit.',
      generatedAt: parsed.generatedAt,
      projectId: parsed.projectId,
      users: Array.isArray(parsed.users) ? parsed.users : [],
    }
  } catch {
    return { warning: 'SENSITIVE temporary passwords. Never commit.', users: [] }
  }
}

function writeCredentialsStore(store) {
  writeFileSync(CREDENTIALS_OUT_PATH, JSON.stringify(store, null, 2), 'utf8')
}

function upsertCredentialEntry(entry) {
  const store = readCredentialsStore()
  const users = store.users.filter(
    (u) =>
      !(
        u.legacyDocId === entry.legacyDocId &&
        u.collection === entry.collection &&
        u.username === entry.username
      ),
  )
  users.push(entry)
  writeCredentialsStore({
    ...store,
    generatedAt: new Date().toISOString(),
    projectId: entry.projectId || store.projectId,
    users,
  })
}

function removeCredentialEntry({ legacyDocId, username, collection = 'ogrenciler' }) {
  const store = readCredentialsStore()
  const users = store.users.filter(
    (u) =>
      !(
        u.legacyDocId === legacyDocId &&
        u.collection === collection &&
        u.username === username
      ),
  )
  writeCredentialsStore({ ...store, users, generatedAt: new Date().toISOString() })
}

function finalizeCredentialEntry({ legacyDocId, username, collection = 'ogrenciler' }) {
  const store = readCredentialsStore()
  const users = store.users.map((u) => {
    if (
      u.legacyDocId === legacyDocId &&
      u.collection === collection &&
      u.username === username
    ) {
      return { ...u, status: 'READY', finalizedAt: new Date().toISOString() }
    }
    return u
  })
  writeCredentialsStore({ ...store, users, generatedAt: new Date().toISOString() })
}

/**
 * Provision Auth + users profile + ownerUid for one ogrenciler document.
 * Strict existing-Auth policy. Rollback newly created Auth on PENDING/Firestore
 * failure before commit; never delete after FIRESTORE_COMMITTED.
 */
async function provisionSingleStudent(admin, projectId, legacyDocId) {
  const db = admin.firestore()
  const auth = admin.auth()
  const studentRef = db.collection('ogrenciler').doc(legacyDocId)
  const snap = await studentRef.get()
  if (!snap.exists) {
    throw new Error(`ogrenciler/${legacyDocId} not found`)
  }

  const data = snap.data() || {}
  const username = typeof data.username === 'string' ? data.username.trim() : ''
  if (!username) throw new Error('Student username missing')
  if (isReservedUsername(username)) throw new Error('Reserved username cannot be provisioned')

  const emailTry = tryToAuthEmail(username)
  if (!emailTry.ok) throw new Error(`Invalid username for Auth email: ${emailTry.error}`)
  const email = emailTry.email

  const rosterAttendance = data.canManageAttendance === true
  const now = new Date().toISOString()
  const existingOwner =
    typeof data.ownerUid === 'string' && data.ownerUid.trim() ? data.ownerUid.trim() : ''

  let authUser = null
  try {
    authUser = await auth.getUserByEmail(email)
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    if (code !== 'auth/user-not-found') throw error
  }

  if (authUser) {
    const profileSnap = await db.collection('users').doc(authUser.uid).get()
    const profile = profileSnap.exists ? profileSnap.data() : null
    const match = classifyProvisionExistingAuth(profile, legacyDocId, username)

    if (match.kind !== 'fully_bound') {
      const err = new Error(
        `MANUAL_REVIEW: ${match.reason || 'existing_auth_not_fully_bound'} (no auto-bind)`,
      )
      err.code = 'MANUAL_REVIEW'
      throw err
    }

    if (existingOwner && existingOwner !== authUser.uid) {
      const err = new Error('MANUAL_REVIEW: ownerUid mismatch with fully-bound Auth uid')
      err.code = 'MANUAL_REVIEW'
      throw err
    }

    // users/{uid}.canManageAttendance is canonical — never overwrite from roster.
    const canonicalAttendance = resolveProvisionAttendance({
      isNewAuthUser: false,
      rosterAttendance,
      usersAttendance: profile.canManageAttendance === true,
    })
    const studentPatch = { updatedAt: now }
    let syncedRosterAttendance = false

    if (!existingOwner) {
      studentPatch.ownerUid = authUser.uid
    }
    if (rosterAttendance !== canonicalAttendance) {
      studentPatch.canManageAttendance = canonicalAttendance
      syncedRosterAttendance = true
    }

    const needsStudentUpdate = Boolean(studentPatch.ownerUid) || syncedRosterAttendance
    if (needsStudentUpdate) {
      await studentRef.update(studentPatch)
    }

    return {
      status: existingOwner ? 'ALREADY_PROVISIONED' : 'RECONCILED_OWNER_UID',
      uid: authUser.uid,
      email,
      username,
      legacyDocId,
      createdAuthUser: false,
      temporaryPassword: null,
      syncedRosterAttendance,
    }
  }

  if (existingOwner) {
    const err = new Error(
      'MANUAL_REVIEW: roster has ownerUid but Auth account missing for canonical email',
    )
    err.code = 'MANUAL_REVIEW'
    throw err
  }

  const temporaryPassword = generateTemporaryPassword()
  let created = null
  let createdAuthUserThisRun = false
  let phase = PROVISION_PHASE.NONE

  created = await auth.createUser({
    email,
    password: temporaryPassword,
    emailVerified: false,
    disabled: false,
  })
  createdAuthUserThisRun = true
  phase = PROVISION_PHASE.AUTH_CREATED

  // Persist PENDING credential BEFORE Firestore writes (crash recovery).
  try {
    upsertCredentialEntry({
      status: 'PENDING',
      projectId,
      username,
      temporaryPassword,
      collection: 'ogrenciler',
      legacyDocId,
      email,
      uid: created.uid,
      createdAt: now,
    })
    phase = PROVISION_PHASE.CREDENTIAL_PENDING_SAVED
  } catch (pendingError) {
    const rollbackStatus = await attemptProvisionAuthRollback({
      auth,
      uid: created.uid,
      createdAuthUserThisRun,
      phase,
      legacyDocId,
      username,
    })
    const pendingMsg =
      pendingError instanceof Error ? pendingError.message : String(pendingError)
    const err = new Error(
      `PENDING credential write failed after Auth create (rollback=${rollbackStatus}): ${pendingMsg}`,
    )
    err.code = rollbackStatus === 'failed' ? 'MANUAL_RECOVERY' : 'PROVISION_FAILED'
    throw err
  }

  try {
    const batch = db.batch()
    batch.set(
      db.collection('users').doc(created.uid),
      stripUndefined({
        uid: created.uid,
        username,
        adSoyad: typeof data.adSoyad === 'string' ? data.adSoyad : username,
        role: 'student',
        legacyCollection: 'ogrenciler',
        legacyDocId,
        // New Auth: roster attendance is the initial users value.
        canManageAttendance: resolveProvisionAttendance({
          isNewAuthUser: true,
          rosterAttendance,
          usersAttendance: false,
        }),
        bolum: data.bolum,
        sinif: data.sinif,
        odaNo: data.odaNo,
        donem: data.donem,
        createdAt: now,
        updatedAt: now,
      }),
      { merge: true },
    )
    batch.update(studentRef, { ownerUid: created.uid, updatedAt: now })
    await batch.commit()
    phase = PROVISION_PHASE.FIRESTORE_COMMITTED
  } catch (error) {
    const rollbackStatus = await attemptProvisionAuthRollback({
      auth,
      uid: created.uid,
      createdAuthUserThisRun,
      phase,
      legacyDocId,
      username,
    })
    const firestoreMsg = error instanceof Error ? error.message : String(error)
    const err = new Error(
      `Provision Firestore failed after Auth create (rollback=${rollbackStatus}): ${firestoreMsg}`,
    )
    err.code = rollbackStatus === 'failed' ? 'MANUAL_RECOVERY' : 'PROVISION_FAILED'
    throw err
  }

  // Auth + Firestore committed. READY write failure must NOT delete Auth.
  try {
    finalizeCredentialEntry({ legacyDocId, username })
    phase = PROVISION_PHASE.CREDENTIAL_READY_SAVED
  } catch (readyError) {
    const readyMsg = readyError instanceof Error ? readyError.message : String(readyError)
    console.error('[provision-student] CREDENTIAL_RECOVERY_REQUIRED')
    console.error(`  uid=${created.uid} legacyDocId=${legacyDocId}`)
    console.error(
      '  Auth+Firestore provision committed; local PENDING→READY update failed.',
    )
    console.error('  Keep migration-credentials.local.json if PENDING entry exists.')
    console.error(`  detail=${readyMsg}`)
    const err = new Error(
      `CREDENTIAL_RECOVERY_REQUIRED: Auth+Firestore OK but READY credential write failed (uid=${created.uid}, legacyDocId=${legacyDocId})`,
    )
    err.code = 'CREDENTIAL_RECOVERY_REQUIRED'
    throw err
  }

  return {
    status: 'CREATED',
    uid: created.uid,
    email,
    username,
    legacyDocId,
    createdAuthUser: true,
    temporaryPassword,
    phase,
  }
}

async function confirmSyncAttendanceRoster(projectId) {
  console.log('')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('  LIVE FIRESTORE DATA WILL BE MODIFIED')
  console.log(`  TARGET PROJECT: ${projectId}`)
  console.log(`  TARGET COLLECTION: ${ATTENDANCE_ROSTER_COLLECTION}`)
  console.log('  - Creates/updates minimal docs: studentId, adSoyad, odaNo')
  console.log('  - Does NOT delete ROSTER_EXTRA docs in this version')
  console.log('  - Does NOT touch ogrenciler / Auth / users')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('')

  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question(`Type the project ID ("${projectId}") to continue: `)
    if (answer.trim() !== projectId) {
      throw new Error('Project confirmation mismatch — aborting without roster sync.')
    }
  } finally {
    rl.close()
  }
}

/**
 * Compare ogrenciler ↔ yoklama_roster. Optional live create/update (no extra deletes).
 * @param {{ live: boolean }} options
 */
async function runAttendanceRosterPass(admin, projectId, { live }) {
  const db = admin.firestore()
  const studentsSnap = await db.collection('ogrenciler').get()
  const rosterSnap = await db.collection(ATTENDANCE_ROSTER_COLLECTION).get()

  /** @type {Map<string, FirebaseFirestore.DocumentData>} */
  const rosterById = new Map()
  for (const docSnap of rosterSnap.docs) {
    rosterById.set(docSnap.id, docSnap.data() || {})
  }

  /** @type {Array<{studentId: string, status: string, written: boolean}>} */
  const rows = []
  let ok = 0
  let missing = 0
  let mismatch = 0
  let invalid = 0
  let written = 0
  let writeErrors = 0

  const seenStudentIds = new Set()

  for (const docSnap of studentsSnap.docs) {
    const data = docSnap.data() || {}
    if (data.role === 'admin') continue

    const studentId = docSnap.id
    seenStudentIds.add(studentId)
    const status = classifyAttendanceRosterAgainstSource(
      studentId,
      data,
      rosterById.has(studentId) ? rosterById.get(studentId) : null,
    )

    if (status === 'ROSTER_OK') ok += 1
    else if (status === 'ROSTER_MISSING') missing += 1
    else if (status === 'ROSTER_MISMATCH') mismatch += 1
    else invalid += 1

    let didWrite = false
    if (live && (status === 'ROSTER_MISSING' || status === 'ROSTER_MISMATCH')) {
      const entry = buildAttendanceRosterEntry(studentId, data)
      if (!entry) {
        rows.push({ studentId, status: 'ROSTER_INVALID_SOURCE', written: false })
        continue
      }
      try {
        await db.collection(ATTENDANCE_ROSTER_COLLECTION).doc(studentId).set(entry, { merge: false })
        didWrite = true
        written += 1
      } catch (error) {
        writeErrors += 1
        const msg = error instanceof Error ? error.message : String(error)
        rows.push({ studentId, status: `ROSTER_WRITE_ERROR:${msg}`, written: false })
        continue
      }
    }

    rows.push({ studentId, status, written: didWrite })
  }

  /** @type {string[]} */
  const extras = []
  for (const rosterId of rosterById.keys()) {
    if (!seenStudentIds.has(rosterId)) {
      extras.push(rosterId)
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: live ? 'SYNC-ATTENDANCE-ROSTER' : 'CHECK-ATTENDANCE-ROSTER',
    projectId,
    collection: ATTENDANCE_ROSTER_COLLECTION,
    studentsScanned: seenStudentIds.size,
    ROSTER_OK: ok,
    ROSTER_MISSING: missing,
    ROSTER_MISMATCH: mismatch,
    ROSTER_INVALID_SOURCE: invalid,
    ROSTER_EXTRA: extras.length,
    rosterExtraIds: extras,
    note:
      extras.length > 0
        ? 'ROSTER_EXTRA not auto-deleted in this version; Students CRUD delete sync later.'
        : undefined,
    written,
    writeErrors,
    rows,
  }

  writeFileSync(ATTENDANCE_ROSTER_MANIFEST_PATH, JSON.stringify(summary, null, 2), 'utf8')
  console.log(`[${live ? 'sync' : 'check'}-attendance-roster] students:`, summary.studentsScanned)
  console.log('  ROSTER_OK:', summary.ROSTER_OK)
  console.log('  ROSTER_MISSING:', summary.ROSTER_MISSING)
  console.log('  ROSTER_MISMATCH:', summary.ROSTER_MISMATCH)
  console.log('  ROSTER_INVALID_SOURCE:', summary.ROSTER_INVALID_SOURCE)
  console.log('  ROSTER_EXTRA:', summary.ROSTER_EXTRA)
  if (live) {
    console.log('  written:', written)
    console.log('  writeErrors:', writeErrors)
  }
  console.log(`Manifest written: ${ATTENDANCE_ROSTER_MANIFEST_PATH}`)
  return summary
}

async function runLeaveOwnerPass(admin, projectId, { live }) {
  const db = admin.firestore()
  const [leavesSnap, studentsSnap, usersSnap] = await Promise.all([
    db.collection('evciTalepleri').get(),
    db.collection('ogrenciler').get(),
    db.collection('users').get(),
  ])

  const studentDocs = studentsSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    data: docSnap.data() || {},
  }))
  const studentsByAdSoyad = buildStudentsByAdSoyadIndex(studentDocs)

  /** @type {Map<string, Record<string, unknown>>} */
  const usersByUid = new Map()
  for (const docSnap of usersSnap.docs) {
    usersByUid.set(docSnap.id, docSnap.data() || {})
  }

  /** @type {Record<string, number>} */
  const counts = {
    OWNER_OK: 0,
    OWNER_SAFE_TO_BACKFILL: 0,
    OWNER_AMBIGUOUS: 0,
    OWNER_NOT_FOUND: 0,
    OWNER_IDENTITY_INVALID: 0,
    OWNER_MISMATCH: 0,
  }

  /** @type {Array<ReturnType<typeof toLeaveOwnerManifestRow>>} */
  const rows = []
  let written = 0
  let writeErrors = 0

  for (const docSnap of leavesSnap.docs) {
    const leaveData = docSnap.data() || {}
    const classification = classifyLeaveOwnerRequest({
      leaveRequestId: docSnap.id,
      leaveData,
      studentsByAdSoyad,
      usersByUid,
    })

    counts[classification.status] = (counts[classification.status] || 0) + 1
    rows.push(toLeaveOwnerManifestRow(classification))

    if (live && LEAVE_OWNER_BACKFILL_ELIGIBLE.has(classification.status)) {
      try {
        await db.collection('evciTalepleri').doc(docSnap.id).update({
          ownerUid: classification.expectedOwnerUid,
        })
        written += 1
      } catch (error) {
        writeErrors += 1
        const msg = error instanceof Error ? error.message : String(error)
        console.error(`[backfill-leave-owner] write failed ${docSnap.id}: ${msg}`)
      }
    }
  }

  const manualReviewRequired = rows.filter((row) =>
    isLeaveOwnerManualReview(row.status),
  ).length

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: live ? 'BACKFILL-LEAVE-OWNER' : 'CHECK-LEAVE-OWNER',
    projectId,
    collection: 'evciTalepleri',
    leaveRequestsTotal: leavesSnap.size,
    ...counts,
    manualReviewRequired,
    written,
    writeErrors,
    rows,
  }

  writeFileSync(LEAVE_OWNER_MANIFEST_PATH, JSON.stringify(summary, null, 2), 'utf8')
  console.log(`[${live ? 'backfill' : 'check'}-leave-owner] leave requests:`, summary.leaveRequestsTotal)
  console.log('  OWNER_OK:', summary.OWNER_OK)
  console.log('  OWNER_SAFE_TO_BACKFILL:', summary.OWNER_SAFE_TO_BACKFILL)
  console.log('  OWNER_AMBIGUOUS:', summary.OWNER_AMBIGUOUS)
  console.log('  OWNER_NOT_FOUND:', summary.OWNER_NOT_FOUND)
  console.log('  OWNER_IDENTITY_INVALID:', summary.OWNER_IDENTITY_INVALID)
  console.log('  OWNER_MISMATCH:', summary.OWNER_MISMATCH)
  console.log('  manualReviewRequired:', summary.manualReviewRequired)
  if (live) {
    console.log('  written:', written)
    console.log('  writeErrors:', writeErrors)
  }
  console.log(`Manifest written: ${LEAVE_OWNER_MANIFEST_PATH}`)
  console.log('(sebep, password, token values were never written to console or manifest.)')
  return summary
}

/**
 * READ-ONLY inventory, or live timestamp-only normalize for LEGACY_ISO rows.
 * Never logs detay / names / islem content.
 * @param {{ live: boolean }} options
 */
async function runAuditTimestampPass(admin, projectId, { live }) {
  const db = admin.firestore()
  const Timestamp = admin.firestore.Timestamp
  const snap = await db.collection(AUDIT_LOG_COLLECTION).get()

  /** @type {Record<string, number>} */
  const counts = {
    [AUDIT_TIMESTAMP_STATUS.OK]: 0,
    [AUDIT_TIMESTAMP_STATUS.LEGACY_ISO]: 0,
    [AUDIT_TIMESTAMP_STATUS.INVALID]: 0,
    [AUDIT_TIMESTAMP_STATUS.MISSING]: 0,
  }

  /** @type {Array<ReturnType<typeof toAuditTimestampManifestRow>>} */
  const rows = []
  let written = 0
  let writeErrors = 0
  let skippedAlreadyOk = 0

  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {}
    const classified = classifyAuditTimestamp(data)
    counts[classified.status] = (counts[classified.status] || 0) + 1
    rows.push(
      toAuditTimestampManifestRow({
        docId: docSnap.id,
        status: classified.status,
        parsedIso: classified.parsedIso,
      }),
    )

    if (classified.status === AUDIT_TIMESTAMP_STATUS.OK) {
      skippedAlreadyOk += 1
    }

    if (!live || !shouldNormalizeAuditTimestamp(classified.status)) continue

    const instant = parseLegacyIsoInstant(data.timestamp)
    if (!instant) {
      writeErrors += 1
      console.error(`[normalize-audit-timestamps] parse failed ${docSnap.id}: not eligible ISO`)
      continue
    }

    const update = buildAuditTimestampNormalizeUpdate(Timestamp.fromDate(instant))
    if (!isTimestampOnlyUpdate(update)) {
      writeErrors += 1
      console.error(`[normalize-audit-timestamps] payload guard failed ${docSnap.id}`)
      continue
    }

    try {
      await db.collection(AUDIT_LOG_COLLECTION).doc(docSnap.id).update(update)
      written += 1
    } catch (error) {
      writeErrors += 1
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[normalize-audit-timestamps] write failed ${docSnap.id}: ${msg}`)
    }
  }

  const manualReviewRequired = rows.filter((row) =>
    isAuditTimestampManualReview(row.timestampStatus),
  ).length
  const normalizeEligible = counts[AUDIT_TIMESTAMP_STATUS.LEGACY_ISO]

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: live ? 'NORMALIZE-AUDIT-TIMESTAMPS' : 'CHECK-AUDIT-TIMESTAMPS',
    projectId,
    collection: AUDIT_LOG_COLLECTION,
    logsTotal: snap.size,
    AUDIT_TIMESTAMP_OK: counts[AUDIT_TIMESTAMP_STATUS.OK],
    AUDIT_TIMESTAMP_LEGACY_ISO: counts[AUDIT_TIMESTAMP_STATUS.LEGACY_ISO],
    AUDIT_TIMESTAMP_INVALID: counts[AUDIT_TIMESTAMP_STATUS.INVALID],
    AUDIT_TIMESTAMP_MISSING: counts[AUDIT_TIMESTAMP_STATUS.MISSING],
    manualReviewRequired,
    normalizeEligible,
    skippedAlreadyOk,
    written,
    writeErrors,
    rows,
  }

  assertNoSensitiveAuditFields(summary)
  writeFileSync(AUDIT_TIMESTAMP_MANIFEST_PATH, JSON.stringify(summary, null, 2), 'utf8')
  console.log(`[${live ? 'normalize' : 'check'}-audit-timestamps] logs total:`, summary.logsTotal)
  console.log('  AUDIT_TIMESTAMP_OK:', summary.AUDIT_TIMESTAMP_OK)
  console.log('  AUDIT_TIMESTAMP_LEGACY_ISO:', summary.AUDIT_TIMESTAMP_LEGACY_ISO)
  console.log('  AUDIT_TIMESTAMP_INVALID:', summary.AUDIT_TIMESTAMP_INVALID)
  console.log('  AUDIT_TIMESTAMP_MISSING:', summary.AUDIT_TIMESTAMP_MISSING)
  console.log('  manualReviewRequired:', summary.manualReviewRequired)
  console.log('  normalizeEligible:', summary.normalizeEligible)
  if (live) {
    console.log('  written:', written)
    console.log('  skippedAlreadyOk:', skippedAlreadyOk)
    console.log('  writeErrors:', writeErrors)
  }
  console.log(`Manifest written: ${AUDIT_TIMESTAMP_MANIFEST_PATH}`)
  console.log('(detay, names, and timestamp values were never written to console or manifest.)')
  return summary
}

async function confirmNormalizeAuditTimestamps(projectId) {
  console.log('')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('  LIVE FIRESTORE DATA WILL BE MODIFIED')
  console.log(`  TARGET PROJECT: ${projectId}`)
  console.log('  - Writes ONLY islem_loglari/{id}.timestamp')
  console.log('  - Only AUDIT_TIMESTAMP_LEGACY_ISO rows')
  console.log('  - Converts ISO string → Firestore Timestamp (same instant)')
  console.log('  - AUDIT_TIMESTAMP_OK is no-op (idempotent)')
  console.log('  - INVALID / MISSING are never auto-fixed')
  console.log('  - Does NOT touch detay, islem, actorUid, yapan, rol')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('')

  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question(`Type the project ID ("${projectId}") to continue: `)
    if (answer.trim() !== projectId) {
      throw new Error('Project confirmation mismatch — aborting without timestamp writes.')
    }
  } finally {
    rl.close()
  }
}

async function confirmBackfillLeaveOwner(projectId) {
  console.log('')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('  LIVE FIRESTORE DATA WILL BE MODIFIED')
  console.log(`  TARGET PROJECT: ${projectId}`)
  console.log('  - Writes ONLY evciTalepleri/{id}.ownerUid')
  console.log('  - Only OWNER_SAFE_TO_BACKFILL rows')
  console.log('  - OWNER_AMBIGUOUS / NOT_FOUND / INVALID / MISMATCH are never auto-fixed')
  console.log('  - Does NOT touch ogrenciler, users, Auth, or other leave fields')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('')

  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question(`Type the project ID ("${projectId}") to continue: `)
    if (answer.trim() !== projectId) {
      throw new Error('Project confirmation mismatch — aborting without writes.')
    }
  } finally {
    rl.close()
  }
}

async function confirmCleanupStudentPasswords(projectId) {
  console.log('')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('  LIVE FIRESTORE DATA WILL BE MODIFIED')
  console.log(`  TARGET PROJECT: ${projectId}`)
  console.log('  - Deletes ONLY ogrenciler/{id}.password via FieldValue.delete()')
  console.log('  - Only fully bound student identity candidates')
  console.log('  - Does NOT touch Auth, users profiles, grades, ownerUid')
  console.log('  - Password VALUES are never logged or written to manifest')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('')

  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question(`Type the project ID ("${projectId}") to continue: `)
    if (answer.trim() !== projectId) {
      throw new Error('Project confirmation mismatch — aborting without password cleanup.')
    }
  } finally {
    rl.close()
  }
}

/**
 * Inventory / optional live cleanup of ogrenciler.password (value never logged).
 * @param {{ live: boolean }} options
 */
async function runStudentPasswordPass(admin, projectId, { live }) {
  const db = admin.firestore()
  const FieldValue = admin.firestore.FieldValue
  const snap = await db.collection('ogrenciler').get()

  /** @type {Array<{studentDocId: string, status: string, passwordPresent: boolean, cleaned: boolean, reason?: string, timestamp: string}>} */
  const rows = []
  let safe = 0
  let absent = 0
  let review = 0
  let cleaned = 0
  let cleanErrors = 0

  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {}
    const ownerUid = typeof data.ownerUid === 'string' ? data.ownerUid.trim() : ''
    let usersProfile = null
    if (ownerUid) {
      const userSnap = await db.collection('users').doc(ownerUid).get()
      usersProfile = userSnap.exists ? userSnap.data() : null
    }

    const classification = classifyPasswordCleanupEligibility({
      studentDocId: docSnap.id,
      studentData: data,
      usersProfile,
    })

    if (classification.status === 'PASSWORD_PRESENT_SAFE_TO_CLEAN') safe += 1
    else if (classification.status === 'PASSWORD_ALREADY_ABSENT') absent += 1
    else review += 1

    let didClean = false
    if (live && classification.eligible) {
      try {
        await docSnap.ref.update({ password: FieldValue.delete() })
        didClean = true
        cleaned += 1
      } catch (error) {
        cleanErrors += 1
        const msg = error instanceof Error ? error.message : String(error)
        rows.push({
          studentDocId: docSnap.id,
          status: 'PASSWORD_CLEAN_ERROR',
          passwordPresent: true,
          cleaned: false,
          reason: msg,
          timestamp: new Date().toISOString(),
        })
        continue
      }
    }

    rows.push({
      studentDocId: docSnap.id,
      status: classification.status,
      passwordPresent: classification.passwordPresent,
      cleaned: didClean,
      reason: classification.reason,
      timestamp: new Date().toISOString(),
    })
  }

  // Post-pass verification (re-read presence only; never values)
  let verifyPresent = 0
  let verifyReview = 0
  let verifyAbsent = 0
  const verifySnap = await db.collection('ogrenciler').get()
  for (const docSnap of verifySnap.docs) {
    const data = docSnap.data() || {}
    const ownerUid = typeof data.ownerUid === 'string' ? data.ownerUid.trim() : ''
    let usersProfile = null
    if (ownerUid) {
      const userSnap = await db.collection('users').doc(ownerUid).get()
      usersProfile = userSnap.exists ? userSnap.data() : null
    }
    const v = classifyPasswordCleanupEligibility({
      studentDocId: docSnap.id,
      studentData: data,
      usersProfile,
    })
    if (v.status === 'PASSWORD_ALREADY_ABSENT') verifyAbsent += 1
    else if (v.status === 'PASSWORD_MANUAL_REVIEW') verifyReview += 1
    else if (v.status === 'PASSWORD_PRESENT_SAFE_TO_CLEAN') verifyPresent += 1
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: live ? 'CLEANUP-STUDENT-PASSWORDS' : 'CHECK-STUDENT-PASSWORDS',
    projectId,
    students: snap.size,
    PASSWORD_PRESENT_SAFE_TO_CLEAN: safe,
    PASSWORD_ALREADY_ABSENT: absent,
    PASSWORD_MANUAL_REVIEW: review,
    cleaned,
    cleanErrors,
    postVerification: {
      students: verifySnap.size,
      PASSWORD_PRESENT_SAFE_TO_CLEAN: verifyPresent,
      PASSWORD_ALREADY_ABSENT: verifyAbsent,
      PASSWORD_MANUAL_REVIEW: verifyReview,
      PASSWORD_PRESENT_TOTAL: verifyPresent + verifyReview,
    },
    rows,
  }

  writeFileSync(PASSWORD_CLEANUP_MANIFEST_PATH, JSON.stringify(summary, null, 2), 'utf8')
  console.log(`[${live ? 'cleanup' : 'check'}-student-passwords] students:`, summary.students)
  console.log('  PASSWORD_PRESENT_SAFE_TO_CLEAN:', summary.PASSWORD_PRESENT_SAFE_TO_CLEAN)
  console.log('  PASSWORD_ALREADY_ABSENT:', summary.PASSWORD_ALREADY_ABSENT)
  console.log('  PASSWORD_MANUAL_REVIEW:', summary.PASSWORD_MANUAL_REVIEW)
  if (live) {
    console.log('  cleaned:', cleaned)
    console.log('  cleanErrors:', cleanErrors)
  }
  console.log('  postVerification PASSWORD_PRESENT_TOTAL:', summary.postVerification.PASSWORD_PRESENT_TOTAL)
  console.log('  postVerification PASSWORD_MANUAL_REVIEW:', summary.postVerification.PASSWORD_MANUAL_REVIEW)
  console.log(`Manifest written: ${PASSWORD_CLEANUP_MANIFEST_PATH}`)
  console.log('(Password VALUES were never written to console or manifest.)')
  return summary
}

async function confirmApply(projectId) {
  console.log('')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('  LIVE FIREBASE DATA WILL BE MODIFIED')
  console.log(`  Target Firebase Project: ${projectId}`)
  console.log('  - May create Auth users')
  console.log('  - May write users/{uid}')
  console.log('  - May set ownerUid on ogrenciler docs')
  console.log('  - Will NEVER modify legacy password fields')
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('')

  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question(`Type the project ID ("${projectId}") to continue: `)
    if (answer.trim() !== projectId) {
      throw new Error('Project confirmation mismatch — aborting without writes.')
    }
  } finally {
    rl.close()
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  if (opts.help) {
    printHelp()
    return
  }

  if (opts.selfTest) {
    runSelfTest()
    return
  }

  const writeModeRejection = rejectLiveWriteModeFlags(opts)
  if (writeModeRejection === 'multiple_write_modes') {
    console.error(
      'Only one exclusive mode allowed per run (--apply-owner-uid | --provision-student | --cleanup-student-passwords | --cleanup-graduate-password | --cleanup-admin-passwords | --rotate-graduate-password | --sync-attendance-roster | --backfill-leave-owner | --normalize-audit-timestamps | --check-*).',
    )
    process.exitCode = 1
    return
  }
  if (writeModeRejection === 'generic_apply_disabled') {
    console.error(
      'Generic apply is disabled. Use explicit provisioning/backfill/cleanup/roster modes.',
    )
    console.error(
      'Allowed write modes: --apply-owner-uid | --provision-student=<id> | --cleanup-student-passwords | --cleanup-graduate-password | --cleanup-admin-passwords | --rotate-graduate-password | --sync-attendance-roster | --backfill-leave-owner | --normalize-audit-timestamps',
    )
    process.exitCode = 1
    return
  }

  if (!opts.project) {
    console.error('Missing --project=<firebase-project-id>')
    printHelp()
    process.exitCode = 1
    return
  }

  if (
    (opts.applyOwnerUid ||
      opts.provisionStudentId ||
      opts.cleanupStudentPasswords ||
      opts.cleanupGraduatePassword ||
      opts.cleanupAdminPasswords ||
      opts.rotateGraduatePassword ||
      opts.syncAttendanceRoster ||
      opts.backfillLeaveOwner ||
      opts.normalizeAuditTimestamps) &&
    !isLiveWriteProjectAllowed(opts.project)
  ) {
    console.error(
      `[migrate:auth] live write ops only allowed for --project=${OWNER_BACKFILL_ALLOWED_PROJECT}`,
    )
    console.error(`Received: ${opts.project}`)
    process.exitCode = 1
    return
  }

  if (opts.collection && !COLLECTIONS.includes(opts.collection)) {
    throw new Error(`Invalid --collection. Use: ${COLLECTIONS.join(' | ')}`)
  }

  const mode = opts.rotateGraduatePassword
    ? 'ROTATE-GRADUATE-PASSWORD'
    : opts.cleanupGraduatePassword
      ? 'CLEANUP-GRADUATE-PASSWORD'
      : opts.cleanupAdminPasswords
        ? 'CLEANUP-ADMIN-PASSWORDS'
        : opts.checkAdminAuth
          ? 'CHECK-ADMIN-AUTH'
          : opts.checkGraduateAuth
        ? 'CHECK-GRADUATE-AUTH'
        : opts.backfillLeaveOwner
    ? 'BACKFILL-LEAVE-OWNER'
    : opts.normalizeAuditTimestamps
      ? 'NORMALIZE-AUDIT-TIMESTAMPS'
      : opts.checkAuditTimestamps
        ? 'CHECK-AUDIT-TIMESTAMPS'
        : opts.checkLeaveOwner
      ? 'CHECK-LEAVE-OWNER'
      : opts.syncAttendanceRoster
    ? 'SYNC-ATTENDANCE-ROSTER'
    : opts.checkAttendanceRoster
      ? 'CHECK-ATTENDANCE-ROSTER'
      : opts.cleanupStudentPasswords
        ? 'CLEANUP-STUDENT-PASSWORDS'
        : opts.checkStudentPasswords
          ? 'CHECK-STUDENT-PASSWORDS'
          : opts.provisionStudentId
            ? 'PROVISION-STUDENT'
            : opts.applyOwnerUid
              ? 'APPLY-OWNER-UID'
              : 'DRY-RUN'
  console.log('=== Legacy Auth Migration ===')
  console.log(`Mode: ${mode}`)
  console.log(`Target Firebase Project: ${opts.project}`)
  if (opts.provisionStudentId) console.log(`Provision student doc: ${opts.provisionStudentId}`)
  if (opts.collection) console.log(`Collection filter: ${opts.collection}`)
  if (opts.limit) console.log(`Limit: ${opts.limit}`)
  console.log('')

  assertCredentialsHint()

  const admin = loadAdmin()

  if (admin.apps.length === 0) {
    try {
      const credential = admin.credential.applicationDefault()
      admin.initializeApp({
        credential,
        projectId: opts.project,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[migrate:auth] Failed to initialize Admin SDK / credentials.')
      console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON path.')
      console.error('Do NOT paste the JSON into chat or commit it to git.')
      console.error(msg)
      process.exitCode = 1
      return
    }
  }

  const appProject =
    admin.app().options.projectId ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    null

  if (appProject && appProject !== opts.project) {
    throw new Error(
      `Credential project (${appProject}) does not match --project=${opts.project}`,
    )
  }

  if (opts.checkGraduateAuth) {
    await checkGraduateAuth(admin, opts.project)
    return
  }

  if (opts.checkAdminAuth) {
    await runAdminAuthPass(admin, opts.project, { live: false })
    return
  }

  if (opts.cleanupAdminPasswords) {
    await confirmCleanupAdminPasswords(opts.project)
    await runAdminAuthPass(admin, opts.project, { live: true })
    return
  }

  if (opts.cleanupGraduatePassword) {
    await cleanupGraduatePassword(admin, opts.project)
    return
  }

  if (opts.rotateGraduatePassword) {
    await rotateGraduatePassword(admin, opts.project)
    return
  }

  if (opts.checkStudentPasswords) {
    await runStudentPasswordPass(admin, opts.project, { live: false })
    return
  }

  if (opts.cleanupStudentPasswords) {
    await confirmCleanupStudentPasswords(opts.project)
    await runStudentPasswordPass(admin, opts.project, { live: true })
    return
  }

  if (opts.checkAttendanceRoster) {
    await runAttendanceRosterPass(admin, opts.project, { live: false })
    return
  }

  if (opts.syncAttendanceRoster) {
    await confirmSyncAttendanceRoster(opts.project)
    await runAttendanceRosterPass(admin, opts.project, { live: true })
    return
  }

  if (opts.checkLeaveOwner) {
    await runLeaveOwnerPass(admin, opts.project, { live: false })
    return
  }

  if (opts.backfillLeaveOwner) {
    await confirmBackfillLeaveOwner(opts.project)
    await runLeaveOwnerPass(admin, opts.project, { live: true })
    return
  }

  if (opts.checkAuditTimestamps) {
    await runAuditTimestampPass(admin, opts.project, { live: false })
    return
  }

  if (opts.normalizeAuditTimestamps) {
    await confirmNormalizeAuditTimestamps(opts.project)
    await runAuditTimestampPass(admin, opts.project, { live: true })
    return
  }

  if (opts.applyOwnerUid) {
    await confirmApplyOwnerUid(opts.project)
  }

  if (opts.provisionStudentId) {
    await confirmProvisionStudent(opts.project, opts.provisionStudentId)

    try {
      const result = await provisionSingleStudent(admin, opts.project, opts.provisionStudentId)
      console.log('[provision-student] status:', result.status)
      console.log('[provision-student] uid:', result.uid)
      console.log('[provision-student] legacyDocId:', result.legacyDocId)
      console.log('[provision-student] createdAuthUser:', result.createdAuthUser)
      if (result.syncedRosterAttendance) {
        console.log(
          '[provision-student] synced ogrenciler.canManageAttendance ← users (canonical)',
        )
      }

      const manifest = {
        generatedAt: new Date().toISOString(),
        mode,
        projectId: opts.project,
        provisionStudent: {
          legacyDocId: result.legacyDocId,
          uid: result.uid,
          status: result.status,
          createdAuthUser: result.createdAuthUser,
          // Never include temporaryPassword in manifest.
        },
      }
      writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')
      console.log(`Manifest written: ${MANIFEST_PATH}`)

      if (result.createdAuthUser) {
        console.log(
          `Credentials updated (PENDING→READY) in gitignored file: ${CREDENTIALS_OUT_PATH}`,
        )
        console.log('Delete it after secure offline delivery to the student.')
      } else {
        console.log('No new temporary password (already provisioned / reconciled).')
      }
    } catch (error) {
      console.error(
        '[provision-student] failed:',
        error instanceof Error ? error.message : error,
      )
      process.exitCode = 1
    }
    return
  }

  const db = admin.firestore()
  const auth = admin.auth()

  const targetCollections = opts.collection ? [opts.collection] : [...COLLECTIONS]

  /** @type {Array<{collection: string, id: string, username: string, email: string|null, data: Record<string, unknown>, ref: string}>} */
  const loaded = []

  try {
    for (const collection of targetCollections) {
      const snap = await db.collection(collection).get()
      for (const docSnap of snap.docs) {
        const data = docSnap.data() || {}
        const username = typeof data.username === 'string' ? data.username.trim() : ''
        const emailTry = username ? tryToAuthEmail(username) : { ok: false, error: 'missing_username' }
        loaded.push({
          collection,
          id: docSnap.id,
          username,
          email: emailTry.ok ? emailTry.email : null,
          data,
          ref: safeRef(collection, docSnap.id, username),
        })
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[migrate:auth] Failed reading Firestore (credentials/project?).')
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON path.')
    console.error(msg)
    process.exitCode = 1
    return
  }

  /** @type {Map<string, Array<{ uid: string, data: Record<string, unknown> }>>} */
  let studentUsersByLegacyDocId = new Map()
  try {
    studentUsersByLegacyDocId = await loadStudentUsersByLegacyDocId(db)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[migrate:auth] Failed indexing users for ownership parity.')
    console.error(msg)
    process.exitCode = 1
    return
  }

  const { collisionKeys, notes: collisionNotes } = detectCollisions(loaded)

  /** @type {object[]} */
  const results = []
  /** @type {Array<{username: string, temporaryPassword: string, collection: string, legacyDocId: string, email: string}>} */
  const credentialRows = []

  let processed = 0

  for (const rec of loaded) {
    if (opts.limit && processed >= opts.limit) break
    processed += 1

    const role = expectedRole(rec.collection)
    const base = {
      legacyCollection: rec.collection,
      legacyDocId: rec.id,
      ref: rec.ref,
      role,
      status: STATUS.READY,
      createdAuthUser: false,
      createdProfile: false,
      addedOwnerUid: false,
      uid: null,
      reasons: /** @type {string[]} */ ([]),
    }

    try {
      if (!rec.username) {
        results.push({ ...base, status: STATUS.INVALID_RECORD, reasons: ['missing_username'] })
        continue
      }

      const password = rec.data.password
      if (typeof password !== 'string' || !password.trim()) {
        results.push({ ...base, status: STATUS.INVALID_RECORD, reasons: ['missing_password'] })
        continue
      }

      if (isReservedUsername(rec.username)) {
        results.push({ ...base, status: STATUS.RESERVED, reasons: ['reserved_identity'] })
        continue
      }

      if (!rec.email) {
        results.push({ ...base, status: STATUS.INVALID_RECORD, reasons: ['invalid_username_email'] })
        continue
      }

      if (collisionKeys.has(`${rec.collection}/${rec.id}`)) {
        results.push({ ...base, status: STATUS.COLLISION, reasons: ['username_or_email_collision'] })
        continue
      }

      // Auth lookup
      let authUser = null
      try {
        authUser = await auth.getUserByEmail(rec.email)
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
        if (code !== 'auth/user-not-found') {
          results.push({
            ...base,
            status: STATUS.ERROR,
            reasons: [`auth_lookup_failed:${code || 'unknown'}`],
          })
          continue
        }
      }

      if (authUser) {
        const profileSnap = await db.collection('users').doc(authUser.uid).get()
        const profile = profileSnap.exists ? profileSnap.data() : null
        const match = classifyProfileMatch(profile, rec.collection, rec.id, rec.username, role)

        if (match.kind === 'already') {
          const needsOwner =
            rec.collection === 'ogrenciler' &&
            (!Object.prototype.hasOwnProperty.call(rec.data, 'ownerUid') ||
              rec.data.ownerUid !== authUser.uid)

          if (opts.apply && needsOwner) {
            await db.collection('ogrenciler').doc(rec.id).set({ ownerUid: authUser.uid }, { merge: true })
            results.push({
              ...base,
              status: STATUS.APPLIED,
              uid: authUser.uid,
              addedOwnerUid: true,
              reasons: ['already_migrated_ownerUid_backfill'],
            })
          } else {
            results.push({
              ...base,
              status: STATUS.ALREADY_MIGRATED,
              uid: authUser.uid,
              reasons: needsOwner ? ['already_migrated_ownerUid_pending'] : ['already_migrated'],
            })
          }
          continue
        }

        if (match.kind === 'safe_existing') {
          if (opts.apply) {
            const now = new Date().toISOString()
            const profilePayload = stripUndefined({
              uid: authUser.uid,
              username: rec.username,
              adSoyad: typeof rec.data.adSoyad === 'string' ? rec.data.adSoyad : rec.username,
              role,
              legacyCollection: rec.collection,
              legacyDocId: rec.id,
              canManageAttendance:
                role === 'admin' ? true : rec.data.canManageAttendance === true,
              ...(role === 'student'
                ? {
                    bolum: rec.data.bolum,
                    sinif: rec.data.sinif,
                    odaNo: rec.data.odaNo,
                    donem: rec.data.donem,
                  }
                : {}),
              updatedAt: now,
              ...(profileSnap.exists ? {} : { createdAt: now }),
            })
            await db.collection('users').doc(authUser.uid).set(profilePayload, { merge: true })
            let addedOwnerUid = false
            if (rec.collection === 'ogrenciler') {
              await db.collection('ogrenciler').doc(rec.id).set({ ownerUid: authUser.uid }, { merge: true })
              addedOwnerUid = true
            }
            results.push({
              ...base,
              status: STATUS.APPLIED,
              uid: authUser.uid,
              createdProfile: true,
              addedOwnerUid,
              reasons: ['safe_existing_linked'],
            })
          } else {
            results.push({
              ...base,
              status: STATUS.SAFE_EXISTING,
              uid: authUser.uid,
              reasons: ['auth_exists_safe_to_link'],
            })
          }
          continue
        }

        results.push({
          ...base,
          status: STATUS.MANUAL_REVIEW,
          uid: authUser.uid,
          reasons: ['existing_auth_identity_conflict'],
        })
        continue
      }

      // No Auth user → READY for new provisioning
      if (!opts.apply) {
        results.push({
          ...base,
          status: STATUS.READY,
          reasons: ['would_create_auth_and_profile'],
        })
        continue
      }

      // APPLY: create Auth + profile (+ ownerUid for students)
      const temporaryPassword = generateTemporaryPassword()
      const created = await auth.createUser({
        email: rec.email,
        password: temporaryPassword,
        emailVerified: false,
        disabled: false,
      })

      const now = new Date().toISOString()
      const profilePayload = stripUndefined({
        uid: created.uid,
        username: rec.username,
        adSoyad: typeof rec.data.adSoyad === 'string' ? rec.data.adSoyad : rec.username,
        role,
        legacyCollection: rec.collection,
        legacyDocId: rec.id,
        canManageAttendance: role === 'admin' ? true : rec.data.canManageAttendance === true,
        ...(role === 'student'
          ? {
              bolum: rec.data.bolum,
              sinif: rec.data.sinif,
              odaNo: rec.data.odaNo,
              donem: rec.data.donem,
            }
          : {}),
        createdAt: now,
        updatedAt: now,
      })

      await db.collection('users').doc(created.uid).set(profilePayload, { merge: true })

      let addedOwnerUid = false
      if (rec.collection === 'ogrenciler') {
        await db.collection('ogrenciler').doc(rec.id).set({ ownerUid: created.uid }, { merge: true })
        addedOwnerUid = true
      }

      credentialRows.push({
        username: rec.username,
        temporaryPassword,
        collection: rec.collection,
        legacyDocId: rec.id,
        email: rec.email,
      })

      results.push({
        ...base,
        status: STATUS.APPLIED,
        uid: created.uid,
        createdAuthUser: true,
        createdProfile: true,
        addedOwnerUid,
        reasons: ['created_auth_profile'],
      })
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
      // Race: email created concurrently → do not reset password; mark review
      if (code === 'auth/email-already-exists') {
        results.push({
          ...base,
          status: STATUS.MANUAL_REVIEW,
          reasons: ['auth_create_race_email_exists'],
        })
        continue
      }
      results.push({
        ...base,
        status: STATUS.ERROR,
        reasons: [`exception:${code || (error instanceof Error ? error.message : 'unknown')}`],
      })
    }
  }

  // S4.1/S4.2: ownership + attendance parity (students only; write only with --apply-owner-uid)
  const loadedByKey = new Map(loaded.map((l) => [`${l.collection}/${l.id}`, l]))
  for (let i = 0; i < results.length; i += 1) {
    const row = results[i]
    if (row.legacyCollection !== 'ogrenciler') continue
    const rec = loadedByKey.get(`${row.legacyCollection}/${row.legacyDocId}`)
    if (!rec) continue
    results[i] = enrichStudentOwnershipParity(rec, row, studentUsersByLegacyDocId)
  }

  /** @type {object|null} */
  let ownerUidApplySummary = null

  if (opts.applyOwnerUid) {
    const candidates = results.filter((r) => isEligibleOwnerBackfill(r))
    console.log(
      `[apply-owner-uid] Eligible OWNER_MISSING candidates in this run: ${candidates.length}`,
    )

    const outcomes = await applyOwnerUidBackfill(db, candidates)
    const byDocId = new Map(outcomes.map((o) => [o.legacyDocId, o]))
    for (let i = 0; i < results.length; i += 1) {
      const row = results[i]
      if (row.legacyCollection !== 'ogrenciler') continue
      const updated = byDocId.get(row.legacyDocId)
      if (updated) results[i] = updated
    }

    ownerUidApplySummary = {
      attempted: outcomes.length,
      applied: outcomes.filter((o) => o.ownerUidApplied === true).length,
      alreadyOk: outcomes.filter((o) => o.ownerApplyStatus === 'OWNER_ALREADY_OK').length,
      manualReview: outcomes.filter((o) => o.ownerApplyStatus === 'MANUAL_REVIEW').length,
      errors: outcomes.filter((o) => o.ownerApplyStatus === 'ERROR').length,
      skippedNotEligible: outcomes.filter((o) => o.ownerApplyStatus === 'SKIPPED_NOT_ELIGIBLE')
        .length,
    }

    console.log('[apply-owner-uid] outcome:', ownerUidApplySummary)
  }

  // Summaries (no passwords)
  function summarize(collection) {
    const rows = results.filter((r) => r.legacyCollection === collection)
    const count = (status) => rows.filter((r) => r.status === status).length
    return {
      totalLoaded: loaded.filter((l) => l.collection === collection).length,
      processed: rows.length,
      READY: count(STATUS.READY),
      ALREADY_MIGRATED: count(STATUS.ALREADY_MIGRATED),
      SAFE_EXISTING: count(STATUS.SAFE_EXISTING),
      MANUAL_REVIEW: count(STATUS.MANUAL_REVIEW),
      INVALID_RECORD: count(STATUS.INVALID_RECORD),
      RESERVED: count(STATUS.RESERVED),
      COLLISION: count(STATUS.COLLISION),
      ERROR: count(STATUS.ERROR),
      APPLIED: count(STATUS.APPLIED),
    }
  }

  function summarizeOwnership() {
    const rows = results.filter((r) => r.legacyCollection === 'ogrenciler')
    const count = (status) => rows.filter((r) => r.ownerStatus === status).length
    const verifiedBindings = rows.filter(
      (r) => r.expectedOwnerUid && r.ownerStatus && r.ownerStatus !== 'OWNER_AMBIGUOUS',
    ).length
    const safeBackfill = rows.filter((r) => r.safeOwnerBackfillCandidate === true).length
    const permissionOk = rows.filter((r) => r.permissionStatus === 'PERMISSION_OK').length
    const permissionMismatch = rows.filter((r) => r.permissionStatus === 'PERMISSION_MISMATCH').length
    const mismatchLegacyTrue = rows.filter(
      (r) => r.permissionDetail && r.permissionDetail.legacy === true && r.permissionDetail.users === false,
    ).length
    const mismatchUsersTrue = rows.filter(
      (r) => r.permissionDetail && r.permissionDetail.legacy === false && r.permissionDetail.users === true,
    ).length

    return {
      studentsTotal: rows.length,
      verifiedIdentityBindings: verifiedBindings,
      ownerUid: {
        OWNER_OK: count('OWNER_OK'),
        OWNER_MISSING: count('OWNER_MISSING'),
        OWNER_MISMATCH: count('OWNER_MISMATCH'),
        OWNER_AMBIGUOUS: count('OWNER_AMBIGUOUS'),
      },
      canManageAttendance: {
        PERMISSION_OK: permissionOk,
        PERMISSION_MISMATCH: permissionMismatch,
        mismatchLegacyTrueUsersFalse: mismatchLegacyTrue,
        mismatchLegacyFalseUsersTrue: mismatchUsersTrue,
        canonicalSource: 'users/{uid}.canManageAttendance',
      },
      safeOwnerUidBackfillCandidates: safeBackfill,
    }
  }

  const ownership = summarizeOwnership()

  const summary = {
    mode,
    projectId: opts.project,
    generatedAt: new Date().toISOString(),
    students: summarize('ogrenciler'),
    admins: summarize('yoneticiler'),
    collisionNoteCount: collisionNotes.length,
    ownership,
    ownerUidApplySummary,
  }

  console.log('--- Summary ---')
  console.log('Students:', summary.students)
  console.log('Admins:', summary.admins)
  console.log('Collision signals:', collisionNotes.length)
  if (collisionNotes.length) {
    console.log(
      'Collision note refs (no usernames/emails):',
      collisionNotes.slice(0, 20).join(' | '),
      collisionNotes.length > 20 ? `...(+${collisionNotes.length - 20})` : '',
    )
  }

  console.log('--- Ownership / attendance parity (students, dry-run) ---')
  console.log(`Students total: ${ownership.studentsTotal}`)
  console.log(`Verified identity bindings: ${ownership.verifiedIdentityBindings}`)
  console.log('ownerUid:', ownership.ownerUid)
  console.log('canManageAttendance:', ownership.canManageAttendance)
  console.log(
    `Safe ownerUid backfill candidates (OWNER_MISSING + verified): ${ownership.safeOwnerUidBackfillCandidates}`,
  )
  console.log(
    'Note: canonical attendance permission source for future sync is users/{uid}.canManageAttendance (no write in S4.1).',
  )

  const manifest = {
    generatedAt: summary.generatedAt,
    mode,
    projectId: opts.project,
    summary,
    // Safe per-record entries (no passwords)
    records: results.map((r) => ({
      legacyCollection: r.legacyCollection,
      legacyDocId: r.legacyDocId,
      ref: r.ref,
      resultingUid: r.uid,
      status: r.status,
      createdAuthUser: r.createdAuthUser,
      createdProfile: r.createdProfile,
      addedOwnerUid: r.addedOwnerUid,
      reasons: r.reasons,
      expectedOwnerUid: r.expectedOwnerUid ?? null,
      ownerStatus: r.ownerStatus ?? null,
      permissionStatus: r.permissionStatus ?? null,
      permissionDetail: r.permissionDetail ?? null,
      safeOwnerBackfillCandidate: r.safeOwnerBackfillCandidate === true,
      ownerUidApplied: r.ownerUidApplied === true,
      ownerApplyStatus: r.ownerApplyStatus ?? null,
      ownerUidPreviousState: r.ownerUidPreviousState ?? null,
      resultingOwnerUid: r.resultingOwnerUid ?? r.expectedOwnerUid ?? null,
      ownerAppliedAt: r.ownerAppliedAt ?? null,
    })),
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8')
  console.log(`Manifest written: ${MANIFEST_PATH}`)
  console.log('(gitignored via migration-*.local.json)')

  if (opts.apply && credentialRows.length > 0) {
    writeFileSync(
      CREDENTIALS_OUT_PATH,
      JSON.stringify(
        {
          warning:
            'SENSITIVE temporary passwords. Deliver offline, then delete this file. Never commit.',
          generatedAt: summary.generatedAt,
          projectId: opts.project,
          users: credentialRows,
        },
        null,
        2,
      ),
      'utf8',
    )
    console.log(`Credentials file written: ${CREDENTIALS_OUT_PATH}`)
    console.log('Delete it after secure delivery to users.')
  } else if (opts.apply) {
    console.log('No new temporary credentials file (no new Auth users created).')
  }

  console.log('')
  console.log('Security reminders:')
  console.log('- Do not share service account JSON with ChatGPT/Cursor/Codex or commit it.')
  console.log('- Rotate/revoke the service account key after migration.')
  console.log('- Legacy plaintext passwords were NOT modified (S6 cleanup later).')
  if (!opts.apply && !opts.applyOwnerUid) {
    console.log('- This was DRY-RUN: no Auth/Firestore writes were performed.')
  }
  if (opts.applyOwnerUid) {
    console.log('- ownerUid backfill mode: only ogrenciler.ownerUid field patches were attempted.')
  }
}

main().catch((error) => {
  console.error('[migrate:auth] fatal:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
