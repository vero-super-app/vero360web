'use client'

import {
  driverStatusLabel,
  driverStatusTone,
  formatDateOnly,
  formatDateTime,
  hasCompleteDriverDocs,
  hasCompleteVehicleDocs,
  isDriverAtLeast18,
  taxiStatusLabel,
  type FleetDriver,
  type FleetTaxi,
} from '@/lib/drivers'

type Props = {
  driver: FleetDriver
  acting: boolean
  onVerifyDriver: () => void
  onRejectDriver: () => void
  onApproveVehicle: (taxiId: number) => void
  onRejectVehicle: (taxiId: number) => void
  onPreview: (url: string) => void
}

function DocThumb({
  label,
  url,
  required,
  onPreview,
}: {
  label: string
  url: string | null
  required?: boolean
  onPreview: (url: string) => void
}) {
  const missing = !url
  return (
    <button
      type="button"
      onClick={() => url && onPreview(url)}
      disabled={!url}
      style={{
        textAlign: 'left',
        border: `1px solid ${missing ? '#FECACA' : 'var(--border)'}`,
        background: missing ? '#FEF2F2' : 'var(--surface)',
        borderRadius: 12,
        padding: 10,
        cursor: url ? 'pointer' : 'default',
        opacity: url ? 1 : 0.85,
      }}
    >
      <div
        style={{
          aspectRatio: '4 / 3',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#F3F4F6',
          display: 'grid',
          placeItems: 'center',
          marginBottom: 8,
          position: 'relative',
        }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <span style={{ fontSize: 12, color: '#B91C1C' }}>
            {required ? 'Required' : 'Missing'}
          </span>
        )}
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: url ? '#10B981' : '#EF4444',
          }}
        />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
      {url ? (
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Expand</div>
      ) : null}
    </button>
  )
}

function Field({
  label,
  value,
  warn,
}: {
  label: string
  value: string
  warn?: string
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>
        {value}
        {warn ? (
          <span style={{ color: '#B91C1C', fontWeight: 700 }}> · {warn}</span>
        ) : null}
      </div>
    </div>
  )
}

