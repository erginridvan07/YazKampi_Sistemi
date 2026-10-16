#!/usr/bin/env node
/**
 * Local-only student account manager.
 *
 * This utility intentionally runs on 127.0.0.1 and uses Firebase Admin SDK
 * credentials from the administrator's own computer. It must never be
 * deployed to Firebase Hosting or exposed on a LAN/public interface.
 */
import { createRequire } from 'node:module'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { isReservedUsername, tryToAuthEmail } from '../shared/authIdentity.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PROJECT_ID = 'yurtyonetimsistemi'
const HOST = '127.0.0.1'
const PORT = Number(process.env.STUDENT_ACCOUNT_MANAGER_PORT || 47831)
const SESSION_COOKIE = 'student_account_manager_session'
const LOCAL_AUDIT_PATH = join(ROOT, 'student-account-manager.local.json')
const FUNCTIONS_REQUIRE = createRequire(join(ROOT, 'functions', 'package.json'))

if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) {
  throw new Error('STUDENT_ACCOUNT_MANAGER_PORT 1024 ile 65535 arasında olmalıdır.')
}

if (!existsSync(join(ROOT, 'functions', 'node_modules', 'firebase-admin'))) {
  throw new Error('Firebase Admin SDK bulunamadı. Önce functions klasöründe npm install çalıştırın.')
}

const admin = FUNCTIONS_REQUIRE('firebase-admin')
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  })
}

const db = admin.firestore()
const auth = admin.auth()
const sessionToken = randomBytes(32).toString('base64url')
const activeStudentOperations = new Set()

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=')
        return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]
      }),
  )
}

function secureTokenMatches(candidate) {
  if (typeof candidate !== 'string') return false
  const expected = Buffer.from(sessionToken)
  const actual = Buffer.from(candidate)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function send(res, status, body, contentType = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  })
  res.end(body)
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload))
}

function requestBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 20_000) {
        reject(new Error('İstek çok büyük.'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function assertLocalPost(req) {
  const expectedOrigin = `http://${HOST}:${PORT}`
  const cookies = parseCookies(req.headers.cookie)
  const csrf = req.headers['x-local-csrf']
  if (req.headers.origin !== expectedOrigin || !secureTokenMatches(cookies[SESSION_COOKIE]) || !secureTokenMatches(csrf)) {
    const error = new Error('Yerel oturum doğrulanamadı. Sayfayı yenileyip tekrar deneyin.')
    error.statusCode = 403
    throw error
  }
}

function validatePassword(password, confirmation) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new Error('Şifre 12 ile 128 karakter arasında olmalıdır.')
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error('Şifre en az bir küçük harf, büyük harf ve rakam içermelidir.')
  }
  if (password !== confirmation) throw new Error('Şifreler eşleşmiyor.')
}

function validateStudentId(studentId) {
  if (typeof studentId !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(studentId)) {
    throw new Error('Geçersiz öğrenci kaydı.')
  }
  return studentId
}

function publicStudent(docSnap, profile) {
  const data = docSnap.data() || {}
  const ownerUid = typeof data.ownerUid === 'string' ? data.ownerUid.trim() : ''
  const username = typeof data.username === 'string' ? data.username.trim() : ''
  let accountStatus = 'PENDING'
  let accountStatusLabel = 'Hesap bekliyor'

  if (ownerUid) {
    const profileData = profile?.data?.() || null
    const validProfile =
      profileData &&
      profileData.role === 'student' &&
      profileData.legacyCollection === 'ogrenciler' &&
      profileData.legacyDocId === docSnap.id &&
      profileData.username === username
    accountStatus = validProfile ? 'READY' : 'REVIEW'
    accountStatusLabel = validProfile ? 'Hesap hazır' : 'Manuel inceleme gerekli'
  }

  return {
    id: docSnap.id,
    adSoyad: typeof data.adSoyad === 'string' ? data.adSoyad : 'İsimsiz öğrenci',
    username,
    bolum: typeof data.bolum === 'string' ? data.bolum : '-',
    sinif: String(data.sinif ?? '-'),
    odaNo: String(data.odaNo ?? '-'),
    accountStatus,
    accountStatusLabel,
  }
}

async function listStudents() {
  const snapshot = await db.collection('ogrenciler').orderBy('adSoyad').get()
  const profileSnapshots = await Promise.all(
    snapshot.docs.map((student) => {
      const ownerUid = typeof student.data().ownerUid === 'string' ? student.data().ownerUid.trim() : ''
      return ownerUid ? db.collection('users').doc(ownerUid).get() : Promise.resolve(null)
    }),
  )
  return snapshot.docs.map((student, index) => publicStudent(student, profileSnapshots[index]))
}

function readAudit() {
  try {
    const raw = JSON.parse(readFileSync(LOCAL_AUDIT_PATH, 'utf8'))
    return Array.isArray(raw.events) ? raw.events.slice(0, 30) : []
  } catch {
    return []
  }
}

function appendAudit(event) {
  const events = readAudit()
  events.unshift({ ...event, at: new Date().toISOString() })
  writeFileSync(LOCAL_AUDIT_PATH, JSON.stringify({ version: 1, events: events.slice(0, 100) }, null, 2), 'utf8')
}

async function findIdentityConflict(studentId, email) {
  const [students, admins] = await Promise.all([
    db.collection('ogrenciler').get(),
    db.collection('yoneticiler').get(),
  ])
  for (const docSnap of [...students.docs, ...admins.docs]) {
    const username = typeof docSnap.data().username === 'string' ? docSnap.data().username.trim() : ''
    const resolved = tryToAuthEmail(username)
    if (resolved.ok && resolved.email === email && !(docSnap.ref.parent.id === 'ogrenciler' && docSnap.id === studentId)) {
      throw new Error('Bu kullanıcı adı, mevcut başka bir öğrenci/yönetici hesabıyla çakışıyor.')
    }
  }
}

async function createStudentAccount(studentId, password, confirmation) {
  validatePassword(password, confirmation)
  const id = validateStudentId(studentId)
  if (activeStudentOperations.has(id)) throw new Error('Bu öğrenci için bir işlem zaten sürüyor.')
  activeStudentOperations.add(id)

  let createdUid = null
  try {
    const studentRef = db.collection('ogrenciler').doc(id)
    const studentSnapshot = await studentRef.get()
    if (!studentSnapshot.exists) throw new Error('Öğrenci kaydı bulunamadı.')
    const student = studentSnapshot.data() || {}
    const ownerUid = typeof student.ownerUid === 'string' ? student.ownerUid.trim() : ''
    if (ownerUid) throw new Error('Bu öğrenci için zaten bir hesap bağlantısı bulunuyor.')

    const username = typeof student.username === 'string' ? student.username.trim() : ''
    if (!username || isReservedUsername(username)) throw new Error('Bu öğrenci için geçerli bir kullanıcı adı bulunmuyor.')
    const emailResult = tryToAuthEmail(username)
    if (!emailResult.ok) throw new Error('Kullanıcı adı Firebase Auth hesabı için geçersiz.')
    await findIdentityConflict(id, emailResult.email)

    try {
      const existingAuth = await auth.getUserByEmail(emailResult.email)
      if (existingAuth) throw new Error('Bu kullanıcı adına ait bir Auth hesabı zaten var. Manuel inceleme gerekli.')
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') throw error
    }

    const created = await auth.createUser({
      email: emailResult.email,
      password,
      emailVerified: false,
      disabled: false,
    })
    createdUid = created.uid

    try {
      const current = await studentRef.get()
      const currentData = current.data() || {}
      if (!current.exists || currentData.ownerUid || String(currentData.username || '').trim() !== username) {
        throw new Error('Öğrenci kaydı işlem sırasında değişti. Hesap oluşturma iptal edildi.')
      }

      const now = new Date().toISOString()
      const batch = db.batch()
      batch.create(db.collection('users').doc(created.uid), {
        uid: created.uid,
        username,
        adSoyad: typeof student.adSoyad === 'string' ? student.adSoyad : username,
        role: 'student',
        legacyCollection: 'ogrenciler',
        legacyDocId: id,
        canManageAttendance: student.canManageAttendance === true,
        bolum: student.bolum,
        sinif: student.sinif,
        odaNo: student.odaNo,
        donem: student.donem,
        createdAt: now,
        updatedAt: now,
      })
      batch.update(studentRef, { ownerUid: created.uid, updatedAt: now })
      await batch.commit()
    } catch (error) {
      try {
        await auth.deleteUser(created.uid)
        createdUid = null
      } catch {
        throw new Error('Profil bağlantısı kurulamadı. Auth hesabı için manuel inceleme gerekli.')
      }
      throw error
    }

    appendAudit({ action: 'STUDENT_ACCOUNT_CREATED', studentId: id, username })
    return { message: 'Giriş hesabı başarıyla oluşturuldu.' }
  } finally {
    // Password is intentionally not retained after this function returns.
    activeStudentOperations.delete(id)
  }
}

async function resetStudentPassword(studentId, password, confirmation) {
  validatePassword(password, confirmation)
  const id = validateStudentId(studentId)
  if (activeStudentOperations.has(id)) throw new Error('Bu öğrenci için bir işlem zaten sürüyor.')
  activeStudentOperations.add(id)
  try {
    const studentSnapshot = await db.collection('ogrenciler').doc(id).get()
    if (!studentSnapshot.exists) throw new Error('Öğrenci kaydı bulunamadı.')
    const student = studentSnapshot.data() || {}
    const uid = typeof student.ownerUid === 'string' ? student.ownerUid.trim() : ''
    const username = typeof student.username === 'string' ? student.username.trim() : ''
    const emailResult = tryToAuthEmail(username)
    if (!uid || !emailResult.ok) throw new Error('Bu öğrencinin doğrulanmış giriş hesabı bulunmuyor.')

    const [profileSnapshot, authUser] = await Promise.all([
      db.collection('users').doc(uid).get(),
      auth.getUser(uid),
    ])
    const profile = profileSnapshot.data() || {}
    const bindingValid =
      profileSnapshot.exists &&
      profile.role === 'student' &&
      profile.legacyCollection === 'ogrenciler' &&
      profile.legacyDocId === id &&
      profile.username === username &&
      authUser.email === emailResult.email
    if (!bindingValid) throw new Error('Kimlik bağlantısı doğrulanamadı. Manuel inceleme gerekli.')
    if (authUser.disabled) throw new Error('Bu Auth hesabı devre dışı. Önce hesabı inceleyin.')

    await auth.updateUser(uid, { password })
    appendAudit({ action: 'STUDENT_PASSWORD_RESET', studentId: id, username })
    return { message: 'Öğrencinin şifresi başarıyla güncellendi.' }
  } finally {
    activeStudentOperations.delete(id)
  }
}

function htmlPage() {
  const csrf = JSON.stringify(sessionToken)
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Öğrenci Hesap Yönetimi</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#0f172a;font:15px system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:1100px;margin:0 auto;padding:32px 20px}h1{margin:0;font-size:28px}p{line-height:1.5}.hint{color:#475569}.warning{background:#fffbeb;border:1px solid #fcd34d;color:#78350f;padding:14px 16px;border-radius:12px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin-top:20px;box-shadow:0 1px 2px #0f172a0d}table{border-collapse:collapse;width:100%}th,td{padding:12px 8px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:middle}th{font-size:12px;text-transform:uppercase;color:#64748b}button{border:0;border-radius:9px;background:#4338ca;color:#fff;padding:9px 12px;font-weight:700;cursor:pointer}button.secondary{background:#e2e8f0;color:#1e293b}button:disabled{opacity:.55;cursor:wait}.status{display:inline-block;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:700}.PENDING{background:#fef3c7;color:#92400e}.READY{background:#d1fae5;color:#065f46}.REVIEW{background:#fee2e2;color:#991b1b}.hidden{display:none}.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.form-row input{width:100%;border:1px solid #94a3b8;border-radius:9px;padding:10px;font:inherit}.result{min-height:24px;font-weight:600}.error{color:#b91c1c}.success{color:#047857}small{color:#64748b}@media(max-width:700px){main{padding:20px 12px}.card{padding:14px;overflow:auto}.form-row{grid-template-columns:1fr}table{min-width:680px}}
</style></head><body><main>
<h1>Öğrenci Hesap Yönetimi</h1>
<p class="hint">Bu ekran yalnız bu bilgisayarda çalışır. Şifreler Firebase Auth'a gönderilir; Firestore'a, işlem geçmişine veya ekrana kaydedilmez.</p>
<p class="warning"><strong>Güvenlik:</strong> Bu pencereyi açık bırakmayın. İşiniz bitince bu pencereyi ve başlatıcı konsolunu kapatın.</p>
<section class="card"><h2>Öğrenciler</h2><p class="hint">Hesap bekleyen öğrenciler için ilk şifre oluşturabilir; hazır hesapların şifresini sıfırlayabilirsiniz.</p><div id="students">Yükleniyor…</div></section>
<section class="card hidden" id="action-card"><h2 id="action-title">İşlem</h2><p id="selected-student" class="hint"></p><div class="form-row"><label>Yeni şifre<input id="password" type="password" autocomplete="new-password"></label><label>Şifre tekrarı<input id="confirmation" type="password" autocomplete="new-password"></label></div><p><small>En az 12 karakter; en az bir büyük harf, küçük harf ve rakam içermelidir.</small></p><button id="submit-action">Kaydet</button> <button class="secondary" id="cancel-action">Vazgeç</button><p id="result" class="result" role="status"></p></section>
<section class="card"><h2>Yerel işlem geçmişi</h2><div id="audit">Yükleniyor…</div></section>
</main><script>
const csrf=${csrf};let selected=null;let action=null;
const safe=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
async function getJson(path){const r=await fetch(path,{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'İstek başarısız');return j}
function showAction(student,nextAction){selected=student;action=nextAction;document.getElementById('action-card').classList.remove('hidden');document.getElementById('action-title').textContent=nextAction==='provision'?'Giriş hesabı oluştur':'Öğrenci şifresini sıfırla';document.getElementById('selected-student').textContent=student.adSoyad+' · @'+student.username;document.getElementById('password').value='';document.getElementById('confirmation').value='';document.getElementById('result').textContent='';document.getElementById('password').focus()}
async function load(){const [students,audit]=await Promise.all([getJson('/api/students'),getJson('/api/audit')]);document.getElementById('students').innerHTML='<table><thead><tr><th>Öğrenci</th><th>Bölüm / sınıf</th><th>Oda</th><th>Hesap</th><th>İşlem</th></tr></thead><tbody>'+students.items.map(s=>'<tr><td><strong>'+safe(s.adSoyad)+'</strong><br><small>@'+safe(s.username)+'</small></td><td>'+safe(s.bolum)+' / '+safe(s.sinif)+'. sınıf</td><td>'+safe(s.odaNo)+'</td><td><span class="status '+s.accountStatus+'">'+safe(s.accountStatusLabel)+'</span></td><td>'+(s.accountStatus==='PENDING'?'<button data-id="'+safe(s.id)+'" data-action="provision">Hesap oluştur</button>':s.accountStatus==='READY'?'<button data-id="'+safe(s.id)+'" data-action="reset">Şifre sıfırla</button>':'<small>İşlem yapılamaz</small>')+'</td></tr>').join('')+'</tbody></table>';window.currentStudents=students.items;document.getElementById('audit').innerHTML=audit.events.length?'<ul>'+audit.events.map(e=>'<li>'+safe(e.at)+' — '+safe(e.action)+' — @'+safe(e.username)+'</li>').join('')+'</ul>':'<p class="hint">Henüz yerel işlem yok.</p>'}
document.addEventListener('click',e=>{const b=e.target.closest('button[data-id]');if(!b)return;showAction(window.currentStudents.find(s=>s.id===b.dataset.id),b.dataset.action)});
document.getElementById('cancel-action').onclick=()=>document.getElementById('action-card').classList.add('hidden');
document.getElementById('submit-action').onclick=async()=>{const button=document.getElementById('submit-action'),result=document.getElementById('result');button.disabled=true;result.className='result';result.textContent='İşlem yapılıyor…';try{const response=await fetch('/api/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Local-CSRF':csrf},body:JSON.stringify({studentId:selected.id,password:document.getElementById('password').value,confirmation:document.getElementById('confirmation').value})});const data=await response.json();if(!response.ok)throw Error(data.error||'İşlem başarısız');result.className='result success';result.textContent=data.message;await load();document.getElementById('password').value='';document.getElementById('confirmation').value=''}catch(error){result.className='result error';result.textContent=error.message}finally{button.disabled=false}};
load().catch(error=>{document.getElementById('students').textContent='Liste yüklenemedi: '+error.message;document.getElementById('audit').textContent='';});
</script></body></html>`
}

function launchBrowser(url) {
  if (process.platform === 'win32') execFile('cmd.exe', ['/c', 'start', '', url])
  else if (process.platform === 'darwin') execFile('open', [url])
  else execFile('xdg-open', [url])
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${HOST}:${PORT}`)
    if (req.method === 'GET' && url.pathname === '/') {
      res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${sessionToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`)
      send(res, 200, htmlPage(), 'text/html; charset=utf-8')
      return
    }
    if (req.method === 'GET' && url.pathname === '/api/students') {
      sendJson(res, 200, { items: await listStudents() })
      return
    }
    if (req.method === 'GET' && url.pathname === '/api/audit') {
      sendJson(res, 200, { events: readAudit() })
      return
    }
    if (req.method === 'POST' && (url.pathname === '/api/provision' || url.pathname === '/api/reset')) {
      assertLocalPost(req)
      const payload = JSON.parse(await requestBody(req))
      const result =
        url.pathname === '/api/provision'
          ? await createStudentAccount(payload.studentId, payload.password, payload.confirmation)
          : await resetStudentPassword(payload.studentId, payload.password, payload.confirmation)
      sendJson(res, 200, result)
      return
    }
    sendJson(res, 404, { error: 'Bulunamadı.' })
  } catch (error) {
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 400
    const message = error instanceof Error ? error.message : 'İşlem başarısız.'
    sendJson(res, status, { error: message })
  }
})

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`
  console.log(`Öğrenci Hesap Yönetimi hazır: ${url}`)
  console.log('Kapatmak için bu pencereyi kapatın veya Ctrl+C tuşlarına basın.')
  launchBrowser(url)
})

server.on('error', (error) => {
  console.error(`Yerel sunucu başlatılamadı: ${error.message}`)
  process.exitCode = 1
})
