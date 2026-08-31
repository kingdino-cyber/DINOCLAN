import { useState, useEffect } from 'react'
import { onSnapshot, updateDoc } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { buildDeck, shuffle, canPlay, cardLabel, COLORS } from '../../utils/uno'
import { playUnoCard, playUnoDraw, playUnoSpecial, playUnoWild, playUnoWin } from '../../utils/sounds'

const HAND_SIZE = 7
const CPU_UID   = 'cpu-bot'
const CPU_NAME  = '🤖 CPU'

const COLOR_BG = {
  red:    '#e74c3c',
  green:  '#27ae60',
  blue:   '#2980b9',
  yellow: '#f1c40f',
}

function cardSymbol(card) {
  if (card.type === 'number')  return String(card.value)
  if (card.type === 'skip')    return '🚫'
  if (card.type === 'reverse') return '↺'
  if (card.type === 'draw2')   return '+2'
  if (card.type === 'wild')    return '★'
  if (card.type === 'wild4')   return '+4'
  return '?'
}

function UnoCard({ card, small = false, faceDown = false, playable = false, onClick, stacked = false }) {
  if (faceDown) {
    return (
      <div className={`ucard ucard-back${small ? ' ucard-sm' : ''}${stacked ? ' ucard-stacked' : ''}`}>
        <div className="ucard-back-inner">
          <span className="ucard-logo">UNO</span>
        </div>
      </div>
    )
  }

  const isWild = card.color === 'wild'
  const sym    = cardSymbol(card)
  const bg     = isWild ? null : COLOR_BG[card.color]

  return (
    <div
      className={`ucard${isWild ? ' ucard-wild' : ''}${small ? ' ucard-sm' : ''}${playable ? ' ucard-playable' : ' ucard-dull'}${stacked ? ' ucard-stacked' : ''}`}
      style={bg ? { '--uc': bg } : undefined}
      onClick={playable && onClick ? onClick : undefined}
      title={cardLabel(card)}
    >
      {isWild ? (
        <div className="ucard-wild-quarters">
          <div className="uwq uwq-r" /><div className="uwq uwq-b" />
          <div className="uwq uwq-g" /><div className="uwq uwq-y" />
          <div className="ucard-oval ucard-oval-dark">
            <span className="ucard-face">{sym}</span>
          </div>
        </div>
      ) : (
        <>
          <span className="ucard-corner ucard-tl">{sym}</span>
          <div className="ucard-oval">
            <span className="ucard-face">{sym}</span>
          </div>
          <span className="ucard-corner ucard-br">{sym}</span>
        </>
      )}
    </div>
  )
}

// Returns true only if card can legally counter the active draw stack
function canCounterDraw(card, drawStack, discardTop) {
  if (drawStack === 0) return true
  if (discardTop?.type === 'draw2'  && card.type === 'draw2')  return true
  if (discardTop?.type === 'wild4'  && card.type === 'wild4')  return true
  return false
}

// Advance turn index, treating reverse as skip in 2-player games
function nextTurn(currentIdx, dir, n) {
  return ((currentIdx + dir) % n + n) % n
}

function applyCardEffects(card, currentIdx, dir, n, drawStack) {
  let nextIdx = currentIdx
  let newDir  = dir
  let newDraw = drawStack

  if (card.type === 'reverse') {
    newDir = dir * -1
    // In a 2-player game, reverse acts as skip (same player goes again)
    nextIdx = n === 2 ? currentIdx : nextTurn(currentIdx, newDir, n)
  } else if (card.type === 'skip') {
    nextIdx = nextTurn(nextTurn(currentIdx, dir, n), dir, n)
  } else if (card.type === 'draw2') {
    newDraw += 2
    nextIdx = nextTurn(currentIdx, dir, n)
  } else if (card.type === 'wild4') {
    newDraw += 4
    nextIdx = nextTurn(currentIdx, dir, n)
  } else {
    nextIdx = nextTurn(currentIdx, dir, n)
  }
  return { nextIdx, newDir, newDraw }
}

