import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import DinoDecorations from '../DinoDecorations'

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
  const navigate = useNavigate()
  const stats = countStats(text)

  const handleClear = useCallback(() => setText(''), [])

  return (
    <div style={{ position: 'relative', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>
      <DinoDecorations />

      {/* Dino button — top right */}
      <button
        onClick={() => navigate('/app')}
        title="Go to DinoClan Chat"
        style={{
          position: 'fixed',
          top: 16,
          right: 20,
          background: 'var(--bg-secondary)',
          border: '2px solid var(--accent)',
          borderRadius: 12,
          cursor: 'pointer',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 100,
          transition: 'background 0.15s, transform 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-active)'; e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.transform = 'scale(1)' }}
      >
        <span style={{ fontSize: 28, lineHeight: 1 }}>🦕</span>
        <span style={{ color: 'var(--text-normal)', fontSize: 13, fontWeight: 600 }}>DinoClan</span>
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
        <StatCard label="Words" value={stats.words} emoji="📝" />
        <StatCard label="Characters" value={stats.chars} emoji="🔤" />
        <StatCard label="No Spaces" value={stats.charsNoSpaces} emoji="✂️" />
        <StatCard label="Sentences" value={stats.sentences} emoji="💬" />
        <StatCard label="Paragraphs" value={stats.paragraphs} emoji="📄" />
        <StatCard label="Min Read" value={stats.readTime} emoji="⏱️" />
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
