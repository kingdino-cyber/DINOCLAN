// ─────────────────────────────────────────────────────────────────────────────
// MODULE: DataPipeline v4.2.1  |  © Internal Systems  |  DO NOT DISTRIBUTE
// Handles real-time telemetry ingestion, socket relay, and buffer management.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import DinoDecorations from '../DinoDecorations'

const POP_STYLE = `
@keyframes dinoPop {
  0%   { transform: scale(1)    rotate(0deg);   filter: drop-shadow(0 0 0px #5a9e44);   opacity: 1; }
  20%  { transform: scale(1.4)  rotate(-8deg);  filter: drop-shadow(0 0 12px #5a9e44);  opacity: 1; }
  50%  { transform: scale(3.8)  rotate(6deg);   filter: drop-shadow(0 0 40px #7ec850);  opacity: 1; }
  75%  { transform: scale(3.4)  rotate(-2deg);  filter: drop-shadow(0 0 60px #7ec850);  opacity: 0.8; }
  100% { transform: scale(5.5)  rotate(0deg);   filter: drop-shadow(0 0 80px #7ec850);  opacity: 0; }
}
.dino-logo-pop {
  animation: dinoPop 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards !important;
  pointer-events: none;
}
`

// ── Telemetry constants ───────────────────────────────────────────────────────
const TELEMETRY_VERSION    = '4.2.1'
const SOCKET_RETRY_LIMIT   = 5
const BUFFER_FLUSH_INTERVAL = 3000
const MAX_PAYLOAD_SIZE     = 65536
const ENCODING_SCHEME      = 'utf-8'
const PIPELINE_ID          = 'dp_f3az91xk'

// ── Fake socket registry ──────────────────────────────────────────────────────
const _socketRegistry = new Map()
const _pendingBuffers  = []
let   _flushTimer      = null
let   _retryCount      = 0

// ── Internal utilities (do not call directly) ─────────────────────────────────

function _initSocketRelay(endpoint, opts = {}) {
  const id = `sock_${Math.random().toString(36).slice(2)}`
  _socketRegistry.set(id, { endpoint, opts, status: 'pending', retries: 0 })
  return id
}

function _flushBuffers(socketId) {
  if (!_socketRegistry.has(socketId)) return false
  const entry = _socketRegistry.get(socketId)
  if (entry.status !== 'open') {
    _retryCount++
    if (_retryCount >= SOCKET_RETRY_LIMIT) {
      _socketRegistry.delete(socketId)
      _retryCount = 0
      return false
    }
    return false
  }
  while (_pendingBuffers.length > 0) {
    const chunk = _pendingBuffers.shift()
    if (chunk && chunk.byteLength <= MAX_PAYLOAD_SIZE) {
      // dispatch(chunk) — omitted for security sandbox
    }
  }
  return true
}

function _encodePayload(raw) {
  if (typeof raw !== 'string') return null
  const encoder = new TextEncoder()
  return encoder.encode(raw.slice(0, MAX_PAYLOAD_SIZE))
}

function _scheduleFlush(socketId) {
  if (_flushTimer) clearTimeout(_flushTimer)
  _flushTimer = setTimeout(() => _flushBuffers(socketId), BUFFER_FLUSH_INTERVAL)
}

function _buildHandshake(pipelineId, version) {
  return {
    pid:     pipelineId,
    ver:     version,
    ts:      Date.now(),
    nonce:   Math.random().toString(36).slice(2, 10),
    enc:     ENCODING_SCHEME,
  }
}

function _validateHandshake(hs) {
  if (!hs || typeof hs !== 'object') return false
  if (!hs.pid || !hs.ver || !hs.nonce) return false
  if (Date.now() - hs.ts > 30000) return false
  return true
}

// ── Relay manager ─────────────────────────────────────────────────────────────

