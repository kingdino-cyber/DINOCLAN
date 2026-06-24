import { useEffect, useRef, useState } from 'react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'

function snippet(content, term) {
  if (!content) return ''
  const idx = content.toLowerCase().indexOf(term.toLowerCase())
  if (idx === -1) return content.slice(0, 80)
  const start = Math.max(0, idx - 20)
  return (start > 0 ? '…' : '') + content.slice(start, start + 100)
}

export default function MessageSearch({ serverId, channelId, onJump }) {
  const [open, setOpen]       = useState(false)
  const [term, setTerm]       = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const wrapRef   = useRef(null)
  const debounceRef = useRef(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    setTerm('')
    setResults([])
  }, [serverId, channelId])

  function handleChange(value) {
    setTerm(value)
    clearTimeout(debounceRef.current)
    if (!value.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(() => runSearch(value), 350)
  }

  async function runSearch(value) {
    const myRequestId = ++requestIdRef.current
    setLoading(true)
    try {
      const q = query(
        collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(300),
      )
      const snap = await getDocs(q)
      if (myRequestId !== requestIdRef.current) return // a newer search superseded this one
      const needle = value.trim().toLowerCase()
      const matches = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => m.content && m.content.toLowerCase().includes(needle))
        .slice(0, 25)
      setResults(matches)
    } catch (err) {
      console.error('Message search failed:', err)
      if (myRequestId === requestIdRef.current) setResults([])
    } finally {
      if (myRequestId === requestIdRef.current) setLoading(false)
    }
  }

  return (
    <div className="msg-search-wrap" ref={wrapRef}>
      <button
        className="msg-search-btn"
        title="Search messages"
        onClick={() => setOpen(o => !o)}
      >🔍</button>

      {open && (
        <div className="msg-search-panel">
          <input
            className="msg-search-input"
            placeholder="Search in this channel…"
            value={term}
            onChange={e => handleChange(e.target.value)}
            autoFocus
          />
          {loading && <div className="msg-search-status">Searching…</div>}
          {!loading && term.trim() && results.length === 0 && (
            <div className="msg-search-status">No messages found.</div>
          )}
          <div className="msg-search-results">
            {results.map(m => (
              <div
                key={m.id}
                className="msg-search-result"
                onClick={() => { onJump(m.id); setOpen(false) }}
              >
                <span className="msg-search-result-author">{m.displayName}</span>
                <span className="msg-search-result-text">{snippet(m.content, term)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
