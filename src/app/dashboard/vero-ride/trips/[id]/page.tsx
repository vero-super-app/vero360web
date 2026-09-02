'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { adminFetch } from '@/lib/panel-client-auth'
import {
  adminCanCancelRide,
  adminCanMarkPaid,
  formatDateTime,
  formatRideDistanceKm,
  formatRideFareMwk,
  paymentStatusTone,
  rideStatusLabel,
  rideStatusTone,
  type AdminRide,
} from '@/lib/rides'
import { useConfirm } from '../../../ConfirmDialog'

const ACTION_ACCEPT = { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
const ACTION_REJECT = { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
const ACTION_SUCCESS = { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, color: 'var(--text-2)', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}

function actionBtn(tone: { bg: string; color: string; border: string }) {
  return {
    padding: '10px 14px',
    borderRadius: 10,
    border: `1px solid ${tone.border}`,
    background: tone.bg,
    color: tone.color,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  } as const
}

export default function RideTripDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')
  const confirm = useConfirm()
  const [ride, setRide] = useState<AdminRide | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [acting, setActing] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [paidNote, setPaidNote] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch(`/api/admin/rides/${id}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load trip')
      setRide(data.ride)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trip')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function postJson(url: string, body?: unknown) {
    const res = await adminFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body != null ? JSON.stringify(body) : undefined,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Action failed')
    return data
  }

  async function cancelRide() {
    if (!cancelReason.trim()) return
    setActing(true)
    setNotice('')
    setError('')
    try {
      await postJson(`/api/admin/rides/${id}/cancel`, { reason: cancelReason.trim() })
      setCancelOpen(false)
      setCancelReason('')
      setNotice('Trip cancelled. Passenger and driver were notified.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed')
    } finally {
      setActing(false)
    }
  }

  async function markPaid() {
    const ok = await confirm({
      title: 'Mark trip as paid?',
      message:
        'Use this when payment was confirmed offline or via support. This unlocks new bookings for the passenger.',
      confirmLabel: 'Mark paid',
    })
    if (!ok) return

    setActing(true)
    setNotice('')
    setError('')
    try {
      await postJson(`/api/admin/rides/${id}/mark-paid`, {
        note: paidNote.trim() || undefined,
      })
      setPaidNote('')
      setNotice('Trip marked as paid.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mark paid failed')
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--text-3)' }}>Loading trip…</p>
  }

  if (!ride) {
    return (
      <div>
        <p style={{ color: '#B91C1C' }}>{error || 'Trip not found'}</p>
        <Link href="/dashboard/vero-ride/trips">← Back to trips</Link>
      </div>
    )
  }

  const statusTone = rideStatusTone(ride.status)
  const payTone = paymentStatusTone(ride.paymentStatus)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <Link
          href="/dashboard/vero-ride/trips"
          style={{ color: 'var(--text-3)', fontSize: 13, textDecoration: 'none' }}
        >
          ← Trips
        </Link>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            marginTop: 8,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
              }}
            >
              Trip #{ride.id}
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-3)' }}>
              Created {formatDateTime(ride.createdAt)}
              {ride.updatedAt ? ` · Updated ${formatDateTime(ride.updatedAt)}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 999,
                background: statusTone.bg,
                color: statusTone.color,
                border: `1px solid ${statusTone.border}`,
              }}
            >
              {rideStatusLabel(ride.status)}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 999,
                background: payTone.bg,
                color: payTone.color,
                border: `1px solid ${payTone.border}`,
              }}
            >
              {ride.paymentStatus.toLowerCase() === 'paid' ? 'Paid' : 'Unpaid'}
            </span>
          </div>
        </div>
      </div>

      {notice ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: '#ECFDF5',
            color: '#047857',
            border: '1px solid #A7F3D0',
          }}
        >
          {notice}
        </div>
      ) : null}
      {error ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: '#FEF2F2',
            color: '#B91C1C',
            border: '1px solid #FECACA',
          }}
        >
          {error}
        </div>
      ) : null}

      {ride.needsAttention && (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: '#FFF7ED',
            border: '1px solid #FED7AA',
            color: '#C2410C',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Needs attention: {ride.attentionReasons.join(' · ')}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {adminCanCancelRide(ride) && (
          <button
            type="button"
            disabled={acting}
            onClick={() => {
              setCancelReason('')
              setCancelOpen(true)
            }}
            style={actionBtn(ACTION_REJECT)}
          >
            Cancel trip
          </button>
        )}
        {adminCanMarkPaid(ride) && (
          <>
            <input
              type="text"
              value={paidNote}
              onChange={e => setPaidNote(e.target.value)}
              placeholder="Optional note for manual payment"
              style={{
                flex: '1 1 220px',
                minWidth: 180,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                fontSize: 13,
              }}
            />
            <button
              type="button"
              disabled={acting}
              onClick={() => void markPaid()}
              style={actionBtn(ACTION_SUCCESS)}
            >
              Mark as paid
            </button>
          </>
        )}
        {ride.driverId != null && (
          <Link
            href={`/dashboard/vero-ride/${ride.driverId}`}
            style={{
              ...actionBtn(ACTION_ACCEPT),
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            View driver
          </Link>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        <section
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 18,
          }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>Route</h2>
          <DetailRow label="Pickup" value={ride.pickupAddress || '—'} />
          <DetailRow
            label="Pickup coords"
            value={`${ride.pickupLatitude}, ${ride.pickupLongitude}`}
          />
          <DetailRow label="Drop-off" value={ride.dropoffAddress || '—'} />
          <DetailRow
            label="Drop-off coords"
            value={`${ride.dropoffLatitude}, ${ride.dropoffLongitude}`}
          />
          <DetailRow
            label="Distance"
            value={formatRideDistanceKm(ride.actualDistance ?? ride.estimatedDistance)}
          />
          <DetailRow label="Vehicle class" value={ride.preferredVehicleClass} />
          {ride.passengerNotes && (
            <DetailRow label="Passenger notes" value={ride.passengerNotes} />
          )}
        </section>

        <section
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 18,
          }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>Fare & payment</h2>
          <DetailRow
            label="Estimated fare"
            value={formatRideFareMwk(ride.estimatedFare)}
          />
          <DetailRow label="Actual fare" value={formatRideFareMwk(ride.actualFare)} />
          <DetailRow label="Platform fee" value={formatRideFareMwk(ride.platformFee)} />
          <DetailRow
            label="Driver earnings"
            value={formatRideFareMwk(ride.driverEarnings)}
          />
          <DetailRow label="Payment status" value={ride.paymentStatus} />
          <DetailRow label="Payment channel" value={ride.paymentChannel || '—'} />
          <DetailRow label="Transaction ref" value={ride.paymentTxRef || '—'} />
          <DetailRow label="Paid at" value={formatDateTime(ride.paidAt) || '—'} />
        </section>

        <section
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 18,
          }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>Passenger</h2>
          <DetailRow label="Name" value={ride.passengerName || '—'} />
          <DetailRow label="Phone" value={ride.passengerPhone || '—'} />
          <DetailRow label="Email" value={ride.passengerEmail || '—'} />
          <DetailRow label="User ID" value={String(ride.passengerId)} />
        </section>

        <section
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 18,
          }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>Driver & vehicle</h2>
          <DetailRow label="Driver" value={ride.driverName || 'Not assigned'} />
          <DetailRow label="Phone" value={ride.driverPhone || '—'} />
          <DetailRow
            label="Vehicle"
            value={
              ride.taxiMake && ride.taxiModel
                ? `${ride.taxiMake} ${ride.taxiModel}`
                : '—'
            }
          />
          <DetailRow label="Plate" value={ride.taxiPlate || '—'} />
          <DetailRow label="Driver ID" value={ride.driverId != null ? String(ride.driverId) : '—'} />
          <DetailRow label="Taxi ID" value={ride.taxiId != null ? String(ride.taxiId) : '—'} />
        </section>

        <section
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 18,
          }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>Timeline</h2>
          <DetailRow label="Created" value={formatDateTime(ride.createdAt) || '—'} />
          <DetailRow label="Started" value={formatDateTime(ride.startTime) || '—'} />
          <DetailRow label="Completed" value={formatDateTime(ride.endTime) || '—'} />
          <DetailRow label="Updated" value={formatDateTime(ride.updatedAt) || '—'} />
          {ride.cancellationReason && (
            <DetailRow label="Cancellation" value={ride.cancellationReason} />
          )}
        </section>
      </div>

      {cancelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => !acting && setCancelOpen(false)}
        >
          <div
            style={{
              width: 'min(480px, 100%)',
              background: '#fff',
              borderRadius: 16,
              padding: 20,
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>Cancel trip</h3>
            <p style={{ margin: '0 0 14px', color: 'var(--text-3)', fontSize: 14 }}>
              The passenger and driver will receive a push notification with your reason.
            </p>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={4}
              placeholder="Reason for cancellation…"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                fontSize: 14,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                disabled={acting}
                onClick={() => setCancelOpen(false)}
                style={actionBtn({ bg: '#fff', color: 'var(--text-2)', border: 'var(--border)' })}
              >
                Back
              </button>
              <button
                type="button"
                disabled={acting || !cancelReason.trim()}
                onClick={() => void cancelRide()}
                style={actionBtn(ACTION_REJECT)}
              >
                Cancel trip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
