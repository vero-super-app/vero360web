import 'server-only'

import { cert, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { getStorage } from 'firebase-admin/storage'

/**
 * IMPORTANT: Do NOT import `fs` / `path` / `process.cwd()` here.
 * That makes Next/Netlify NFT trace the entire repo and crash serverless
 * functions with a plain-text HTTP 500 ("Internal Server Error").
 * Use FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (or JSON env) only.
 */

function normalizePrivateKey(key: string): string {
  let k = key.trim()
  // Strip wrapping quotes (Netlify / dotenv often keep them)
  while (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim()
  }
  k = k.replace(/\r/g, '')
  // Double-escaped first (\\n in the file), then single \n
  k = k.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
  return k
}

function pickEnv(...keys: string[]): string {
  for (const key of keys) {
    const v = process.env[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function resolvePrivateKey(): string {
  const b64 = pickEnv('FIREBASE_PRIVATE_KEY_BASE64')
  if (b64) {
    return Buffer.from(b64, 'base64').toString('utf8')
  }
  return normalizePrivateKey(pickEnv('FIREBASE_PRIVATE_KEY'))
}

function parseServiceAccountEnv(raw: string): ServiceAccount {
  let s = raw.trim()
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)

  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n')
  }

  if (!s.startsWith('{')) {
    s = Buffer.from(s, 'base64').toString('utf8').trim()
  }

  let parsed: unknown = JSON.parse(s)
  if (typeof parsed === 'string') {
    parsed = JSON.parse(parsed)
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Service account value is not a JSON object')
  }

  const obj = parsed as Record<string, unknown>
  const projectId = String(obj.project_id || obj.projectId || '').trim()
  const clientEmail = String(obj.client_email || obj.clientEmail || '').trim()
  const privateKey = String(obj.private_key || obj.privateKey || '').trim()
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Service account missing project_id, client_email, or private_key')
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  }
}

export function getAdminStorageBucket(): string {
  return (
    pickEnv(
      'FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'GOOGLE_CLOUD_STORAGE_BUCKET',
    ) || 'vero360app-ca423.firebasestorage.app'
  )
}

function adminAppOptions(projectId: string) {
  return {
    projectId,
    storageBucket: getAdminStorageBucket(),
  }
}

function initFromServiceAccount(sa: ServiceAccount, projectId: string): App {
  return initializeApp({
    ...adminAppOptions(projectId),
    credential: cert(sa),
  })
}

/** Local dev only — dynamic fs import avoids Netlify bundler tracing when unset. */
function loadServiceAccountFromPath(): ServiceAccount | null {
  const pathEnv = pickEnv('FIREBASE_SERVICE_ACCOUNT_PATH')
  if (!pathEnv) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require('node:fs') as typeof import('node:fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolve } = require('node:path') as typeof import('node:path')
    const abs = resolve(process.cwd(), pathEnv)
    const raw = readFileSync(abs, 'utf8')
    return parseServiceAccountEnv(raw)
  } catch (err) {
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT_PATH (${pathEnv}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }
}

function initAdminApp(): App {
  const existing = getApps()[0]
  if (existing) return existing

  const errors: string[] = []
  const projectId =
    pickEnv('FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID') ||
    'vero360app-ca423'

  const fromPath = (() => {
    try {
      return loadServiceAccountFromPath()
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
      return null
    }
  })()
  if (fromPath) {
    try {
      return initFromServiceAccount(fromPath, String(fromPath.projectId || projectId))
    } catch (err) {
      errors.push(
        `FIREBASE_SERVICE_ACCOUNT_PATH: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  const clientEmail = pickEnv('FIREBASE_CLIENT_EMAIL')
  const privateKey = resolvePrivateKey()
  if (clientEmail && privateKey) {
    try {
      return initFromServiceAccount(
        {
          projectId,
          clientEmail,
          privateKey,
        },
        projectId,
      )
    } catch (err) {
      errors.push(
        `FIREBASE_CLIENT_EMAIL/PRIVATE_KEY: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  for (const key of [
    'FIREBASE_SERVICE_ACCOUNT_JSON',
    'FIREBASE_SERVICE_ACCOUNT_JSON_BASE64',
  ] as const) {
    const raw = pickEnv(key)
    if (!raw) continue
    try {
      const sa = parseServiceAccountEnv(raw)
      return initFromServiceAccount(sa, String(sa.projectId || projectId))
    } catch (err) {
      errors.push(`${key}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  throw new Error(
    `Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH (local), FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY_BASE64 (Netlify), or FIREBASE_SERVICE_ACCOUNT_JSON. ${
      errors.length ? errors.join(' | ') : ''
    }`.trim(),
  )
}

export function getAdminDb() {
  return getFirestore(initAdminApp())
}

export function getAdminAuth() {
  return getAuth(initAdminApp())
}

export function getAdminMessaging() {
  return getMessaging(initAdminApp())
}

export function getAdminStorage() {
  return getStorage(initAdminApp())
}

/** Non-secret status for debugging Netlify env. */
export function getFirebaseAdminStatus() {
  const flags = {
    hasServiceAccountPath: Boolean(pickEnv('FIREBASE_SERVICE_ACCOUNT_PATH')),
    hasClientEmail: Boolean(pickEnv('FIREBASE_CLIENT_EMAIL')),
    hasPrivateKey: Boolean(pickEnv('FIREBASE_PRIVATE_KEY')),
    hasPrivateKeyBase64: Boolean(pickEnv('FIREBASE_PRIVATE_KEY_BASE64')),
    hasServiceAccountJson: Boolean(pickEnv('FIREBASE_SERVICE_ACCOUNT_JSON')),
    hasServiceAccountBase64: Boolean(pickEnv('FIREBASE_SERVICE_ACCOUNT_JSON_BASE64')),
  }
  try {
    const app = initAdminApp()
    return {
      ok: true,
      projectId: app.options.projectId || null,
      ...flags,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      ...flags,
    }
  }
}