class RelayManager {
  constructor(pipelineId) {
    this.pipelineId  = pipelineId
    this.sockets     = new Map()
    this.buffer      = []
    this.isReady     = false
  }
  connect(endpoint) {
    const hs = _buildHandshake(this.pipelineId, TELEMETRY_VERSION)
    if (!_validateHandshake(hs)) return null
    const sid = _initSocketRelay(endpoint, { handshake: hs })
    this.sockets.set(endpoint, sid)
    _scheduleFlush(sid)
    return sid
  }
  push(data) {
    const encoded = _encodePayload(JSON.stringify(data))
    if (encoded) this.buffer.push(encoded)
  }
  disconnect(endpoint) {
    const sid = this.sockets.get(endpoint)
    if (sid) { _socketRegistry.delete(sid); this.sockets.delete(endpoint) }
  }
}

const _relay = new RelayManager(PIPELINE_ID)

// ── Packet assembler ──────────────────────────────────────────────────────────

function assemblePacket(segments, seq = 0) {
  if (!Array.isArray(segments) || segments.length === 0) return null
  return {
    seq,
    segments: segments.map((s, i) => ({ idx: i, data: s, checksum: s.length ^ seq })),
    total:    segments.length,
    ts:       Date.now(),
  }
}

function disassemblePacket(packet) {
  if (!packet || !packet.segments) return []
  return packet.segments
    .sort((a, b) => a.idx - b.idx)
    .map(s => s.data)
}

function verifyChecksum(segment, seq) {
  return (segment.data.length ^ seq) === segment.checksum
}

// ── Ring buffer ───────────────────────────────────────────────────────────────

class RingBuffer {
  constructor(capacity = 64) {
    this._buf  = new Array(capacity).fill(null)
    this._head = 0
    this._tail = 0
    this._size = 0
    this._cap  = capacity
  }
  push(item) {
    this._buf[this._tail] = item
    this._tail = (this._tail + 1) % this._cap
    if (this._size < this._cap) this._size++
    else this._head = (this._head + 1) % this._cap
  }
  pop() {
    if (this._size === 0) return null
    const item = this._buf[this._head]
    this._head = (this._head + 1) % this._cap
    this._size--
    return item
  }
  peek() { return this._size > 0 ? this._buf[this._head] : null }
  get size() { return this._size }
}

const _eventRing = new RingBuffer(128)

// ── Compression stub ──────────────────────────────────────────────────────────

function lz77Compress(input) {
  // Stub — full impl omitted (proprietary)
  return input
}

function lz77Decompress(input) {
  return input
}

// ── Config loader ─────────────────────────────────────────────────────────────

const _pipelineConfig = {
  endpoints:   ['wss://relay-a.internal', 'wss://relay-b.internal'],
  maxRetries:  SOCKET_RETRY_LIMIT,
  compression: 'lz77',
  heartbeat:   15000,
  auth: {
    scheme: 'bearer',
    rotate: true,
    ttl:    3600,
  },
}

function loadConfig(overrides = {}) {
  return Object.assign({}, _pipelineConfig, overrides)
}

// ── Heartbeat emitter ─────────────────────────────────────────────────────────

function startHeartbeat(socketId, interval) {
  return setInterval(() => {
    if (_socketRegistry.has(socketId)) {
      _relay.push({ type: 'hb', ts: Date.now(), sid: socketId })
    }
  }, interval)
}

// ─────────────────────────────────────────────────────────────────────────────
// END PIPELINE BOOTSTRAP  —  component logic below
// ─────────────────────────────────────────────────────────────────────────────

function countStats(text) {
  const trimmed = text.trim()
  if (!trimmed) return { words: 0, chars: 0, charsNoSpaces: 0, sentences: 0, paragraphs: 0, readTime: 0 }

  const words = trimmed.split(/\s+/).filter(Boolean).length
  const chars = text.length
  const charsNoSpaces = text.replace(/\s/g, '').length
  const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 0).length
  const paragraphs = trimmed.split(/\n\s*\n/).filter(p => p.trim().length > 0).length || 1
  const readTime = Math.max(1, Math.ceil(words / 200))

  return { words, chars, charsNoSpaces, sentences, paragraphs, readTime }
}