export function ApplicationReviewPanel({
  driver,
  acting,
  onVerifyDriver,
  onRejectDriver,
  onApproveVehicle,
  onRejectVehicle,
  onPreview,
}: Props) {
  const pendingVehicles = driver.taxis.filter(t => t.status === 'PENDING_REVIEW')
  const driverDone = driver.status === 'VERIFIED' && driver.isVerified
  const driverPending = driver.status === 'PENDING_VERIFICATION'
  const driverRejected = driver.status === 'REJECTED'
  const driverDocsComplete = hasCompleteDriverDocs(driver)
  const driverAgeOk = isDriverAtLeast18(driver.dateOfBirth)
  const tone = driverStatusTone(driver.status)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <StepBadge n={1} label="Driver docs" done={driverDone} active={driverPending} />
        <StepBadge
          n={2}
          label="Vehicle docs"
          done={driver.taxis.some(t => t.status === 'ACTIVE')}
          active={pendingVehicles.length > 0}
        />
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 999,
            background: tone.bg,
            color: tone.color,
            border: `1px solid ${tone.border}`,
          }}
        >
          {driverStatusLabel(driver.status)}
        </span>
      </div>

      <section
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 16,
        }}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>1. Driver documents</h3>
        {driver.submittedAt ? (
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--muted)' }}>
            Submitted {formatDateTime(driver.submittedAt)}
          </p>
        ) : null}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <Field
            label="Date of birth"
            value={formatDateOnly(driver.dateOfBirth)}
            warn={
              !isDriverAtLeast18(driver.dateOfBirth)
                ? 'Driver must be 18 or older'
                : undefined
            }
          />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <DocThumb
            label="License photo"
            url={driver.licenseImageUrl}
            required
            onPreview={onPreview}
          />
          <DocThumb
            label="National ID photo"
            url={driver.nationalIdImageUrl}
            required
            onPreview={onPreview}
          />
        </div>
        {driverRejected && driver.rejectionReason ? (
          <div
            style={{
              marginBottom: 12,
              padding: 10,
              borderRadius: 10,
              background: '#FEF2F2',
              color: '#B91C1C',
              fontSize: 13,
            }}
          >
            Rejection reason: {driver.rejectionReason}
          </div>
        ) : null}
        {driverPending && !driverDocsComplete ? (
          <p
            style={{
              margin: '0 0 12px',
              fontSize: 13,
              color: '#B91C1C',
              fontWeight: 600,
            }}
          >
            License and national ID photos are required before approval.
          </p>
        ) : null}
        {driverPending ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ActionButton
              label="Verify driver"
              tone="accept"
              disabled={acting || !driverDocsComplete || !driverAgeOk}
              onClick={onVerifyDriver}
            />
            <ActionButton
              label="Reject"
              tone="reject"
              disabled={acting}
              onClick={onRejectDriver}
            />
          </div>
        ) : driverDone ? (
          <p style={{ margin: 0, color: '#047857', fontWeight: 600, fontSize: 13 }}>
            Driver documents approved.
          </p>
        ) : null}
      </section>

      <section
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 16,
        }}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>2. Vehicle proposal</h3>
        {driver.taxis.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
            No vehicle submitted yet.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {driver.taxis.map(taxi => (
              <VehicleBlock
                key={taxi.id}
                taxi={taxi}
                acting={acting}
                onApprove={() => onApproveVehicle(taxi.id)}
                onReject={() => onRejectVehicle(taxi.id)}
                onPreview={onPreview}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function VehicleBlock({
  taxi,
  acting,
  onApprove,
  onReject,
  onPreview,
}: {
  taxi: FleetTaxi
  acting: boolean
  onApprove: () => void
  onReject: () => void
  onPreview: (url: string) => void
}) {
  const pending = taxi.status === 'PENDING_REVIEW'
  const vehicleDocsComplete = hasCompleteVehicleDocs(taxi)
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <div style={{ fontWeight: 700 }}>
          {taxi.model || 'Vehicle'} · {taxi.licensePlate}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
          {taxiStatusLabel(taxi.status)}
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <Field label="Color" value={taxi.color || '—'} />
        <Field label="Seats" value={String(taxi.seats)} />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 10,
          marginBottom: pending ? 12 : 0,
        }}
      >
        <DocThumb label="Vehicle" url={taxi.imageUrl} required onPreview={onPreview} />
        <DocThumb
          label="Insurance"
          url={taxi.insuranceImageUrl}
          required
          onPreview={onPreview}
        />
        <DocThumb
          label="COF"
          url={taxi.cofImageUrl}
          required
          onPreview={onPreview}
        />
      </div>
      {pending && !vehicleDocsComplete ? (
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 13,
            color: '#B91C1C',
            fontWeight: 600,
          }}
        >
          Vehicle photo, insurance, and COF documents are required before approval.
        </p>
      ) : null}
      {pending ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ActionButton
            label="Approve vehicle"
            tone="accept"
            disabled={acting || !vehicleDocsComplete}
            onClick={onApprove}
          />
          <ActionButton
            label="Reject vehicle"
            tone="reject"
            disabled={acting}
            onClick={onReject}
          />
        </div>
      ) : null}
    </div>
  )
}

function StepBadge({
  n,
  label,
  done,
  active,
}: {
  n: number
  label: string
  done: boolean
  active: boolean
}) {
  const bg = done ? '#ECFDF5' : active ? '#FFF7ED' : '#F9FAFB'
  const color = done ? '#047857' : active ? '#C2410C' : '#6B7280'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 700,
        padding: '6px 10px',
        borderRadius: 999,
        background: bg,
        color,
        border: `1px solid ${done ? '#A7F3D0' : active ? '#FED7AA' : '#E5E7EB'}`,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          display: 'grid',
          placeItems: 'center',
          background: color,
          color: '#fff',
          fontSize: 11,
        }}
      >
        {done ? '✓' : n}
      </span>
      {label}
    </span>
  )
}

function ActionButton({
  label,
  tone,
  disabled,
  onClick,
}: {
  label: string
  tone: 'accept' | 'reject'
  disabled?: boolean
  onClick: () => void
}) {
  const styles =
    tone === 'accept'
      ? { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
      : { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        border: `1px solid ${styles.border}`,
        background: styles.bg,
        color: styles.color,
        borderRadius: 10,
        padding: '8px 14px',
        fontWeight: 700,
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  )
}
