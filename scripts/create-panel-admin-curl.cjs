#!/usr/bin/env node
/**
 * Create panel admin using curl for Google APIs (avoids Node IPv6 ETIMEDOUT on some networks).
 *
 * Usage (from vero360web/):
 *   npm run create-admin -- admin@local.test secret123 "Local Admin" super_admin
 */
const { readFileSync, existsSync } = require('node:fs')
const { resolve } = require('node:path')
const { createSign } = require('node:crypto')
const { execFileSync } = require('node:child_process')

const ADMINS_COLLECTION = 'admins'

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function normalizePrivateKey(key) {
  return String(key || '')
    .trim()
    .replace(/\r/g, '')
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n')
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

function signJwt(sa) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(
    JSON.stringify({
      iss: sa.clientEmail,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  )
  const unsigned = `${header}.${payload}`
  const sign = createSign('RSA-SHA256')
  sign.update(unsigned)
  sign.end()
  return `${unsigned}.${b64url(sign.sign(sa.privateKey))}`
}

function curlRaw(args, body, extraHeaders = []) {
  const curlArgs = ['-4', '-sS', '--max-time', '30', ...extraHeaders, ...args]
  if (body !== undefined) curlArgs.push('-d', body)
  return execFileSync('curl', curlArgs, { encoding: 'utf8' })
}

function parseCurlJson(out) {
  let parsed
  try {
    parsed = JSON.parse(out)
  } catch {
    throw new Error(`Invalid JSON from curl: ${out.slice(0, 200)}`)
  }
  if (parsed.error) {
    const msg =
      parsed.error.message ||
      parsed.error_description ||
      JSON.stringify(parsed.error)
    throw new Error(msg)
  }
  return parsed
}

function fetchAccessToken(jwt) {
  const out = curlRaw(
    ['-X', 'POST', 'https://oauth2.googleapis.com/token'],
    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
    ['-H', 'Content-Type: application/x-www-form-urlencoded'],
  )
  return parseCurlJson(out)
}

function curlPostJson(url, token, payload) {
  const out = curlRaw(
    ['-X', 'POST', '-H', `Authorization: Bearer ${token}`, '-H', 'Content-Type: application/json', url],
    JSON.stringify(payload),
  )
  return parseCurlJson(out)
}

function curlPatchJson(url, token, payload) {
  const out = curlRaw(
    ['-X', 'PATCH', '-H', `Authorization: Bearer ${token}`, '-H', 'Content-Type: application/json', url],
    JSON.stringify(payload),
  )
  return parseCurlJson(out)
}

function firestoreFields(doc) {
  const fields = {}
  for (const [key, value] of Object.entries(doc)) {
    if (value === null) fields[key] = { nullValue: null }
    else if (typeof value === 'string') fields[key] = { stringValue: value }
    else fields[key] = value
  }
  return { fields }
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
      'Usage: npm run create-admin -- <email> <password> [displayName] [super_admin]',
    )
    process.exit(1)
  }
  if (password.length < 6) {
    console.error('Password must be at least 6 characters.')
    process.exit(1)
  }

  const sa = loadServiceAccount()
  const jwt = signJwt(sa)
  const tokenRes = fetchAccessToken(jwt)
  const token = tokenRes.access_token
  if (!token) throw new Error('No access_token from Google')

  const projectId = sa.projectId
  let uid

  try {
    const created = curlPostJson(
      `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`,
      token,
      {
        email,
        password,
        displayName,
        emailVerified: true,
        disabled: false,
      },
    )
    uid = created.localId
  } catch (err) {
    const msg = String(err.message || err)
    if (!msg.includes('EMAIL_EXISTS') && !msg.includes('email already exists')) {
      throw err
    }
    const lookup = curlPostJson(
      `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
      token,
      { email: [email] },
    )
    uid = lookup.users?.[0]?.localId
    if (!uid) throw new Error(`User exists but lookup failed for ${email}`)
    curlPostJson(
      `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
      token,
      {
        localId: uid,
        email,
        password,
        displayName,
        emailVerified: true,
        disableUser: false,
      },
    )
    console.log(`Updated existing Firebase Auth user: ${uid}`)
  }

  const now = new Date().toISOString()
  const adminDoc = firestoreFields({
    email,
    displayName,
    role,
    status: 'active',
    createdBy: 'local_script',
    createdAt: { timestampValue: now },
    updatedAt: { timestampValue: now },
    lastLoginAt: null,
  })

  try {
    curlPatchJson(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${ADMINS_COLLECTION}/${uid}?updateMask.fieldPaths=email&updateMask.fieldPaths=displayName&updateMask.fieldPaths=role&updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`,
      token,
      adminDoc,
    )
  } catch {
    curlPostJson(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${ADMINS_COLLECTION}?documentId=${uid}`,
      token,
      adminDoc,
    )
  }

  console.log('Panel admin created.')
  console.log(`  email: ${email}`)
  console.log(`  role:  ${role}`)
  console.log(`  uid:   ${uid}`)
  console.log('Sign in at http://localhost:3001/panel')
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