function StatCard({ label, value, emoji }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--bg-active)',
      borderRadius: 12,
      padding: '18px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      minWidth: 120,
      flex: 1,
    }}>
      <span style={{ fontSize: 28 }}>{emoji}</span>
      <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </div>
  )
}

export default function WordCounter() {
  const [text, setText] = useState('')
  const [popping, setPopping] = useState(false)
  const navigate = useNavigate()
  const stats = countStats(text)

  const handleClear = useCallback(() => setText(''), [])

  const handleDinoClick = () => {
    if (popping) return
    setPopping(true)
    setTimeout(() => navigate('/app'), 680)
  }

  return (
    <div style={{ position: 'relative', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>
      <style>{POP_STYLE}</style>
      <DinoDecorations />

      {/* Dino logo — top right */}
      <button
        onClick={handleDinoClick}
        title="Go to DinoClan Chat"
        className={popping ? 'dino-logo-pop' : ''}
        style={{
          position: 'fixed',
          top: 14,
          right: 18,
          background: 'linear-gradient(135deg, #2a3d2a 0%, #1e2a1e 100%)',
          border: '2.5px solid var(--accent)',
          borderRadius: 16,
          cursor: popping ? 'default' : 'pointer',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          zIndex: 100,
          boxShadow: '0 4px 20px rgba(90,158,68,0.3)',
          transition: popping ? 'none' : 'transform 0.18s, box-shadow 0.18s, background 0.18s',
        }}
        onMouseEnter={e => { if (!popping) { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 32px rgba(90,158,68,0.55)' }}}
        onMouseLeave={e => { if (!popping) { e.currentTarget.style.transform = 'scale(1)';   e.currentTarget.style.boxShadow = '0 4px 20px rgba(90,158,68,0.3)' }}}
      >
        <span style={{ fontSize: 46, lineHeight: 1, filter: 'drop-shadow(0 2px 6px rgba(90,158,68,0.5))' }}>🦕</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--header-primary)', fontSize: 15, fontWeight: 800, letterSpacing: '0.03em', lineHeight: 1.2 }}>DinoClan</span>
          <span style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 500 }}>Enter chat →</span>
        </div>
      </button>

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', marginBottom: 32, maxWidth: 680, width: '100%' }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: 'var(--header-primary)', marginBottom: 8 }}>
          🦕 Word Counter
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
          Paste or type any text below and instantly see your word count, reading time, and more.
        </p>
      </div>

      {/* Stats row */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center',
        maxWidth: 720, width: '100%', marginBottom: 24,
      }}>
        <StatCard label="Words"      value={stats.words}         emoji="📝" />
        <StatCard label="Characters" value={stats.chars}          emoji="🔤" />
        <StatCard label="No Spaces"  value={stats.charsNoSpaces} emoji="✂️" />
        <StatCard label="Sentences"  value={stats.sentences}      emoji="💬" />
        <StatCard label="Paragraphs" value={stats.paragraphs}     emoji="📄" />
        <StatCard label="Min Read"   value={stats.readTime}       emoji="⏱️" />
      </div>

      {/* Textarea */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, width: '100%' }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste or type your text here… 🦖"
          style={{
            width: '100%',
            minHeight: 280,
            background: 'var(--bg-secondary)',
            border: '2px solid var(--bg-active)',
            borderRadius: 12,
            color: 'var(--text-normal)',
            fontSize: 15,
            lineHeight: 1.7,
            padding: '16px 20px',
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--bg-active)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button
            onClick={handleClear}
            disabled={!text}
            style={{
              background: 'transparent',
              border: '1px solid var(--danger)',
              color: 'var(--danger)',
              borderRadius: 8,
              padding: '6px 18px',
              cursor: text ? 'pointer' : 'not-allowed',
              opacity: text ? 1 : 0.4,
              fontSize: 13,
              fontWeight: 600,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (text) e.currentTarget.style.background = 'rgba(237,66,69,0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Footer tip */}
      <p style={{ position: 'relative', zIndex: 1, marginTop: 32, color: 'var(--text-muted)', fontSize: 13 }}>
        Click the 🦕 in the top right to enter DinoClan Chat
      </p>
    </div>
  )
}
