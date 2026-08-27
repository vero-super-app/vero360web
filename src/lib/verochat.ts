import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'

export const VEROCHAT_COLLECTION = 'verochat_sessions'
export const SESSION_STORAGE_KEY = 'verochat_session_id'

export type ChatMessageKind = 'text' | 'image'

export type VeroChatReplyTo = {
  messageId: string
  text: string
  sender: 'visitor' | 'agent'
}

export type VeroChatSession = {
  visitorName: string
  visitorEmail: string
  status: 'open' | 'closed'
  createdAt: Timestamp
  updatedAt: Timestamp
  lastMessage: string
  unreadForAgent: number
  type?: string
  source?: string
}

export type VeroChatMessage = {
  text: string
  sender: 'visitor' | 'agent'
  agentName?: string
  createdAt: Timestamp
  kind?: ChatMessageKind
  imageUrl?: string
  replyTo?: VeroChatReplyTo
}

export type VeroChatMessageView = VeroChatMessage & { id: string }

export type VeroChatSessionView = VeroChatSession & { id: string }

function parseMessage(id: string, data: Record<string, unknown>): VeroChatMessageView {
  const replyRaw = data.replyTo
  let replyTo: VeroChatReplyTo | undefined
  if (replyRaw && typeof replyRaw === 'object') {
    const r = replyRaw as Record<string, unknown>
    const messageId = String(r.messageId ?? '').trim()
    if (messageId) {
      replyTo = {
        messageId,
        text: String(r.text ?? '').trim(),
        sender: r.sender === 'agent' ? 'agent' : 'visitor',
      }
    }
  }

  return {
    id,
    text: String(data.text ?? ''),
    sender: data.sender === 'agent' ? 'agent' : 'visitor',
    agentName: data.agentName ? String(data.agentName) : undefined,
    createdAt: data.createdAt as Timestamp,
    kind: data.kind === 'image' ? 'image' : 'text',
    imageUrl: data.imageUrl ? String(data.imageUrl) : undefined,
    replyTo,
  }
}

export function messagePreview(msg: Pick<VeroChatMessage, 'kind' | 'text' | 'imageUrl'>): string {
  if (msg.kind === 'image') return msg.text?.trim() || '📷 Photo'
  return msg.text?.trim() || ''
}

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_STORAGE_KEY, id)
  }
  return id
}

function messagesRef(sessionId: string) {
  return collection(db, VEROCHAT_COLLECTION, sessionId, 'messages')
}

function sessionRef(sessionId: string) {
  return doc(db, VEROCHAT_COLLECTION, sessionId)
}

async function notifyAgent(payload: {
  type: 'new_chat' | 'new_message'
  sessionId: string
  visitorName: string
  visitorEmail: string
  message?: string
}) {
  try {
    await fetch('/api/verochat/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Non-blocking — chat still works if email fails
  }
}

export async function uploadChatImage(sessionId: string, file: File): Promise<string> {
  const form = new FormData()
  form.append('sessionId', sessionId)
  form.append('file', file)

  const res = await fetch('/api/verochat/upload', {
    method: 'POST',
    body: form,
  })

  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok) {
    throw new Error(data.error || 'Upload failed')
  }
  if (!data.url) {
    throw new Error('Upload failed')
  }
  return data.url
}

export async function ensureSession(
  sessionId: string,
  visitorName: string,
  visitorEmail: string,
  opts?: { source?: string; type?: string },
) {
  const ref = sessionRef(sessionId)
  const snap = await getDoc(ref)
  const source = opts?.source || 'web'
  const type = opts?.type || 'help_center'

  if (!snap.exists()) {
    await setDoc(ref, {
      visitorName,
      visitorEmail,
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: '',
      unreadForAgent: 0,
      source,
      type,
    })

    await addDoc(messagesRef(sessionId), {
      text: 'Hello! This is Vero360 Help Center. How can we help you today?',
      sender: 'agent',
      agentName: 'Vero360 Help Center',
      kind: 'text',
      createdAt: serverTimestamp(),
    })

    notifyAgent({
      type: 'new_chat',
      sessionId,
      visitorName,
      visitorEmail,
    })
  } else {
    await updateDoc(ref, {
      visitorName,
      visitorEmail,
      status: 'open',
      updatedAt: serverTimestamp(),
      source,
      type,
    })
  }
}

async function appendMessage(
  sessionId: string,
  message: Omit<VeroChatMessage, 'createdAt'>,
  sessionUpdate: Record<string, unknown>,
) {
  const preview = messagePreview(message)
  const payload: Record<string, unknown> = {
    text: message.text ?? '',
    sender: message.sender,
    kind: message.kind ?? 'text',
    createdAt: serverTimestamp(),
  }
  if (message.agentName) payload.agentName = message.agentName
  if (message.imageUrl) payload.imageUrl = message.imageUrl
  if (message.replyTo) payload.replyTo = message.replyTo

  await addDoc(messagesRef(sessionId), payload)
  await updateDoc(sessionRef(sessionId), {
    lastMessage: preview,
    updatedAt: serverTimestamp(),
    ...sessionUpdate,
  })
  return preview
}

export async function sendVisitorMessage(
  sessionId: string,
  text: string,
  visitor?: { name: string; email: string },
  replyTo?: VeroChatReplyTo,
) {
  const trimmed = text.trim()
  if (!trimmed) return

  const preview = await appendMessage(
    sessionId,
    { text: trimmed, sender: 'visitor', kind: 'text', replyTo },
    { unreadForAgent: increment(1), status: 'open' },
  )

  if (visitor) {
    notifyAgent({
      type: 'new_message',
      sessionId,
      visitorName: visitor.name,
      visitorEmail: visitor.email,
      message: preview,
    })
  }
}

