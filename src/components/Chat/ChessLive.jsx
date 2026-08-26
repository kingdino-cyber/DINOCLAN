import { useState, useEffect, useRef } from 'react'
import { onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { fenToBoard, fenSideToMove, applyMove, getLegalMoves, isInCheck, isCheckmate, isStalemate } from '../../utils/chess'
import { playChessMove, playChessCapture, playCheckmate, playFail } from '../../utils/sounds'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const SYMBOLS = {
  white: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
  black: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' },
}
const FILES = ['a','b','c','d','e','f','g','h']
const RANKS = ['8','7','6','5','4','3','2','1']

function parseMove(m) {
  if (typeof m === 'string') return m.split(',').map(Number)
  return m // backwards compat with old array moves
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

export default function ChessLive({ messageRef, initialData }) {
  const { currentUser, userData } = useAuth()
  const [game,     setGame]     = useState(initialData?.chessLive || {})
  const [selected, setSelected] = useState(null)
  const [legal,    setLegal]    = useState([])
  const [lastMove, setLastMove] = useState(null)
  const [localStatus, setLocalStatus] = useState('playing') // playing|check|checkmate|stalemate
  const boardRef = useRef(null)

  // Live sync
  useEffect(() => {
    return onSnapshot(messageRef, snap => {
      const d = snap.data()
      if (d?.chessLive) setGame(d.chessLive)
    })
  }, [messageRef])

  // Derive board from move history
  const moves     = game.moves     || []
  const board     = replayMoves(moves)
  const side      = sideFromMoveCount(moves.length)
  const myColor   = game.whiteUid === currentUser?.uid ? 'white'
                  : game.blackUid === currentUser?.uid ? 'black'
                  : null
  const isMyTurn  = myColor === side && game.status === 'active'
  const isOver    = game.status === 'ended' || game.status === 'waiting'

  // Recalculate check/checkmate/stalemate whenever moves change
  useEffect(() => {
    if (game.status !== 'active') { setLocalStatus('playing'); return }
    if (isCheckmate(board, side))      setLocalStatus('checkmate')
    else if (isStalemate(board, side)) setLocalStatus('stalemate')
    else if (isInCheck(board, side))   setLocalStatus('check')
    else                               setLocalStatus('playing')
  }, [moves.length, game.status])

  // If checkmate/stalemate detected locally, write end to Firestore
  useEffect(() => {
    if (localStatus === 'checkmate' || localStatus === 'stalemate') {
      const winner = localStatus === 'checkmate'
        ? (side === 'white' ? 'black' : 'white')
        : 'draw'
      updateDoc(messageRef, { 'chessLive.status': 'ended', 'chessLive.winner': winner })
        .catch(() => {})
    }
  }, [localStatus])

  async function joinAs(color) {
    if (!currentUser) return
    const name = userData?.displayName || currentUser.displayName || currentUser.email
    const field   = color === 'white' ? 'chessLive.whiteUid' : 'chessLive.blackUid'
    const nameField = color === 'white' ? 'chessLive.whiteName' : 'chessLive.blackName'
    const update = { [field]: currentUser.uid, [nameField]: name }
    // Check if both players now joined
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

  async function resign() {
    if (!myColor) return
    const winner = myColor === 'white' ? 'black' : 'white'
    await updateDoc(messageRef, { 'chessLive.status': 'ended', 'chessLive.winner': winner })
  }

  // Update lastMove from game moves
  useEffect(() => {
    if (moves.length > 0) {
      const [r0, c0, r1, c1] = parseMove(moves[moves.length - 1])
      setLastMove([[r0, c0], [r1, c1]])
      if (localStatus === 'checkmate') playCheckmate()
    }
  }, [moves.length])

  const statusText = () => {
    if (game.status === 'waiting') {
      const needWhite = !game.whiteUid
      const needBlack = !game.blackUid
      if (needWhite && needBlack) return 'Waiting for two players to join...'
      if (needWhite) return `${game.blackName} joined as Black — waiting for White`
      if (needBlack) return `${game.whiteName} joined as White — waiting for Black`
    }
    if (game.status === 'ended') {
      if (game.winner === 'draw') return '½ Draw — stalemate'
      const winnerName = game.winner === 'white' ? game.whiteName : game.blackName
      return `♛ ${winnerName} wins!`
    }
    if (localStatus === 'checkmate') return `♛ Checkmate!`
    if (localStatus === 'check')     return `⚠️ ${side === 'white' ? 'White' : 'Black'} is in check`
    return `${side === 'white' ? '⬜ White' : '⬛ Black'} to move${isMyTurn ? ' (your turn)' : ''}`
  }

  return (
    <div className="chess-puzzle">
      <div className="chess-live-header">
        <span className="chess-live-badge">⚔️ Live</span>
        <span className="chess-live-players">
          {game.whiteName
            ? <><span className="chess-live-color-dot white-dot" />♔ {game.whiteName}</>
            : <span className="chess-live-empty">No White player</span>}
          <span className="chess-live-vs">vs</span>
          {game.blackName
            ? <><span className="chess-live-color-dot black-dot" />♚ {game.blackName}</>
            : <span className="chess-live-empty">No Black player</span>}
        </span>
      </div>

      {/* Join buttons */}
      {game.status === 'waiting' && (
        <div className="chess-live-join">
          {!game.whiteUid && game.whiteUid !== currentUser?.uid && game.blackUid !== currentUser?.uid && (
            <button className="chess-btn chess-join-btn" onClick={() => joinAs('white')}>
              ♔ Play as White
            </button>
          )}
          {!game.blackUid && game.blackUid !== currentUser?.uid && game.whiteUid !== currentUser?.uid && (
            <button className="chess-btn chess-join-btn" onClick={() => joinAs('black')}>
              ♚ Play as Black
            </button>
          )}
          {(game.whiteUid === currentUser?.uid || game.blackUid === currentUser?.uid) && (
            <span className="chess-live-waiting-msg">Waiting for your opponent...</span>
          )}
        </div>
      )}

      <div className="chess-board-wrap">
        <div className="chess-board" ref={boardRef}>
          {board.map((row, r) =>
            row.map((piece, c) => {
              const light       = (r + c) % 2 === 0
              const isSel       = selected?.[0] === r && selected?.[1] === c
              const isLegalSq   = legal.some(([lr, lc]) => lr === r && lc === c)
              const isLastFrom  = lastMove?.[0][0] === r && lastMove?.[0][1] === c
              const isLastTo    = lastMove?.[1][0] === r && lastMove?.[1][1] === c
              const kingCheck   = piece?.type === 'K' && piece?.color === side &&
                                  (localStatus === 'check' || localStatus === 'checkmate')

              let bg = light ? '#f0d9b5' : '#b58863'
              if (isSel)                       bg = '#7fc97f'
              else if (isLastFrom || isLastTo) bg = light ? '#cdd16a' : '#aaa23a'
              if (kingCheck)                   bg = '#e06060'

              return (
                <div key={`${r}-${c}`} className="chess-sq" style={{ background: bg }}
                  onClick={() => click(r, c)}>
                  {c === 0 && <span className="chess-rank" style={{ color: light ? '#b58863' : '#f0d9b5' }}>{RANKS[r]}</span>}
                  {r === 7 && <span className="chess-file" style={{ color: light ? '#b58863' : '#f0d9b5' }}>{FILES[c]}</span>}
                  {isLegalSq && (piece ? <div className="chess-capture-ring" /> : <div className="chess-dot" />)}
                  {piece && <span className={`chess-piece cp-${piece.color}`}>{SYMBOLS[piece.color][piece.type]}</span>}
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="chess-bar">
        <span className="chess-bar-status">{statusText()}</span>
        <span className="chess-move-count">Moves: {moves.length}</span>
        {myColor && game.status === 'active' && (
          <button className="chess-btn" style={{ marginLeft: 'auto' }} onClick={resign}>
            Resign
          </button>
        )}
      </div>
    </div>
  )
}