export default function UnoGame({ messageRef, initialData }) {
  const { currentUser, userData } = useAuth()
  const [game, setGame]               = useState(initialData?.unoGame || {})
  const [choosingColor, setChoosingColor] = useState(false)
  const [pendingCard, setPendingCard]     = useState(null)
  const [drawnCard, setDrawnCard]         = useState(null) // card drawn this turn that can be played

  useEffect(() => {
    return onSnapshot(messageRef, snap => {
      const d = snap.data()
      if (d?.unoGame) setGame(d.unoGame)
    })
  }, [messageRef])

  const myName     = userData?.displayName || currentUser?.displayName || currentUser?.email
  const myUid      = currentUser?.uid
  const myPlayer   = game.players?.find(p => p.uid === myUid)
  const myHand     = game.hands?.[myUid] || []
  const joined     = !!myPlayer
  const isMyTurn   = game.players?.[game.currentPlayerIndex]?.uid === myUid && game.status === 'active'
  const discardTop = game.discard?.[game.discard.length - 1] || null
  const discardColor = game.discardColor || discardTop?.color

  async function addCpu() {
    if (game.status !== 'waiting') return
    if (game.players?.find(p => p.uid === CPU_UID)) return
    const newPlayers = [...(game.players || []), { uid: CPU_UID, name: CPU_NAME }]
    await updateDoc(messageRef, { 'unoGame.players': newPlayers })
  }

  // CPU auto-play
  useEffect(() => {
    if (game.status !== 'active') return
    const currentPlayer = game.players?.[game.currentPlayerIndex]
    if (currentPlayer?.uid !== CPU_UID) return

    const cpuHand = game.hands?.[CPU_UID] || []
    const timer = setTimeout(async () => {
      const playableIdx = cpuHand.findIndex(c =>
        canCounterDraw(c, game.drawStack, discardTop) &&
        canPlay(c, discardTop, discardColor)
      )

      if (playableIdx === -1) {
        let deck = [...(game.deck || [])]
        if (deck.length < 1) deck = [...deck, ...shuffle(game.discard.slice(0, -1))]
        const drawn   = deck.splice(0, Math.max(game.drawStack || 1, 1))
        const newHand = [...cpuHand, ...drawn]
        const n       = game.players.length
        const dir     = game.direction
        const nextIdx = ((game.currentPlayerIndex + dir) % n + n) % n
        playUnoDraw()
        await updateDoc(messageRef, {
          [`unoGame.hands.${CPU_UID}`]:  newHand,
          'unoGame.deck':                deck,
          'unoGame.drawStack':           0,
          'unoGame.currentPlayerIndex':  nextIdx,
        })
        return
      }

      const card = cpuHand[playableIdx]
      let chosenColor = card.color
      if (card.type === 'wild' || card.type === 'wild4') {
        const counts = {}
        cpuHand.forEach(c => { if (c.color !== 'wild') counts[c.color] = (counts[c.color] || 0) + 1 })
        chosenColor = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'red'
        playUnoWild()
      }

      const newHand  = cpuHand.filter((_, i) => i !== playableIdx)
      const newHands = { ...game.hands, [CPU_UID]: newHand }
      let   deck     = [...(game.deck || [])]
      let   discard  = [...(game.discard || []), card]
      let   dir      = game.direction
      let   drawStack = game.drawStack || 0
      const n        = game.players.length
      let   nextIdx  = game.currentPlayerIndex

      if (newHand.length === 0) {
        playUnoWin()
        await updateDoc(messageRef, {
          'unoGame.hands':   newHands,
          'unoGame.discard': discard,
          'unoGame.discardColor': chosenColor,
          'unoGame.status':  'ended',
          'unoGame.winner':  { uid: CPU_UID, name: CPU_NAME },
        })
        return
      }

      const isSpecial = ['reverse','skip','draw2','wild4'].includes(card.type)
      if (isSpecial) playUnoSpecial(); else playUnoCard()
      const effects = applyCardEffects(card, nextIdx, dir, n, drawStack)
      dir       = effects.newDir
      drawStack = effects.newDraw
      nextIdx   = effects.nextIdx

      await updateDoc(messageRef, {
        'unoGame.hands':               newHands,
        'unoGame.discard':             discard,
        'unoGame.discardColor':        chosenColor,
        'unoGame.deck':                deck,
        'unoGame.direction':           dir,
        'unoGame.drawStack':           drawStack,
        'unoGame.currentPlayerIndex':  nextIdx,
      })
    }, 1200)

    return () => clearTimeout(timer)
  }, [game.currentPlayerIndex, game.status, game.hands?.[CPU_UID]?.length])

  async function joinGame() {
    if (joined || game.status !== 'waiting') return
    const newPlayers = [...(game.players || []), { uid: myUid, name: myName }]
    await updateDoc(messageRef, { 'unoGame.players': newPlayers })
  }

  async function startGame() {
    if (game.players?.length < 2) return
    const deck   = buildDeck()
    const hands  = {}
    let   deckLeft = [...deck]
    for (const p of game.players) hands[p.uid] = deckLeft.splice(0, HAND_SIZE)
    let firstCard = deckLeft.shift()
    // Wilds can't start the game
    while (firstCard.color === 'wild') { deckLeft.push(firstCard); firstCard = deckLeft.shift() }
    const n = game.players.length
    // Apply first card effects
    const effects = applyCardEffects(firstCard, 0, 1, n, 0)
    await updateDoc(messageRef, {
      'unoGame.hands':               hands,
      'unoGame.deck':                deckLeft,
      'unoGame.discard':             [firstCard],
      'unoGame.discardColor':        firstCard.color,
      'unoGame.status':              'active',
      'unoGame.currentPlayerIndex':  effects.nextIdx,
      'unoGame.direction':           effects.newDir,
      'unoGame.drawStack':           effects.newDraw,
    })
  }

  async function playCard(cardIndex) {
    if (!isMyTurn) return
    const card = myHand[cardIndex]
    if (!card) return
    // If a card was drawn this turn, only that card may be played
    if (drawnCard && drawnCard.handIdx !== cardIndex) return
    if (!canCounterDraw(card, game.drawStack, discardTop)) return
    if (!canPlay(card, discardTop, discardColor)) return
    if (card.type === 'wild' || card.type === 'wild4') {
      playUnoWild()
      setPendingCard({ card, cardIndex })
      setChoosingColor(true)
      return
    }
    await applyPlayCard(card, cardIndex, card.color)
  }

  async function chooseWildColor(color) {
    if (!pendingCard) return
    setChoosingColor(false)
    await applyPlayCard(pendingCard.card, pendingCard.cardIndex, color)
    setPendingCard(null)
  }

  async function applyPlayCard(card, cardIndex, chosenColor) {
    const newHand   = myHand.filter((_, i) => i !== cardIndex)
    const newHands  = { ...game.hands, [myUid]: newHand }
    let   deck      = [...(game.deck || [])]
    let   discard   = [...(game.discard || []), card]
    let   dir       = game.direction
    let   drawStack = game.drawStack || 0
    const n         = game.players.length
    let   nextIdx   = game.currentPlayerIndex

    if (newHand.length === 0) {
      playUnoWin()
      await updateDoc(messageRef, {
        'unoGame.hands':        newHands,
        'unoGame.discard':      discard,
        'unoGame.discardColor': chosenColor,
        'unoGame.status':       'ended',
        'unoGame.winner':       { uid: myUid, name: myName },
      })
      return
    }

    const isSpecial = ['reverse','skip','draw2','wild4'].includes(card.type)
    if (isSpecial) playUnoSpecial(); else playUnoCard()
    const effects = applyCardEffects(card, nextIdx, dir, n, drawStack)
    dir       = effects.newDir
    drawStack = effects.newDraw
    nextIdx   = effects.nextIdx
    setDrawnCard(null)

    await updateDoc(messageRef, {
      'unoGame.hands':               newHands,
      'unoGame.discard':             discard,
      'unoGame.discardColor':        chosenColor,
      'unoGame.deck':                deck,
      'unoGame.direction':           dir,
      'unoGame.drawStack':           drawStack,
      'unoGame.currentPlayerIndex':  nextIdx,
    })
  }

  async function drawCard() {
    if (!isMyTurn || drawnCard) return
    let deck = [...(game.deck || [])]
    if (deck.length < Math.max(game.drawStack || 1, 1)) {
      deck = [...deck, ...shuffle(game.discard.slice(0, -1))]
    }
    playUnoDraw()
    const n = game.players.length
    const nextIdx = nextTurn(game.currentPlayerIndex, game.direction, n)

    if (game.drawStack > 0) {
      // Forced draw — draw the stack and pass turn immediately
      const drawn   = deck.splice(0, game.drawStack)
      const newHand = [...myHand, ...drawn]
      await updateDoc(messageRef, {
        [`unoGame.hands.${myUid}`]:   newHand,
        'unoGame.deck':               deck,
        'unoGame.drawStack':          0,
        'unoGame.currentPlayerIndex': nextIdx,
      })
      return
    }

    // Voluntary draw — draw 1 card
    const drawn   = deck.splice(0, 1)
    if (!drawn.length) return
    const newCard = drawn[0]
    const newHand = [...myHand, newCard]
    const handIdx = newHand.length - 1

    if (canPlay(newCard, discardTop, discardColor)) {
      // Drawn card is playable — keep turn, let player decide
      setDrawnCard({ card: newCard, handIdx })
      await updateDoc(messageRef, {
        [`unoGame.hands.${myUid}`]: newHand,
        'unoGame.deck':             deck,
      })
    } else {
      // Not playable — pass turn
      await updateDoc(messageRef, {
        [`unoGame.hands.${myUid}`]:   newHand,
        'unoGame.deck':               deck,
        'unoGame.currentPlayerIndex': nextIdx,
      })
    }
  }

  async function passTurn() {
    if (!isMyTurn) return
    const n = game.players.length
    const nextIdx = nextTurn(game.currentPlayerIndex, game.direction, n)
    setDrawnCard(null)
    await updateDoc(messageRef, { 'unoGame.currentPlayerIndex': nextIdx })
  }

  const currentPlayerName = game.players?.[game.currentPlayerIndex]?.name || ''
  const deckCount         = game.deck?.length || 0
  const otherPlayers      = (game.players || []).filter(p => p.uid !== myUid)

  // --- Lobby ---
  if (!game.status || game.status === 'waiting') {
    return (
      <div className="uno-wrap">
        <div className="uno-lobby-box">
          <div className="uno-logo-big">UNO</div>
          <div className="uno-lobby-players">
            {(game.players || []).map(p => (
              <div key={p.uid} className="uno-lobby-player">
                {p.uid === CPU_UID ? '🤖' : '👤'} {p.name}
              </div>
            ))}
            {(game.players || []).length === 0 && <div className="uno-lobby-empty">No players yet</div>}
          </div>
          <div className="uno-lobby-actions">
            {!joined && (
              <button className="uno-btn uno-btn-join" onClick={joinGame}>Join Game</button>
            )}
            {joined && !game.players?.find(p => p.uid === CPU_UID) && (
              <button className="uno-btn uno-btn-cpu" onClick={addCpu}>+ Add CPU</button>
            )}
            {joined && game.players?.[0]?.uid === myUid && game.players.length >= 2 && (
              <button className="uno-btn uno-btn-start" onClick={startGame}>▶ Start Game</button>
            )}
            {joined && game.players.length < 2 && (
              <p className="uno-lobby-hint">Need at least 2 players to start.</p>
            )}
            {joined && game.players?.[0]?.uid !== myUid && game.players.length >= 2 && (
              <p className="uno-lobby-hint">Waiting for {game.players[0].name} to start…</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // --- Ended ---
  if (game.status === 'ended') {
    return (
      <div className="uno-wrap">
        <div className="uno-ended-box">
          <div className="uno-logo-big">UNO</div>
          <div className="uno-winner-announce">🎉 {game.winner?.name} wins!</div>
        </div>
      </div>
    )
  }

  // --- Active game ---
  return (
    <div className="uno-wrap">
      {/* Opponents row */}
      <div className="uno-opponents">
        {otherPlayers.map((p, pi) => {
          const isActive = game.players?.[game.currentPlayerIndex]?.uid === p.uid
          const count    = (game.hands?.[p.uid] || []).length
          return (
            <div key={p.uid} className={`uno-opponent${isActive ? ' uno-active-player' : ''}`}>
              <div className="uno-opp-name">{p.name}{isActive ? ' 👈' : ''}</div>
              <div className="uno-opp-hand">
                {Array.from({ length: Math.min(count, 10) }).map((_, i) => (
                  <UnoCard key={i} card={null} faceDown small stacked={i > 0} />
                ))}
                {count > 10 && <span className="uno-opp-more">+{count - 10}</span>}
              </div>
              <div className="uno-opp-count">{count} card{count !== 1 ? 's' : ''}</div>
            </div>
          )
        })}
      </div>

      {/* Play area */}
      <div className="uno-play-area">
        {/* Draw pile */}
        <div className="uno-pile-wrap" onClick={isMyTurn ? drawCard : undefined} title={isMyTurn ? (game.drawStack > 0 ? `Draw ${game.drawStack}` : 'Draw a card') : ''}>
          <UnoCard card={null} faceDown />
          <div className="uno-pile-label">
            {game.drawStack > 0 ? (
              <span className="uno-draw-stack-badge">+{game.drawStack}</span>
            ) : (
              <span>{deckCount} left</span>
            )}
          </div>
        </div>

        {/* Direction */}
        <div className="uno-dir-wrap">
          <span className="uno-dir-arrow">{game.direction === 1 ? '↻' : '↺'}</span>
          <span className="uno-dir-label">{isMyTurn ? 'Your turn!' : `${currentPlayerName}'s turn`}</span>
        </div>

        {/* Discard pile */}
        <div className="uno-pile-wrap">
          {discardTop && (
            <UnoCard
              card={{ ...discardTop, color: discardColor || discardTop.color }}
            />
          )}
          <div className="uno-pile-label">Discard</div>
        </div>
      </div>

      {/* Color picker overlay */}
      {choosingColor && (
        <div className="uno-color-overlay">
          <div className="uno-color-box">
            <div className="uno-color-title">Choose a color</div>
            <div className="uno-color-grid">
              {COLORS.map(c => (
                <button
                  key={c}
                  className="uno-color-btn"
                  style={{ background: COLOR_BG[c] }}
                  onClick={() => chooseWildColor(c)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* My hand */}
      {joined ? (
        <div className="uno-my-hand-wrap">
          <div className="uno-my-hand-label">
            Your hand ({myHand.length}) {myHand.length === 1 && <span className="uno-callout">UNO!</span>}
          </div>
          <div className="uno-my-hand">
            {myHand.map((card, i) => {
              const isDrawnCard = drawnCard?.handIdx === i
              const playable = isMyTurn &&
                (drawnCard ? isDrawnCard : true) &&
                canCounterDraw(card, game.drawStack, discardTop) &&
                canPlay(card, discardTop, discardColor)
              return (
                <UnoCard
                  key={i}
                  card={card}
                  playable={playable}
                  onClick={() => playCard(i)}
                />
              )
            })}
          </div>
          {/* After drawing a playable card, show Pass option */}
          {drawnCard && isMyTurn && (
            <button className="uno-btn uno-btn-cpu" style={{ marginTop: 8, alignSelf: 'flex-start' }} onClick={passTurn}>
              Keep & Pass
            </button>
          )}
          {/* Draw pile is disabled while holding a drawn card */}
        </div>
      ) : (
        <div className="uno-spectate">You are spectating.</div>
      )}
    </div>
  )
}