export async function sendVisitorImage(
  sessionId: string,
  file: File,
  options?: {
    caption?: string
    visitor?: { name: string; email: string }
    replyTo?: VeroChatReplyTo
  },
) {
  const imageUrl = await uploadChatImage(sessionId, file)
  const caption = options?.caption?.trim() || ''
  const preview = await appendMessage(
    sessionId,
    {
      text: caption,
      sender: 'visitor',
      kind: 'image',
      imageUrl,
      replyTo: options?.replyTo,
    },
    { unreadForAgent: increment(1), status: 'open' },
  )

  if (options?.visitor) {
    notifyAgent({
      type: 'new_message',
      sessionId,
      visitorName: options.visitor.name,
      visitorEmail: options.visitor.email,
      message: preview,
    })
  }
}

export async function sendAgentMessage(
  sessionId: string,
  text: string,
  agentName = 'Vero360 Help Center',
  replyTo?: VeroChatReplyTo,
) {
  const trimmed = text.trim()
  if (!trimmed) return

  await appendMessage(
    sessionId,
    { text: trimmed, sender: 'agent', agentName, kind: 'text', replyTo },
    { unreadForAgent: 0 },
  )
}

export async function sendAgentImage(
  sessionId: string,
  file: File,
  agentName = 'Vero360 Help Center',
  options?: { caption?: string; replyTo?: VeroChatReplyTo },
) {
  const imageUrl = await uploadChatImage(sessionId, file)
  const caption = options?.caption?.trim() || ''
  await appendMessage(
    sessionId,
    {
      text: caption,
      sender: 'agent',
      agentName,
      kind: 'image',
      imageUrl,
      replyTo: options?.replyTo,
    },
    { unreadForAgent: 0 },
  )
}

export async function markSessionRead(sessionId: string) {
  await updateDoc(sessionRef(sessionId), { unreadForAgent: 0 })
}

export function subscribeToMessages(
  sessionId: string,
  onMessages: (messages: VeroChatMessageView[]) => void,
): Unsubscribe {
  const q = query(messagesRef(sessionId), orderBy('createdAt', 'asc'))
  return onSnapshot(
    q,
    snap => {
      onMessages(snap.docs.map(d => parseMessage(d.id, d.data() as Record<string, unknown>)))
    },
    () => {
      onMessages([])
    },
  )
}

export async function closeSession(sessionId: string) {
  await updateDoc(sessionRef(sessionId), {
    status: 'closed',
    updatedAt: serverTimestamp(),
    unreadForAgent: 0,
  })
}

/** Deletes a conversation and all messages (admin inbox). */
export async function deleteSession(sessionId: string) {
  const msgsSnap = await getDocs(messagesRef(sessionId))
  const docs = msgsSnap.docs
  const chunk = 400
  for (let i = 0; i < docs.length; i += chunk) {
    const batch = writeBatch(db)
    docs.slice(i, i + chunk).forEach(d => batch.delete(d.ref))
    await batch.commit()
  }
  await deleteDoc(sessionRef(sessionId))
}

export function isHelpCenterSession(session: { id: string; type?: string }) {
  if (session.type === 'newsletter' || session.type === 'inquiry') return false
  if (session.id.startsWith('newsletter__') || session.id.startsWith('inquiry__')) return false
  return true
}

export function isoToChatTime(iso: string | null | undefined): Timestamp {
  const d = iso ? new Date(iso) : new Date(NaN)
  return { toDate: () => d } as Timestamp
}

export function hydrateSession(raw: {
  id: string
  visitorName?: string
  visitorEmail?: string
  status?: string
  lastMessage?: string
  unreadForAgent?: number
  type?: string
  source?: string
  createdAt?: string | null
  updatedAt?: string | null
}): VeroChatSessionView {
  return {
    id: raw.id,
    visitorName: raw.visitorName || '',
    visitorEmail: raw.visitorEmail || '',
    status: raw.status === 'closed' ? 'closed' : 'open',
    lastMessage: raw.lastMessage || '',
    unreadForAgent: Number(raw.unreadForAgent || 0) || 0,
    type: raw.type,
    source: raw.source,
    createdAt: isoToChatTime(raw.createdAt),
    updatedAt: isoToChatTime(raw.updatedAt),
  }
}

export function hydrateMessage(raw: {
  id: string
  text?: string
  sender?: string
  agentName?: string
  createdAt?: string | null
  kind?: string
  imageUrl?: string
  replyTo?: VeroChatReplyTo
}): VeroChatMessageView {
  return {
    id: raw.id,
    text: raw.text || '',
    sender: raw.sender === 'agent' ? 'agent' : 'visitor',
    agentName: raw.agentName,
    createdAt: isoToChatTime(raw.createdAt),
    kind: raw.kind === 'image' ? 'image' : 'text',
    imageUrl: raw.imageUrl,
    replyTo: raw.replyTo,
  }
}

export function formatChatTime(value: Timestamp | null | undefined) {
  if (!value?.toDate) return ''
  const d = value.toDate()
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function replyTargetFromMessage(msg: VeroChatMessageView): VeroChatReplyTo {
  return {
    messageId: msg.id,
    text: messagePreview(msg),
    sender: msg.sender,
  }
}
