import { useState, useEffect, useRef } from 'react'
import { onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { fenToBoard, applyMove, getLegalMoves, isInCheck, isCheckmate, isStalemate } from '../../utils/chess'
import { playChessMove, playChessCapture, playCheckmate, playFail } from '../../utils/sounds'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const CPU_UID   = 'chess-cpu'
const CPU_NAME  = '🤖 CPU'

const SYMBOLS = {
  white: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
  black: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' },
}
const FILES = ['a','b','c','d','e','f','g','h']
const RANKS = ['8','7','6','5','4','3','2','1']
const CONFETTI_COLORS = ['#e63946','#f1c40f','#2ecc71','#3498db','#9b59b6','#ff6b6b','#ffd93d']

function parseMove(m) {
  if (typeof m === 'string') return m.split(',').map(Number)
  return m
}

function replayMoves(moves) {
  let board = fenToBoard(START_FEN)
  for (const m of moves) {
    const [fr, fc, tr, tc] = parseMove(m)
    board = applyMove(board, fr, fc, tr, tc)
  }
  return board
}

function sideFromMoveCount(count) {
  return count % 2 === 0 ? 'white' : 'black'
}

function getAllLegalMoves(board, color) {
  const moves = []
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c]?.color === color) {
        const legal = getLegalMoves(board, r, c, color)
        for (const [tr, tc] of legal) moves.push(`${r},${c},${tr},${tc}`)
      }
    }
  }
  return moves
}

