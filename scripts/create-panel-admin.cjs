#!/usr/bin/env node
/**
 * Create a panel admin locally (bypasses API auth when Firestore already has admins).
 *
 * Usage (from vero360web/):
 *   npm run create-admin -- admin@local.test secret123 "Local Admin" super_admin
 */
// Prefer IPv4 — broken IPv6 routes cause ETIMEDOUT to oauth2.googleapis.com on some networks.
require('node:dns').setDefaultResultOrder('ipv4first')

const { readFileSync, existsSync } = require('node:fs')
const { resolve } = require('node:path')
const { initializeApp, getApps, cert } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

const ADMINS_COLLECTION = 'admins'

function normalizePrivateKey(key) {
  let k = String(key || '').trim()
  k = k.replace(/\r/g, '').replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
  return k
}

function loadServiceAccount() {
  const rel =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    '../vero-backend/firebase-service-account.json'
  const abs = resolve(process.cwd(), rel)
  if (!existsSync(abs)) {
    throw new Error(`Service account not found: ${abs}`)
  }
  const raw = JSON.parse(readFileSync(abs, 'utf8'))
  return {
    projectId: raw.project_id || raw.projectId,
    clientEmail: raw.client_email || raw.clientEmail,
    privateKey: normalizePrivateKey(raw.private_key || raw.privateKey),
  }
}

function isNetworkError(err) {
  const code = err?.code || err?.cause?.code || err?.cause?.errno
  return (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    String(err?.message || '').includes('oauth2.googleapis.com')
  )
}

async function withRetry(label, fn, attempts = 4) {
  let lastErr
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isNetworkError(err) || i === attempts) break
      const wait = i * 2000
      console.warn(`${label} failed (${err.code || err.message}). Retry ${i}/${attempts} in ${wait}ms…`)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  throw lastErr
}

function initFirebase(sa) {
  if (getApps().length) return
  initializeApp({
    credential: cert(sa),
    projectId: sa.projectId,
  })
}

async function main() {
  const [emailRaw, password, displayNameArg, roleArg] = process.argv.slice(2)
  const email = String(emailRaw || '')
    .trim()
    .toLowerCase()
  const displayName =
    String(displayNameArg || '').trim() || email.split('@')[0] || 'Admin'
  const role =
    String(roleArg || 'admin').trim().toLowerCase() === 'super_admin'
      ? 'super_admin'
      : 'admin'

  if (!email || !password) {
    console.error(
      'Usage: node scripts/create-panel-admin.cjs <email> <password> [displayName] [super_admin]',
    )
    process.exit(1)
  }
  if (password.length < 6) {
    console.error('Password must be at least 6 characters.')
    process.exit(1)
  }

  const sa = loadServiceAccount()
  initFirebase(sa)

  const auth = getAuth()
  const db = getFirestore()

  const dup = await withRetry('Firestore lookup', () =>
    db.collection(ADMINS_COLLECTION).where('email', '==', email).limit(1).get(),
  )
  if (!dup.empty) {
    console.error(`Admin already exists for ${email} (uid ${dup.docs[0].id})`)
    process.exit(1)
  }

  let user
  try {
    user = await withRetry('Firebase Auth createUser', () =>
      auth.createUser({
        email,
        password,
        displayName,
        emailVerified: true,
        disabled: false,
      }),
    )
  } catch (err) {
    if (err && err.code === 'auth/email-already-exists') {
      user = await withRetry('Firebase Auth getUserByEmail', () =>
        auth.getUserByEmail(email),
      )
      await withRetry('Firebase Auth updateUser', () =>
        auth.updateUser(user.uid, {
          password,
          displayName,
          disabled: false,
        }),
      )
      console.log(`Updated existing Firebase Auth user: ${user.uid}`)
    } else {
      throw err
    }
  }

  await withRetry('Firebase Auth setCustomUserClaims', () =>
    auth.setCustomUserClaims(user.uid, {
      panel: true,
      panelRole: role,
    }),
  )

  await withRetry('Firestore write admin doc', () =>
    db
      .collection(ADMINS_COLLECTION)
      .doc(user.uid)
      .set({
        email,
        displayName,
        role,
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: 'local_script',
        lastLoginAt: null,
      }),
  )

  console.log('Panel admin created.')
  console.log(`  email: ${email}`)
  console.log(`  role:  ${role}`)
  console.log(`  uid:   ${user.uid}`)
  console.log('Sign in at http://localhost:3001/panel')
}

main().catch(err => {
  if (isNetworkError(err)) {
    console.error(
      'Network error reaching Google (oauth2.googleapis.com). Credentials are probably fine.',
    )
    console.error(
      'If curl works but this script fails, IPv6 may be broken. Try:',
    )
    console.error('  getent ahosts oauth2.googleapis.com')
    console.error('  curl -4 -sS -o /dev/null -w "%{http_code}\\n" https://oauth2.googleapis.com/token')
    console.error('  npm run create-admin -- <email> <password>   (already forces IPv4)')
    console.error('Or create the user in Firebase Console → Authentication.')
    console.error(`Detail: ${err.code || ''} ${err.message || err}`)
    process.exit(1)
  }
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
