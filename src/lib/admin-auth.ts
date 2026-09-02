import type { DecodedIdToken } from 'firebase-admin/auth'
import { FieldValue } from 'firebase-admin/firestore'
import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import {
  ADMINS_COLLECTION,
  isConfiguredSuperAdminEmail,
  normalizeAdminRole,
  parsePanelAdmin,
  type AdminRole,
  type PanelAdmin,
} from '@/lib/admins'

export type VerifiedPanelAdmin = {
  token: DecodedIdToken
  uid: string
  email: string
  admin: PanelAdmin
}

function bearerToken(request: Request): string | null {
  const h = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!h) return null
  const m = /^Bearer\s+(.+)$/i.exec(h.trim())
  return m?.[1]?.trim() || null
}

/**
 * Ensure Firestore admin row exists for this Auth user.
 * Auto-provisions configured super-admin emails and first-login bootstrap.
 */
export async function ensureAdminProfile(opts: {
  uid: string
  email: string
  displayName?: string | null
}): Promise<PanelAdmin | null> {
  const db = getAdminDb()
  const ref = db.collection(ADMINS_COLLECTION).doc(opts.uid)
  const snap = await ref.get()
  const email = opts.email.trim().toLowerCase()
  const configured = email ? isConfiguredSuperAdminEmail(email) : false

  if (snap.exists) {
    let admin = parsePanelAdmin(opts.uid, (snap.data() || {}) as Record<string, unknown>)
    // Break-glass: configured super emails are always kept active
    if (configured && admin.status === 'suspended') {
      await ref.set(
        {
          status: 'active',
          role: 'super_admin',
          email: email || admin.email,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      const fresh = await ref.get()
      admin = parsePanelAdmin(opts.uid, (fresh.data() || {}) as Record<string, unknown>)
    }
    return admin
  }

  if (!email) return null

  const existing = await db.collection(ADMINS_COLLECTION).limit(1).get()
  const isFirstAdmin = existing.empty

  // Only auto-create for configured super emails, or the very first admin account.
  if (!configured && !isFirstAdmin) return null

  const role: AdminRole = configured || isFirstAdmin ? 'super_admin' : 'admin'
  const displayName =
    (opts.displayName || '').trim() || email.split('@')[0] || 'Admin'

  await ref.set({
    email,
    displayName,
    role,
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: 'system_bootstrap',
    lastLoginAt: FieldValue.serverTimestamp(),
  })

  try {
    await getAdminAuth().setCustomUserClaims(opts.uid, {
      panel: true,
      panelRole: role,
    })
  } catch (err) {
    console.warn('setCustomUserClaims skipped:', err)
  }

  const fresh = await ref.get()
  return parsePanelAdmin(opts.uid, (fresh.data() || {}) as Record<string, unknown>)
}

export async function verifyPanelAdmin(
  request: Request,
): Promise<VerifiedPanelAdmin | null> {
  const tokenStr = bearerToken(request)
  if (!tokenStr) return null

  try {
    const auth = getAdminAuth()
    const token = await auth.verifyIdToken(tokenStr)
    const uid = token.uid
    const email = (token.email || '').trim().toLowerCase()

    let admin = await ensureAdminProfile({
      uid,
      email,
      displayName: token.name || null,
    })

    if (!admin) {
      // Fallback: lookup by email if doc id mismatched
      if (email) {
        const qs = await getAdminDb()
          .collection(ADMINS_COLLECTION)
          .where('email', '==', email)
          .limit(1)
          .get()
        if (!qs.empty) {
          const doc = qs.docs[0]!
          admin = parsePanelAdmin(doc.id, doc.data() as Record<string, unknown>)
        }
      }
    }

    if (!admin) return null
    if (admin.status === 'suspended') {
      if (email && isConfiguredSuperAdminEmail(email)) {
        await getAdminDb().collection(ADMINS_COLLECTION).doc(admin.id).set(
          { status: 'active', role: 'super_admin', updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        )
        admin = { ...admin, status: 'active', role: 'super_admin' }
      } else {
        return null
      }
    }

    // Touch last login (best-effort)
    try {
      await getAdminDb().collection(ADMINS_COLLECTION).doc(admin.id).set(
        { lastLoginAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      )
    } catch {
      // ignore
    }

    return { token, uid: admin.id, email: admin.email || email, admin }
  } catch (err) {
    console.warn('verifyPanelAdmin failed:', err)
    return null
  }
}

export async function requirePanelAdmin(request: Request): Promise<VerifiedPanelAdmin> {
  const v = await verifyPanelAdmin(request)
  if (!v) {
    throw new AuthError(401, 'Sign in required. Use an active admin account.')
  }
  return v
}

export async function requireSuperAdmin(request: Request): Promise<VerifiedPanelAdmin> {
  const v = await requirePanelAdmin(request)
  if (v.admin.role !== 'super_admin') {
    throw new AuthError(403, 'Only super admins can manage admin accounts.')
  }
  return v
}

/**
 * Dev-friendly: allow unauthenticated super actions only when there are zero admins
 * (bootstrap). Otherwise require a verified super admin token.
 */
export async function requireSuperAdminOrBootstrap(
  request: Request,
): Promise<{ actor: VerifiedPanelAdmin | null; bootstrap: boolean }> {
  const db = getAdminDb()
  const existing = await db.collection(ADMINS_COLLECTION).limit(1).get()
  const bootstrap = existing.empty

  const actor = await verifyPanelAdmin(request)
  if (actor?.admin.role === 'super_admin') {
    return { actor, bootstrap: false }
  }

  if (bootstrap) {
    return { actor: null, bootstrap: true }
  }

  if (!actor) {
    throw new AuthError(
      401,
      'Admins already exist in Firestore — unauthenticated bootstrap is disabled. Sign in as a super admin and send Authorization: Bearer <firebase-id-token>, or run: node scripts/create-panel-admin.mjs <email> <password>',
    )
  }
  throw new AuthError(403, 'Only super admins can manage admin accounts.')
}

export class AuthError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function authErrorResponse(err: unknown) {
  if (err instanceof AuthError) {
    return { status: err.status, error: err.message }
  }
  return null
}

/** 401/403 response, or null if the caller is an active panel admin. */
export async function denyUnlessPanelAdmin(request: Request) {
  try {
    await requirePanelAdmin(request)
    return null
  } catch (err) {
    const mapped = authErrorResponse(err)
    if (mapped) {
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }
    throw err
  }
}

/** Panel admin, or a configured server API key (backend notify hooks). */
export async function denyUnlessPanelAdminOrApiKey(request: Request) {
  const expected = (
    process.env.VERO_ADMIN_API_KEY ||
    process.env.ADMIN_API_KEY ||
    process.env.VERO_API_TOKEN ||
    ''
  ).trim()
  if (expected) {
    const header = String(request.headers.get('x-admin-api-key') || '').trim()
    const bearer = String(request.headers.get('authorization') || '')
      .replace(/^\s*Bearer\s+/i, '')
      .trim()
    if (header === expected || bearer === expected) return null
  }
  return denyUnlessPanelAdmin(request)
}

export function claimsForRole(role: AdminRole) {
  return {
    panel: true,
    panelRole: normalizeAdminRole(role),
  }
}
