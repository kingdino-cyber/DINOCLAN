// ── Chess utility: FEN parsing, move generation, check/checkmate detection ────

// Parse FEN into an 8×8 board array.
// board[0] = rank 8 (top of screen), board[7] = rank 1 (bottom).
// Each cell: null | { type: 'P'|'N'|'B'|'R'|'Q'|'K', color: 'white'|'black' }
export function fenToBoard(fen) {
  const placement = (fen || '').split(' ')[0]
  return placement.split('/').map(rank => {
    const row = []
    for (const ch of rank) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < parseInt(ch); i++) row.push(null)
      } else {
        row.push({ type: ch.toUpperCase(), color: ch === ch.toUpperCase() ? 'white' : 'black' })
      }
    }
    return row
  })
}

export function fenSideToMove(fen) {
  return (fen || '').split(' ')[1] === 'b' ? 'black' : 'white'
}

function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8 }

// Pseudo-legal moves — does NOT filter moves that leave own king in check
function pseudoMoves(board, row, col) {
  const piece = board[row][col]
  if (!piece) return []
  const { type, color } = piece
  const enemy = color === 'white' ? 'black' : 'white'
  const moves = []

  const slide = (dr, dc) => {
    let r = row + dr, c = col + dc
    while (inBounds(r, c)) {
      if (board[r][c]?.color === color) break
      moves.push([r, c])
      if (board[r][c]) break
      r += dr; c += dc
    }
  }

  if (type === 'P') {
    const dir = color === 'white' ? -1 : 1
    const startRow = color === 'white' ? 6 : 1
    if (inBounds(row + dir, col) && !board[row + dir][col]) {
      moves.push([row + dir, col])
      if (row === startRow && !board[row + 2 * dir][col])
        moves.push([row + 2 * dir, col])
    }
    for (const dc of [-1, 1]) {
      const r = row + dir, c = col + dc
      if (inBounds(r, c) && board[r][c]?.color === enemy) moves.push([r, c])
    }
  }

  if (type === 'N') {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const r = row + dr, c = col + dc
      if (inBounds(r, c) && board[r][c]?.color !== color) moves.push([r, c])
    }
  }

  if (type === 'B' || type === 'Q')
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) slide(dr, dc)

  if (type === 'R' || type === 'Q')
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, dc)

  if (type === 'K') {
    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      const r = row + dr, c = col + dc
      if (inBounds(r, c) && board[r][c]?.color !== color) moves.push([r, c])
    }
  }

  return moves
}

export function applyMove(board, fromRow, fromCol, toRow, toCol) {
  const nb = board.map(row => [...row])
  const piece = nb[fromRow][fromCol]
  nb[toRow][toCol] = piece
  nb[fromRow][fromCol] = null
  // Auto-promote pawn to queen
  if (piece?.type === 'P' && (toRow === 0 || toRow === 7))
    nb[toRow][toCol] = { type: 'Q', color: piece.color }
  return nb
}

function findKing(board, color) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.type === 'K' && board[r][c]?.color === color) return [r, c]
  return null
}

function isSquareAttacked(board, row, col, byColor) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.color === byColor)
        if (pseudoMoves(board, r, c).some(([mr, mc]) => mr === row && mc === col))
          return true
  return false
}

export function isInCheck(board, color) {
  const king = findKing(board, color)
  if (!king) return false
  return isSquareAttacked(board, king[0], king[1], color === 'white' ? 'black' : 'white')
}

export function getLegalMoves(board, row, col, color) {
  const piece = board[row][col]
  if (!piece || piece.color !== color) return []
  return pseudoMoves(board, row, col).filter(([toRow, toCol]) => {
    const nb = applyMove(board, row, col, toRow, toCol)
    return !isInCheck(nb, color)
  })
}

function hasAnyLegalMove(board, color) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.color === color && getLegalMoves(board, r, c, color).length > 0)
        return true
  return false
}

export function isCheckmate(board, color) {
  return isInCheck(board, color) && !hasAnyLegalMove(board, color)
}

export function isStalemate(board, color) {
  return !isInCheck(board, color) && !hasAnyLegalMove(board, color)
}
