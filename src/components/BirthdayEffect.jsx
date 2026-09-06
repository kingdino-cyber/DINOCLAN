import { useEffect, useRef } from 'react'

const COLORS = [
  '#4caf50','#81c784','#ffeb3b','#ff5252','#ff9800',
  '#2196f3','#e91e63','#00bcd4','#9c27b0','#ffffff',
  '#f06292','#aed581','#4dd0e1','#ffd54f','#ce93d8',
]
const DURATION = 15000

function playPartySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [523, 659, 784, 1047, 784, 659, 523, 880, 1047]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'sine'
      const t = ctx.currentTime + i * 0.15
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.2, t + 0.04)
      gain.gain.linearRampToValueAtTime(0, t + 0.2)
      osc.start(t); osc.stop(t + 0.22)
    })
  } catch {}
}

function spawnParticle(container) {
  const el = document.createElement('div')
  const color = COLORS[Math.floor(Math.random() * COLORS.length)]
  const size = 6 + Math.random() * 12
  const left = -5 + Math.random() * 110
  const dur = 2.5 + Math.random() * 3.5
  const delay = Math.random() * 0.5
  const shape = Math.random()
  const drift = (Math.random() - 0.5) * 120
  const spin = (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720)

  let borderRadius = '2px'
  let w = size, h = size * 0.45
  if (shape < 0.25) { borderRadius = '50%'; w = size * 0.7; h = size * 0.7 }
  else if (shape < 0.5) { borderRadius = '50% 0 50% 0'; }
  else if (shape < 0.7) { w = size * 0.3; h = size * 1.2; borderRadius = '1px' }

  el.style.cssText = `
    position:absolute;
    top:-${h + 10}px;
    left:${left}%;
    width:${w}px;
    height:${h}px;
    background:${color};
    border-radius:${borderRadius};
    animation:bd-fall ${dur}s ${delay}s cubic-bezier(.25,.46,.45,.94) forwards;
    --drift:${drift}px;
    --spin:${spin}deg;
    opacity:0.95;
    pointer-events:none;
  `
  container.appendChild(el)
  setTimeout(() => el.remove(), (dur + delay + 0.5) * 1000)
}

export default function BirthdayEffect({ onDone }) {
  const containerRef = useRef(null)

  useEffect(() => {
    playPartySound()
    const container = containerRef.current
    if (!container) return

    // Initial burst — 200 particles
    for (let i = 0; i < 200; i++) {
      setTimeout(() => spawnParticle(container), i * 18)
    }

    // Continuous rain for the duration
    const intervals = []
    const rain = setInterval(() => spawnParticle(container), 60)
    intervals.push(rain)

    // Extra bursts
    const b2 = setTimeout(() => { playPartySound(); for (let i = 0; i < 80; i++) setTimeout(() => spawnParticle(container), i * 20) }, 5000)
    const b3 = setTimeout(() => { playPartySound(); for (let i = 0; i < 80; i++) setTimeout(() => spawnParticle(container), i * 20) }, 10000)

    const stop = setTimeout(() => {
      clearInterval(rain)
      onDone?.()
    }, DURATION)

    return () => {
      clearInterval(rain)
      clearTimeout(b2); clearTimeout(b3); clearTimeout(stop)
    }
  }, [])

  return (
    <>
      <style>{`
        @keyframes bd-fall {
          0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0.95; }
          80%  { opacity: 0.85; }
          100% { transform: translateY(108vh) translateX(var(--drift)) rotate(var(--spin)); opacity: 0; }
        }
        @keyframes bd-pop {
          0%   { transform: translate(-50%,-50%) scale(0.5); opacity: 0; }
          60%  { transform: translate(-50%,-50%) scale(1.08); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
        }
      `}</style>
      <div style={{
        position:'fixed', inset:0, zIndex:99999, pointerEvents:'none', overflow:'hidden',
      }} ref={containerRef}>
        <div style={{
          position:'absolute', top:'50%', left:'50%',
          animation:'bd-pop 0.5s cubic-bezier(.34,1.56,.64,1) forwards',
          transform:'translate(-50%,-50%) scale(0.5)', opacity:0,
          background:'rgba(10,26,10,0.93)',
          borderRadius:24, padding:'32px 40px',
          textAlign:'center', pointerEvents:'auto',
          border:'2px solid rgba(76,175,80,0.5)',
          boxShadow:'0 12px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(76,175,80,0.15)',
          minWidth:280,
        }}>
          <img
            src="/dinoclan-logo.png"
            alt="DINOCLAN"
            style={{width:90,height:90,objectFit:'contain',marginBottom:12,
              filter:'drop-shadow(0 4px 16px rgba(76,175,80,0.5))'}}
          />
          <div style={{fontSize:36,marginBottom:4}}>🎉</div>
          <div style={{color:'#fff',fontSize:22,fontWeight:900,marginBottom:6,letterSpacing:'-0.5px'}}>
            Happy Birthday!
          </div>
          <div style={{color:'#81c784',fontSize:14,lineHeight:1.6}}>
            The whole DINOCLAN herd<br/>is celebrating you today!
          </div>
        </div>
      </div>
    </>
  )
}
