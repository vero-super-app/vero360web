'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signInWithEmailAndPassword, signOut, type AuthError } from 'firebase/auth'
import Logo from '@/app/components/landing/Logo'
import { auth } from '@/lib/firebase'

function firebaseSignInMessage(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as AuthError).code)
      : ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'No account with that email/password yet. If this is a fresh setup, create the first admin at /dashboard/admins first.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/user-disabled':
      return 'This account is disabled in Firebase.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.'
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is disabled in Firebase Console → Authentication → Sign-in method.'
    default:
      return 'Invalid email or password, or not an active admin.'
  }
}

export default function PanelSignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const goToDashboard = () => {
    const next = new URLSearchParams(window.location.search).get('next') || ''
    const safe =
      next.startsWith('/dashboard') && !next.startsWith('//') ? next : '/dashboard'
    window.location.href = safe
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
      const token = await cred.user.getIdToken()

      const res = await fetch('/api/admin/admins/me', {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({})) as {
        needsBootstrap?: boolean
        authenticated?: boolean
        error?: string
        me?: { status?: string }
      }

      if (data?.needsBootstrap) {
        // No admins in Firestore yet — let them through to create the first one.
        window.location.href = '/dashboard/admins'
        return
      }

      if (!res.ok || !data?.authenticated) {
        await signOut(auth)
        const apiError = typeof data?.error === 'string' ? data.error.trim() : ''
        throw new Error(
          apiError ||
            (res.status >= 500
              ? `Server error (${res.status}). Open /api/admin/health to check Firebase Admin env on Netlify.`
              : 'This account is not an active admin. Ask a super admin to create or activate your access.'),
        )
      }

      if (data?.me?.status === 'suspended') {
        await signOut(auth)
        throw new Error('This admin account is suspended.')
      }

      goToDashboard()
    } catch (err) {
      const message =
        err instanceof Error && err.message && !err.message.includes('Firebase')
          ? err.message
          : firebaseSignInMessage(err)
      setError(message)
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'linear-gradient(135deg, #9A3412 0%, #F97316 40%, #FFF7ED 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          borderRadius: 24,
          padding: '40px 36px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ display: 'inline-flex', marginBottom: 24 }}>
            <Logo height={44} showText={false} />
          </Link>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              marginBottom: 8,
              fontFamily: 'var(--font-display)',
              color: 'var(--text)',
            }}
          >
            Admin sign in
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-3)', lineHeight: 1.6 }}>
            Only admins can sign in. First time locally?{' '}
            <Link href="/dashboard/admins" style={{ color: 'var(--primary)', fontWeight: 600 }}>
              Create the first admin
            </Link>
            .
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          <div>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-2)',
                marginBottom: 8,
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@vero360.app"
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 12,
                border: '1.5px solid var(--border)',
                fontSize: 15,
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-2)',
                marginBottom: 8,
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 12,
                border: '1.5px solid var(--border)',
                fontSize: 15,
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: '14px 24px',
              borderRadius: 12,
              width: '100%',
              border: 'none',
              background: loading ? 'var(--primary-light)' : 'var(--primary)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.8 : 1,
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          {error ? (
            <p
              style={{
                marginTop: 4,
                fontSize: 14,
                color: 'var(--error)',
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              {error}
            </p>
          ) : null}
        </form>

        <p style={{ textAlign: 'center', marginTop: 28, fontSize: 14 }}>
          <Link href="/" style={{ color: 'var(--text-3)', fontWeight: 500 }}>
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  )
}
