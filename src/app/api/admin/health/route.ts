import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Two-step health check:
 * 1) Always returns env flags (no firebase-admin import crash).
 * 2) Optionally probes Admin init when ?probe=1
 */
export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied
  const flags = {
    hasClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL?.trim()),
    hasPrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY?.trim()),
    hasPrivateKeyBase64: Boolean(process.env.FIREBASE_PRIVATE_KEY_BASE64?.trim()),
    hasServiceAccountJson: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()),
    hasServiceAccountBase64: Boolean(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64?.trim(),
    ),
    hasLegacyPath: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim()),
    projectId:
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      null,
    netlify: Boolean(process.env.NETLIFY),
  }

  const probe = new URL(request.url).searchParams.get('probe') === '1'
  if (!probe) {
    const ready =
      flags.hasServiceAccountPath ||
      (flags.hasClientEmail && (flags.hasPrivateKeyBase64 || flags.hasPrivateKey)) ||
      flags.hasServiceAccountJson ||
      flags.hasServiceAccountBase64
    return NextResponse.json({
      success: ready,
      stage: 'env',
      firebaseAdmin: flags,
      hint: ready
        ? 'Env looks set. Check /api/admin/health?probe=1 next.'
        : 'Set FIREBASE_SERVICE_ACCOUNT_PATH (local) or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY_BASE64 (Netlify).',
    })
  }

  try {
    const { getFirebaseAdminStatus } = await import('@/lib/firebase-admin')
    const status = getFirebaseAdminStatus()
    return NextResponse.json(
      {
        success: status.ok,
        stage: 'probe',
        firebaseAdmin: status,
        hint: status.ok
          ? 'Firebase Admin OK. Sign in at /panel with admin@vero360.app'
          : 'Admin init failed — fix FIREBASE_PRIVATE_KEY (keep \\n escapes, wrap in quotes).',
      },
      { status: status.ok ? 200 : 503 },
    )
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        stage: 'probe',
        error: err instanceof Error ? err.message : String(err),
        firebaseAdmin: flags,
      },
      { status: 503 },
    )
  }
}
