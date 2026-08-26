import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin'
import {
  countUsers,
  mergeAuthIntoUser,
  parseAppUser,
  USERS_COLLECTION,
  type AppUser,
} from '@/lib/users'

const AUTH_BATCH = 100

async function enrichFromFirebaseAuth(users: AppUser[]): Promise<AppUser[]> {
  if (users.length === 0) return users

  const auth = getAdminAuth()
  const byId = new Map(users.map(u => [u.id, u]))

  // Prefer enriching stubs AND anyone missing a stable createdAt (needed for sort).
  const needsEnrich = users.filter(
    u =>
      !u.createdAt ||
      !u.email ||
      !u.name ||
      u.name === '—' ||
      !u.phone ||
      u.authProvider === 'unknown',
  )
  const ids = (needsEnrich.length ? needsEnrich : users).map(u => u.id)

  for (let i = 0; i < ids.length; i += AUTH_BATCH) {
    const chunk = ids.slice(i, i + AUTH_BATCH)
    try {
      const result = await auth.getUsers(chunk.map(uid => ({ uid })))
      for (const record of result.users) {
        const existing = byId.get(record.uid)
        if (!existing) continue
        byId.set(
          record.uid,
          mergeAuthIntoUser(existing, {
            displayName: record.displayName,
            email: record.email,
            phoneNumber: record.phoneNumber,
            photoURL: record.photoURL,
            disabled: record.disabled,
            providerIds: record.providerData.map(p => p.providerId),
            // Auth creationTime is the stable signup moment (not last sign-in).
            creationTime: record.metadata.creationTime || null,
          }),
        )
      }
    } catch (err) {
      console.warn('Firebase Auth enrich batch failed:', err)
    }
  }

  return users.map(u => byId.get(u.id) || u)
}

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  try {
    const db = getAdminDb()
    const snap = await db.collection(USERS_COLLECTION).get()

    let users = snap.docs.map(docSnap =>
      parseAppUser(docSnap.id, docSnap.data() as Record<string, unknown>),
    )

    try {
      users = await enrichFromFirebaseAuth(users)
    } catch (err) {
      console.warn('User Auth enrichment skipped:', err)
    }

    // Stable newest-registration order. Do NOT sort by updatedAt/lastLogin —
    // returning users would jump to the top and look like new signups.
    users.sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
      if (bt !== at) return bt - at
      return a.id.localeCompare(b.id)
    })

    return NextResponse.json({
      success: true,
      users,
      counts: countUsers(users),
    })
  } catch (err) {
    console.error('Admin users GET error:', err)
    const message =
      err instanceof Error ? err.message : 'Could not load users from Firebase'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
