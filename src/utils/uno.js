// UNO card utilities

export const COLORS = ['red', 'green', 'blue', 'yellow']

const COLOR_EMOJI = { red: '🔴', green: '🟢', blue: '🔵', yellow: '🟡', wild: '⬛' }
export function colorEmoji(c) { return COLOR_EMOJI[c] || '⬛' }

export function buildDeck() {
  const cards = []
  for (const color of COLORS) {
    // 0 x1
    cards.push({ color, type: 'number', value: 0 })
    // 1-9 x2
    for (let v = 1; v <= 9; v++) {
      cards.push({ color, type: 'number', value: v })
      cards.push({ color, type: 'number', value: v })
    }
    // Skip, Reverse, Draw Two x2 each
    for (const type of ['skip', 'reverse', 'draw2']) {
      cards.push({ color, type, value: null })
      cards.push({ color, type, value: null })
    }
  }
  // Wild x4, Wild Draw Four x4
  for (let i = 0; i < 4; i++) {
    cards.push({ color: 'wild', type: 'wild',  value: null })
    cards.push({ color: 'wild', type: 'wild4', value: null })
  }
  return shuffle(cards)
}

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function canPlay(card, discardTop, discardColor) {
  if (!discardTop) return true
  if (card.type === 'wild' || card.type === 'wild4') return true
  if (card.color === discardColor) return true
  if (discardTop.type === 'number' && card.type === 'number' && card.value === discardTop.value) return true
  if (card.type === discardTop.type && card.type !== 'number') return true
  return false
}

export function cardLabel(card) {
  if (!card) return ''
  const emoji = colorEmoji(card.color)
  if (card.type === 'number')  return `${emoji} ${card.value}`
  if (card.type === 'skip')    return `${emoji} Skip`
  if (card.type === 'reverse') return `${emoji} Reverse`
  if (card.type === 'draw2')   return `${emoji} +2`
  if (card.type === 'wild')    return '🌈 Wild'
  if (card.type === 'wild4')   return '🌈 Wild +4'
  return emoji
}

export function cardBg(card) {
  const map = { red: '#e63946', green: '#2a9d8f', blue: '#457b9d', yellow: '#e9c46a', wild: '#333' }
  return map[card?.color] || '#333'
}
