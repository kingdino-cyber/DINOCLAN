const DINOS = [
  // Scattered dinos & items — bigger, more vivid
  { emoji: '🦕', top: '25%',  left: '1%',   size: 90,  rotate: 10,   opacity: 0.18 },
  { emoji: '🦖', top: '50%',  left: '2%',   size: 110, rotate: 5,    opacity: 0.16 },
  { emoji: '🦕', top: '60%',  right: '2%',  size: 100, rotate: -10,  opacity: 0.18 },
  { emoji: '🦴', top: '72%',  left: '1%',   size: 80,  rotate: 30,   opacity: 0.20 },
  { emoji: '🥚', top: '88%',  left: '3%',   size: 76,  rotate: -5,   opacity: 0.20 },
  { emoji: '🦎', top: '92%',  right: '3%',  size: 84,  rotate: 15,   opacity: 0.18 },
  { emoji: '🌋', top: '80%',  right: '1%',  size: 120, rotate: 0,    opacity: 0.15 },
  { emoji: '🦕', top: '55%',  left: '42%',  size: 140, rotate: 12,   opacity: 0.12 },
  { emoji: '🦖', top: '78%',  left: '48%',  size: 120, rotate: -18,  opacity: 0.12 },
  { emoji: '🦴', top: '3%',   left: '48%',  size: 72,  rotate: 45,   opacity: 0.14 },
  { emoji: '🥚', top: '44%',  left: '10%',  size: 68,  rotate: -12,  opacity: 0.14 },
  { emoji: '🦕', top: '20%',  right: '18%', size: 96,  rotate: 8,    opacity: 0.15 },

  // Palm fronds — top-left corner
  { emoji: '🌴', top: '-2%',  left: '-1%',  size: 180, rotate: 15,   opacity: 0.30 },
  { emoji: '🌿', top: '1%',   left: '3%',   size: 120, rotate: -20,  opacity: 0.26 },
  { emoji: '🪴', top: '3%',   left: '0%',   size: 96,  rotate: 5,    opacity: 0.24 },

  // Palm fronds — top-right corner
  { emoji: '🌴', top: '-2%',  right: '-1%', size: 180, rotate: -15,  opacity: 0.30 },
  { emoji: '🌿', top: '1%',   right: '3%',  size: 120, rotate: 20,   opacity: 0.26 },
  { emoji: '🪴', top: '3%',   right: '0%',  size: 96,  rotate: -5,   opacity: 0.24 },

  // Palm fronds — bottom-left corner
  { emoji: '🌴', bottom: '-2%', left: '-1%', size: 180, rotate: -10, opacity: 0.28 },
  { emoji: '🌿', bottom: '1%',  left: '4%',  size: 110, rotate: 15,  opacity: 0.24 },

  // Palm fronds — bottom-right corner
  { emoji: '🌴', bottom: '-2%', right: '-1%', size: 180, rotate: 10, opacity: 0.28 },
  { emoji: '🌿', bottom: '1%',  right: '4%',  size: 110, rotate: -15,opacity: 0.24 },

  // Extra jungle mid-screen
  { emoji: '🌿', top: '15%',  left: '45%',  size: 110, rotate: -8,  opacity: 0.12 },
  { emoji: '🌱', top: '35%',  right: '1%',  size: 90,  rotate: -20, opacity: 0.18 },
  { emoji: '🍃', top: '8%',   right: '3%',  size: 96,  rotate: 20,  opacity: 0.18 },
  { emoji: '🍃', top: '4%',   left: '2%',   size: 88,  rotate: -15, opacity: 0.18 },
]

export default function DinoDecorations() {
  return (
    <div className="dino-decorations" style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
    }}>
      {DINOS.map((d, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: d.top,
            bottom: d.bottom,
            left: d.left,
            right: d.right,
            fontSize: d.size,
            opacity: d.opacity,
            transform: `rotate(${d.rotate}deg)`,
            userSelect: 'none',
            lineHeight: 1,
          }}
        >
          {d.emoji}
        </span>
      ))}
    </div>
  )
}
