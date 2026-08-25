import { useState, useEffect, useRef } from 'react'
import { fenToBoard, fenSideToMove, applyMove, getLegalMoves, isInCheck, isCheckmate, isStalemate } from '../../utils/chess'
import { playChessMove, playChessCapture, playCheckmate, playFail } from '../../utils/sounds'

const SYMBOLS = {
  white: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
  black: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' },
}
const FILES = ['a','b','c','d','e','f','g','h']
const RANKS = ['8','7','6','5','4','3','2','1']

const COLORS = ['#f72585','#7209b7','#3a86ff','#06d6a0','#ffd166','#ef233c','#fb8500']

function Confetti({ active }) {
  const [particles, setParticles] = useState([])
  const prev = useRef(false)

  useEffect(() => {
    if (!active || prev.current) { prev.current = active; return }
    prev.current = active
    const p = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 6,
      delay: Math.random() * 0.4,
      duration: 1.5 + Math.random() * 1,
      drift: (Math.random() - 0.5) * 60,
      rotation: Math.random() * 360,
      shape: Math.random() > 0.5 ? 'circle' : 'rect',
    }))
    setParticles(p)
    const t = setTimeout(() => setParticles([]), 3000)
    return () => clearTimeout(t)
  }, [active])

  if (!particles.length) return null
  return (
    <div className="chess-confetti-container" aria-hidden>
      {particles.map(p => (
        <div key={p.id} className="chess-confetti-piece" style={{
          left: `${p.x}%`,
          width: p.size,
          height: p.shape === 'circle' ? p.size : p.size * 1.6,
          borderRadius: p.shape === 'circle' ? '50%' : '2px',
          background: p.color,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.duration}s`,
          '--drift': `${p.drift}px`,
          '--rot': `${p.rotation}deg`,
        }} />
      ))}
    </div>
  )
}

export default function ChessPuzzle({ puzzle }) {
  const startBoard = () => fenToBoard(puzzle.fen)
  const startSide  = () => fenSideToMove(puzzle.fen)
  const limit      = puzzle.movesToSolve || null

  const [board,      setBoard]      = useState(startBoard)
  const [side,       setSide]       = useState(startSide)
  const [selected,   setSelected]   = useState(null)
  const [legal,      setLegal]      = useState([])
  const [lastMove,   setLastMove]   = useState(null)
  const [status,     setStatus]     = useState('playing')  // playing|check|checkmate|stalemate|fail
  const [showAnswer, setShowAnswer] = useState(false)
  const [moves,      setMoves]      = useState(0)

  const isOver = status === 'checkmate' || status === 'stalemate' || status === 'fail'

  function click(r, c) {
    if (isOver) return
    const piece = board[r][c]

    if (selected) {
      const [sr, sc] = selected
      if (legal.some(([lr, lc]) => lr === r && lc === c)) {
        const captured  = board[r][c]
        const nb        = applyMove(board, sr, sc, r, c)
        const nextSide  = side === 'white' ? 'black' : 'white'
        const newMoves  = moves + 1
        let newStatus   = 'playing'

        if (isCheckmate(nb, nextSide))       newStatus = 'checkmate'
        else if (isStalemate(nb, nextSide))  newStatus = 'stalemate'
        else if (isInCheck(nb, nextSide))    newStatus = 'check'
        else if (limit && newMoves >= limit) newStatus = 'fail'

        if (newStatus === 'checkmate')  playCheckmate()
        else if (newStatus === 'fail')  { playFail(); if (captured) playChessCapture(); else playChessMove() }
        else if (captured)              playChessCapture()
        else                            playChessMove()

        setBoard(nb)
        setSide(nextSide)
        setLastMove([[sr, sc], [r, c]])
        setStatus(newStatus)
        setMoves(newMoves)
        setSelected(null)
        setLegal([])
      } else if (piece?.color === side) {
        setSelected([r, c])
        setLegal(getLegalMoves(board, r, c, side))
      } else {
        setSelected(null)
        setLegal([])
      }
    } else {
      if (piece?.color === side) {
        setSelected([r, c])
        setLegal(getLegalMoves(board, r, c, side))
      }
    }
  }

  function reset() {
    setBoard(startBoard())
    setSide(startSide())
    setSelected(null)
    setLegal([])
    setLastMove(null)
    setStatus('playing')
    setShowAnswer(false)
    setMoves(0)
  }

  const movesLeft = limit ? limit - moves : null

  return (
    <div className="chess-puzzle">
      {puzzle.title && <div className="chess-puzzle-title">{puzzle.title}</div>}
      {limit && (
        <div className="chess-moves-goal">
          {status === 'fail'      ? '❌ Failed — no moves left'
           : status === 'checkmate' ? '✅ Solved!'
           : movesLeft === 1       ? '⚠️ Last move!'
           : `Solve in ${movesLeft} move${movesLeft !== 1 ? 's' : ''}`}
        </div>
      )}

      <div className="chess-board-wrap">
        <Confetti active={status === 'checkmate'} />

        <div className={`chess-board${status === 'fail' ? ' chess-board-fail' : ''}`}>
          {board.map((row, r) =>
            row.map((piece, c) => {
              const light       = (r + c) % 2 === 0
              const isSel       = selected?.[0] === r && selected?.[1] === c
              const isLegal     = legal.some(([lr, lc]) => lr === r && lc === c)
              const isLastFrom  = lastMove?.[0][0] === r && lastMove?.[0][1] === c
              const isLastTo    = lastMove?.[1][0] === r && lastMove?.[1][1] === c
              const kingCheck   = piece?.type === 'K' && piece?.color === side &&
                                  (status === 'check' || status === 'checkmate')

              let bg = light ? '#f0d9b5' : '#b58863'
              if (isSel)                       bg = '#7fc97f'
              else if (isLastFrom || isLastTo) bg = light ? '#cdd16a' : '#aaa23a'
              if (kingCheck)                   bg = '#e06060'

              return (
                <div key={`${r}-${c}`} className="chess-sq" style={{ background: bg }} onClick={() => click(r, c)}>
                  {c === 0 && <span className="chess-rank" style={{ color: light ? '#b58863' : '#f0d9b5' }}>{RANKS[r]}</span>}
                  {r === 7 && <span className="chess-file" style={{ color: light ? '#b58863' : '#f0d9b5' }}>{FILES[c]}</span>}
                  {isLegal && (piece ? <div className="chess-capture-ring" /> : <div className="chess-dot" />)}
                  {piece && <span className={`chess-piece cp-${piece.color}`}>{SYMBOLS[piece.color][piece.type]}</span>}
                </div>
              )
            })
          )}
        </div>

        {status === 'fail' && (
          <div className="chess-fail-overlay">
            <div className="chess-fail-text">FAIL</div>
            <button className="chess-btn chess-try-again-btn" onClick={reset}>Try Again</button>
          </div>
        )}
      </div>

      <div className="chess-bar">
        <span className="chess-bar-status">
          {status === 'checkmate' && `♛ Checkmate — ${side === 'white' ? 'Black' : 'White'} wins!`}
          {status === 'stalemate' && '½ Stalemate — Draw'}
          {status === 'check'     && `⚠️ ${side === 'white' ? 'White' : 'Black'} is in check`}
          {status === 'playing'   && `${side === 'white' ? '⬜ White' : '⬛ Black'} to move`}
          {status === 'fail'      && '❌ Better luck next time'}
        </span>
        {!limit && <span className="chess-move-count">Moves: {moves}</span>}
        <div style={{ display: 'flex', gap: 5, marginLeft: 'auto', flexShrink: 0 }}>
          {(status === 'checkmate' || status === 'stalemate') && (
            <button className="chess-btn" onClick={reset}>↺ Play again</button>
          )}
          {puzzle.solution && (
            <button className="chess-btn chess-btn-ans" onClick={() => setShowAnswer(s => !s)}>
              {showAnswer ? 'Hide' : 'Answer'}
            </button>
          )}
        </div>
      </div>

      {showAnswer && puzzle.solution && (
        <div className="chess-answer">{puzzle.solution}</div>
      )}
    </div>
  )
}