function Confetti() {
  const pieces = useRef(Array.from({ length: 50 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 1.8 + Math.random() * 1.5,
    size: 6 + Math.random() * 8,
    drift: (Math.random() - 0.5) * 80,
    rot: Math.random() * 360,
    shape: Math.random() > 0.5 ? '50%' : '2px',
  }))).current
  return (
    <div className="chess-confetti-container" style={{ pointerEvents: 'none' }}>
      {pieces.map(p => (
        <div key={p.id} className="chess-confetti-piece" style={{
          left: `${p.left}%`,
          background: p.color,
          width: p.size,
          height: p.shape === '50%' ? p.size : p.size * 1.6,
          borderRadius: p.shape,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.duration}s`,
          '--drift': `${p.drift}px`,
          '--rot': `${p.rot}deg`,
        }} />
      ))}
    </div>
  )
}

export default function ChessLive({ messageRef, initialData }) {
  const { currentUser, userData } = useAuth()
  const [game,        setGame]        = useState(initialData?.chessLive || {})
  const [selected,    setSelected]    = useState(null)
  const [legal,       setLegal]       = useState([])
  const [lastMove,    setLastMove]    = useState(null)
  const [localStatus, setLocalStatus] = useState('playing')
  const [showConfetti, setShowConfetti] = useState(false)
  const [animPiece,   setAnimPiece]   = useState(null)
  const boardRef    = useRef(null)
  const didMountRef = useRef(false)

  useEffect(() => {
    return onSnapshot(messageRef, snap => {
      const d = snap.data()
      if (d?.chessLive) setGame(d.chessLive)
    })
  }, [messageRef])

  const moves    = game.moves || []
  const board    = replayMoves(moves)
  const side     = sideFromMoveCount(moves.length)
  const myColor  = game.whiteUid === currentUser?.uid ? 'white'
                 : game.blackUid === currentUser?.uid ? 'black'
                 : null
  const isMyTurn = myColor === side && game.status === 'active'
  const iWon     = game.status === 'ended' && myColor && game.winner === myColor
  const iLost    = game.status === 'ended' && myColor && game.winner !== myColor && game.winner !== 'draw'

  // Check/checkmate/stalemate detection
  useEffect(() => {
    if (game.status !== 'active') { setLocalStatus('playing'); return }
    if (isCheckmate(board, side))      setLocalStatus('checkmate')
    else if (isStalemate(board, side)) setLocalStatus('stalemate')
    else if (isInCheck(board, side))   setLocalStatus('check')
    else                               setLocalStatus('playing')
  }, [moves.length, game.status])

  // Write game-over to Firestore when detected locally
  useEffect(() => {
    if (localStatus === 'checkmate' || localStatus === 'stalemate') {
      const winner = localStatus === 'checkmate'
        ? (side === 'white' ? 'black' : 'white')
        : 'draw'
      updateDoc(messageRef, { 'chessLive.status': 'ended', 'chessLive.winner': winner }).catch(() => {})
    }
  }, [localStatus])

  // Confetti + sounds on game end — skip first render so re-entering a finished game doesn't replay
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return }
    if (game.status !== 'ended') return
    if (iWon) { playCheckmate(); setShowConfetti(true); setTimeout(() => setShowConfetti(false), 4000) }
    if (iLost) playFail()
  }, [game.status, game.winner])

  // CPU auto-play
  useEffect(() => {
    if (game.status !== 'active') return
    const cpuColor = game.whiteUid === CPU_UID ? 'white' : game.blackUid === CPU_UID ? 'black' : null
    if (!cpuColor || side !== cpuColor) return

    const timer = setTimeout(async () => {
      const allMoves = getAllLegalMoves(board, cpuColor)
      if (allMoves.length === 0) return

      // Prefer captures, then random
      const captures = allMoves.filter(m => {
        const [,, tr, tc] = parseMove(m)
        return board[tr][tc] !== null
      })
      const pick = captures.length > 0
        ? captures[Math.floor(Math.random() * captures.length)]
        : allMoves[Math.floor(Math.random() * allMoves.length)]

      const [fr, fc, tr, tc] = parseMove(pick)
      const captured = board[tr][tc]
      if (captured) playChessCapture(); else playChessMove()
      await updateDoc(messageRef, { 'chessLive.moves': arrayUnion(pick) })
    }, 900)

    return () => clearTimeout(timer)
  }, [moves.length, game.status, game.whiteUid, game.blackUid])

  // Sync lastMove + animate from Firestore moves
  useEffect(() => {
    if (moves.length > 0) {
      const [r0, c0, r1, c1] = parseMove(moves[moves.length - 1])
      setLastMove([[r0, c0], [r1, c1]])
      setAnimPiece({ fromRow: r0, fromCol: c0, toRow: r1, toCol: c1 })
      setTimeout(() => setAnimPiece(null), 350)
      if (localStatus === 'checkmate') playCheckmate()
    }
  }, [moves.length])

  async function joinAs(color) {
    if (!currentUser) return
    const name   = userData?.displayName || currentUser.displayName || currentUser.email
    const field  = color === 'white' ? 'chessLive.whiteUid'  : 'chessLive.blackUid'
    const nField = color === 'white' ? 'chessLive.whiteName' : 'chessLive.blackName'
    const update = { [field]: currentUser.uid, [nField]: name }
    const otherUid = color === 'white' ? game.blackUid : game.whiteUid
    if (otherUid) update['chessLive.status'] = 'active'
    await updateDoc(messageRef, update)
  }

  async function addCpu(color) {
    const field  = color === 'white' ? 'chessLive.whiteUid'  : 'chessLive.blackUid'
    const nField = color === 'white' ? 'chessLive.whiteName' : 'chessLive.blackName'
    const update = { [field]: CPU_UID, [nField]: CPU_NAME }
    const otherUid = color === 'white' ? game.blackUid : game.whiteUid
    if (otherUid) update['chessLive.status'] = 'active'
    await updateDoc(messageRef, update)
  }

  async function click(r, c) {
    if (!isMyTurn || localStatus === 'checkmate' || localStatus === 'stalemate') return
    const piece = board[r][c]

    if (selected) {
      const [sr, sc] = selected
      if (legal.some(([lr, lc]) => lr === r && lc === c)) {
        const captured = board[r][c]
        const move     = `${sr},${sc},${r},${c}`
        setSelected(null); setLegal([])
        setLastMove([[sr, sc], [r, c]])
        if (captured) playChessCapture(); else playChessMove()
        await updateDoc(messageRef, { 'chessLive.moves': arrayUnion(move) })
      } else if (piece?.color === myColor) {
        setSelected([r, c])
        setLegal(getLegalMoves(board, r, c, myColor))
      } else {
        setSelected(null); setLegal([])
      }
    } else {
      if (piece?.color === myColor) {
        setSelected([r, c])
        setLegal(getLegalMoves(board, r, c, myColor))
      }
    }
  }

  async function forfeit() {
    if (!myColor) return
    const winner = myColor === 'white' ? 'black' : 'white'
    await updateDoc(messageRef, { 'chessLive.status': 'ended', 'chessLive.winner': winner })
  }

  const statusText = () => {
    if (game.status === 'waiting') {
      if (!game.whiteUid && !game.blackUid) return 'Waiting for players to join...'
      if (!game.whiteUid) return `${game.blackName} joined as Black — waiting for White`
      if (!game.blackUid) return `${game.whiteName} joined as White — waiting for Black`
    }
    if (game.status === 'ended') {
      if (game.winner === 'draw') return '½ Draw — stalemate'
      const winnerName = game.winner === 'white' ? game.whiteName : game.blackName
      return `♛ ${winnerName} wins!`
    }
    if (localStatus === 'checkmate') return '♛ Checkmate!'
    if (localStatus === 'check')     return `⚠️ ${side === 'white' ? 'White' : 'Black'} is in check`
    return `${side === 'white' ? '⬜ White' : '⬛ Black'} to move${isMyTurn ? ' — your turn!' : ''}`
  }

  const myJoined  = myColor !== null
  const cpuJoined = game.whiteUid === CPU_UID || game.blackUid === CPU_UID

  return (
    <div className="chess-puzzle" style={{ position: 'relative' }}>
      {showConfetti && <Confetti />}

      <div className="chess-live-header">
        <span className="chess-live-badge">⚔️ Live</span>
        <span className="chess-live-players">
          {game.whiteName
            ? <><span className="chess-live-color-dot white-dot" />♔ {game.whiteName}</>
            : <span className="chess-live-empty">No White</span>}
          <span className="chess-live-vs">vs</span>
          {game.blackName
            ? <><span className="chess-live-color-dot black-dot" />♚ {game.blackName}</>
            : <span className="chess-live-empty">No Black</span>}
        </span>
      </div>

      {/* Join / CPU buttons */}
      {game.status === 'waiting' && (
        <div className="chess-live-join">
          {!game.whiteUid && !myJoined && (
            <button className="chess-btn chess-join-btn" onClick={() => joinAs('white')}>♔ Play as White</button>
          )}
          {!game.blackUid && !myJoined && (
            <button className="chess-btn chess-join-btn" onClick={() => joinAs('black')}>♚ Play as Black</button>
          )}
          {!game.whiteUid && myJoined && !cpuJoined && (
            <button className="chess-btn chess-join-btn" style={{ background: '#555' }} onClick={() => addCpu('white')}>🤖 Add CPU as White</button>
          )}
          {!game.blackUid && myJoined && !cpuJoined && (
            <button className="chess-btn chess-join-btn" style={{ background: '#555' }} onClick={() => addCpu('black')}>🤖 Add CPU as Black</button>
          )}
          {myJoined && (
            <span className="chess-live-waiting-msg">Waiting for opponent...</span>
          )}
        </div>
      )}

      {/* Board */}
      <div className="chess-board-wrap" style={{ position: 'relative' }}>
        <div className="chess-board" ref={boardRef}>
          {board.map((row, r) =>
            row.map((piece, c) => {
              const light      = (r + c) % 2 === 0
              const isSel      = selected?.[0] === r && selected?.[1] === c
              const isLegalSq  = legal.some(([lr, lc]) => lr === r && lc === c)
              const isLastFrom = lastMove?.[0][0] === r && lastMove?.[0][1] === c
              const isLastTo   = lastMove?.[1][0] === r && lastMove?.[1][1] === c
              const kingCheck  = piece?.type === 'K' && piece?.color === side &&
                                 (localStatus === 'check' || localStatus === 'checkmate')

              let bg = light ? '#f0d9b5' : '#b58863'
              if (isSel)                       bg = '#7fc97f'
              else if (isLastFrom || isLastTo) bg = light ? '#cdd16a' : '#aaa23a'
              if (kingCheck)                   bg = '#e06060'

              return (
                <div key={`${r}-${c}`} className="chess-sq" style={{ background: bg }} onClick={() => click(r, c)}>
                  {c === 0 && <span className="chess-rank" style={{ color: light ? '#b58863' : '#f0d9b5' }}>{RANKS[r]}</span>}
                  {r === 7 && <span className="chess-file" style={{ color: light ? '#b58863' : '#f0d9b5' }}>{FILES[c]}</span>}
                  {isLegalSq && (piece ? <div className="chess-capture-ring" /> : <div className="chess-dot" />)}
                  {piece && (() => {
                    const isMoving = animPiece?.toRow === r && animPiece?.toCol === c
                    const dx = isMoving ? (animPiece.fromCol - c) * 44 : 0
                    const dy = isMoving ? (animPiece.fromRow - r) * 44 : 0
                    return (
                      <span
                        className={`chess-piece cp-${piece.color}${isMoving ? ' chess-piece-moving' : ''}`}
                        style={isMoving ? { '--chess-slide-from': `translate(${dx}px, ${dy}px)` } : undefined}
                      >
                        {SYMBOLS[piece.color][piece.type]}
                      </span>
                    )
                  })()}
                </div>
              )
            })
          )}
        </div>

        {/* Win overlay */}
        {iWon && (
          <div className="chess-result-overlay chess-result-win">
            🏆 You Won!
          </div>
        )}

        {/* Loss overlay */}
        {iLost && (
          <div className="chess-result-overlay chess-result-loss">
            You Lost
          </div>
        )}

        {/* Draw overlay */}
        {game.status === 'ended' && game.winner === 'draw' && (
          <div className="chess-result-overlay chess-result-draw">
            ½ Draw
          </div>
        )}
      </div>

      <div className="chess-bar">
        <span className="chess-bar-status">{statusText()}</span>
        <span className="chess-move-count">Moves: {moves.length}</span>
        {myColor && game.status === 'active' && (
          <button className="chess-forfeit-btn" onClick={forfeit} title="Forfeit — your opponent wins">
            🏳 Forfeit
          </button>
        )}
      </div>
    </div>
  )
}
