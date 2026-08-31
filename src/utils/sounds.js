// DinoLAN sounds — chess only

let ctx = null
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq, duration, type = 'sine', vol = 0.25, startTime = 0) {
  try {
    const c    = getCtx()
    const t    = c.currentTime + startTime
    const osc  = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.start(t)
    osc.stop(t + duration)
  } catch (_) {}
}

function noise(duration, vol = 0.3, startTime = 0) {
  try {
    const c      = getCtx()
    const t      = c.currentTime + startTime
    const frames = Math.floor(c.sampleRate * duration)
    const buf    = c.createBuffer(1, frames, c.sampleRate)
    const data   = buf.getChannelData(0)
    for (let i = 0; i < frames; i++)
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (frames * 0.25))
    const src  = c.createBufferSource()
    src.buffer = buf
    const gain = c.createGain()
    gain.gain.value = vol
    src.connect(gain)
    gain.connect(c.destination)
    src.start(t)
  } catch (_) {}
}

export function playMessageSound() {}

// Plays a repeating phone-ring pattern; returns a stop() function
export function playCallRing() {
  let stopped = false
  function ring() {
    if (stopped) return
    tone(880, 0.15, 'sine', 0.3)
    tone(660, 0.15, 'sine', 0.25, 0.18)
    if (!stopped) setTimeout(ring, 1200)
  }
  ring()
  return function stop() { stopped = true }
}

export function playCallEnd() {
  tone(440, 0.1, 'sine', 0.2)
  tone(330, 0.2, 'sine', 0.18, 0.1)
}

export function playCallJoin() {
  tone(523, 0.1, 'sine', 0.2)
  tone(659, 0.12, 'sine', 0.18, 0.08)
}

// Chess piece placed
export function playChessMove() {
  noise(0.05, 0.35)
  tone(300, 0.08, 'sine', 0.08, 0.01)
}

// Chess piece captured
export function playChessCapture() {
  noise(0.07, 0.45)
  tone(220, 0.1, 'sine', 0.1, 0.02)
}

// Checkmate / puzzle solved
export function playCheckmate() {
  const melody = [523, 659, 784, 1047, 784, 1047]
  melody.forEach((freq, i) => tone(freq, 0.3, 'sine', 0.25, i * 0.1))
}

// Puzzle fail — descending sad tones
export function playFail() {
  tone(440, 0.12, 'sawtooth', 0.2)
  tone(330, 0.15, 'sawtooth', 0.18, 0.12)
  tone(220, 0.3,  'sawtooth', 0.15, 0.25)
}

// Wrong move in chess puzzle
export function playWrongMove() {
  tone(200, 0.06, 'sawtooth', 0.3)
  tone(170, 0.1,  'sawtooth', 0.25, 0.06)
}

// UNO — card played
export function playUnoCard() {
  noise(0.04, 0.3)
  tone(500, 0.06, 'sine', 0.1, 0.02)
}

// UNO — draw card
export function playUnoDraw() {
  noise(0.06, 0.25)
  tone(300, 0.08, 'sine', 0.08, 0.03)
}

// UNO — skip / reverse / special card
export function playUnoSpecial() {
  tone(660, 0.08, 'sine', 0.15)
  tone(880, 0.1,  'sine', 0.12, 0.07)
  tone(660, 0.08, 'sine', 0.1,  0.15)
}

// UNO — wild card chosen
export function playUnoWild() {
  const freqs = [523, 659, 784, 988]
  freqs.forEach((f, i) => tone(f, 0.12, 'sine', 0.18, i * 0.07))
}

// UNO — someone wins
export function playUnoWin() {
  const melody = [523, 659, 784, 1047, 1047, 784, 1047]
  melody.forEach((f, i) => tone(f, 0.25, 'sine', 0.28, i * 0.09))
}
