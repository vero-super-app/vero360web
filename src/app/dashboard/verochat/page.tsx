'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import VeroChatMessageRow from '@/app/components/VeroChatMessageRow'
import VeroChatReplyBar from '@/app/components/VeroChatReplyBar'
import { DashboardBackLink, DashboardPageHeader } from '@/app/dashboard/DashboardChrome'
import { useConfirmDelete } from '../ConfirmDialog'
import {
  closeSession,
  deleteSession,
  hydrateMessage,
  hydrateSession,
  isHelpCenterSession,
  markSessionRead,
  replyTargetFromMessage,
  sendAgentImage,
  sendAgentMessage,
  type VeroChatMessageView,
  type VeroChatReplyTo,
  type VeroChatSessionView,
} from '@/lib/verochat'
import { panelAuthHeaders, adminFetch } from '@/lib/panel-client-auth'
import { usePanelSession } from '../PanelSessionProvider'

export default function HelpCenterInbox() {
  const confirmDelete = useConfirmDelete()
  const { authenticated, loading: sessionLoading } = usePanelSession()
  const [sessions, setSessions] = useState<VeroChatSessionView[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<VeroChatMessageView[]>([])
  const [input, setInput] = useState('')
  const [replyTo, setReplyTo] = useState<VeroChatReplyTo | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const chatSessions = sessions.filter(isHelpCenterSession)
  const active = chatSessions.find(s => s.id === activeId) ?? null
  const closed = active?.status === 'closed'

  useEffect(() => {
    if (sessionLoading || !authenticated) return
    let cancelled = false

    const tick = async () => {
      try {
        const headers = await panelAuthHeaders()
        const res = await adminFetch('/api/admin/verochat/sessions', { headers, cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || cancelled) return
        const next = Array.isArray(data.sessions) ? data.sessions.map(hydrateSession) : []
        setSessions(next)
      } catch {
        // keep last list
      }
    }

    void tick()
    const id = window.setInterval(() => void tick(), 4000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [sessionLoading, authenticated])

  useEffect(() => {
    if (!activeId || sessionLoading || !authenticated) {
      setMessages([])
      return
    }
    let cancelled = false

    const tick = async () => {
      try {
        const headers = await panelAuthHeaders()
        const res = await adminFetch(`/api/admin/verochat/sessions/${activeId}/messages`, {
          headers,
          cache: 'no-store',
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || cancelled) return
        const next = Array.isArray(data.messages) ? data.messages.map(hydrateMessage) : []
        setMessages(next)
      } catch {
        // keep last messages
      }
    }

    void tick()
    markSessionRead(activeId).catch(() => {})
    const id = window.setInterval(() => void tick(), 3000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [activeId, sessionLoading, authenticated])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeId])

  useEffect(() => {
    if (activeId) return
    if (chatSessions.length > 0) setActiveId(chatSessions[0]!.id)
  }, [activeId, chatSessions])

  useEffect(() => {
    setReplyTo(null)
  }, [activeId])

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeId || !input.trim() || loading || closed) return
    setLoading(true)
    setError('')
    try {
      await sendAgentMessage(activeId, input, 'Vero360 Help Center', replyTo ?? undefined)
      setInput('')
      setReplyTo(null)
    } catch {
      setError('Could not send reply. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePhoto = async (file: File | undefined) => {
    if (!activeId || !file || loading || closed) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const caption = input.trim()
      await sendAgentImage(activeId, file, 'Vero360 Help Center', {
        caption: caption || undefined,
        replyTo: replyTo ?? undefined,
      })
      setInput('')
      setReplyTo(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload photo. Please try again.')
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleClose = async () => {
    if (!activeId) return
    try {
      await closeSession(activeId)
    } catch {
      setError('Could not close chat.')
    }
  }

  const handleDelete = async () => {
    if (!activeId || deleting) return
    const label = active?.visitorName || active?.visitorEmail || 'this conversation'
    const ok = await confirmDelete(label, 'All messages will be permanently removed.')
    if (!ok) return

    setDeleting(true)
    setError('')
    try {
      const id = activeId
      await deleteSession(id)
      setActiveId(null)
      setReplyTo(null)
    } catch {
      setError('Could not delete conversation.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <DashboardBackLink label="Back to dashboard" />

      <DashboardPageHeader sectionId="verochat" />

      <div
        className="help-inbox"
        style={{
          display: 'grid',
          gridTemplateColumns: '300px 1fr',
          gap: 16,
          minHeight: 'min(70vh, 680px)',
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <aside
          style={{
            borderRight: '1px solid var(--border)',
            background: 'var(--surface)',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-2)',
            }}
          >
            Conversations ({chatSessions.length})
          </div>

          {chatSessions.length === 0 ? (
            <p style={{ padding: 20, fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6 }}>
              No live chats yet. When people use Help Center on the website or live chat in the app, they will show up here.
            </p>
          ) : (
            chatSessions.map(session => {
              const selected = session.id === activeId
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setActiveId(session.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 16px',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    background: selected ? '#fff' : 'transparent',
                    cursor: 'pointer',
                    borderLeft: selected ? '3px solid var(--primary)' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                      {session.visitorName || 'Visitor'}
                    </span>
                    {session.unreadForAgent > 0 && (
                      <span
                        style={{
                          minWidth: 20,
                          height: 20,
                          borderRadius: 100,
                          background: 'var(--primary)',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 6px',
                        }}
                      >
                        {session.unreadForAgent}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 4 }}>
                    {session.visitorEmail || 'No email'} · {session.status}
                    {session.source === 'app' || session.id.startsWith('app_')
                      ? ' · App'
                      : ''}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text-3)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {session.lastMessage || 'No messages yet'}
                  </div>
                </button>
              )
            })
          )}
        </aside>

        <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {!active ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-3)',
                fontSize: 15,
                padding: 24,
              }}
            >
              Select a conversation to reply.
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{active.visitorName || 'Visitor'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{active.visitorEmail}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {active.status === 'open' && (
                    <button
                      type="button"
                      onClick={handleClose}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: '#fff',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-2)',
                      }}
                    >
                      Close chat
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid #FECACA',
                      background: '#FEF2F2',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#B91C1C',
                      opacity: deleting ? 0.6 : 1,
                    }}
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 18,
                  background: 'var(--surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {messages.map(msg => (
                  <VeroChatMessageRow
                    key={msg.id}
                    msg={msg}
                    alignEnd={msg.sender === 'agent'}
                    showReply={!closed}
                    onReply={() => setReplyTo(replyTargetFromMessage(msg))}
                  />
                ))}
                <div ref={endRef} />
              </div>

              {error && (
                <p style={{ margin: 0, padding: '8px 18px 0', fontSize: 13, color: 'var(--error)' }}>
                  {error}
                </p>
              )}

              {replyTo && <VeroChatReplyBar replyTo={replyTo} onClear={() => setReplyTo(null)} />}

              <form
                onSubmit={handleSend}
                style={{
                  padding: 14,
                  borderTop: replyTo ? 'none' : '1px solid var(--border)',
                  display: 'flex',
                  gap: 8,
                  background: '#fff',
                  alignItems: 'center',
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={e => handlePhoto(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={loading || closed}
                  title="Send photo"
                  aria-label="Send photo"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1.5px solid var(--border)',
                    background: '#fff',
                    fontSize: 18,
                    lineHeight: 1,
                    opacity: loading || closed ? 0.5 : 1,
                    cursor: loading || closed ? 'not-allowed' : 'pointer',
                  }}
                >
                  📷
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={closed ? 'Chat closed' : 'Reply as Help Center…'}
                  disabled={loading || closed}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1.5px solid var(--border)',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim() || closed}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    opacity: loading || !input.trim() || closed ? 0.6 : 1,
                  }}
                >
                  {loading ? '…' : 'Send'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      <style>{`
        @media (max-width: 800px) {
          .help-inbox {
            grid-template-columns: 1fr !important;
            min-height: auto !important;
          }
          .help-inbox > aside {
            max-height: 240px;
            border-right: none !important;
            border-bottom: 1px solid var(--border);
          }
          .help-inbox > section {
            min-height: 420px;
          }
        }
      `}</style>
    </div>
  )
}
