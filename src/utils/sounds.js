let audioCtx = null

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

// Nice double-bing for incoming messages
export function playMessageSound() {
  try {
    const ctx = getCtx()
    const t = ctx.currentTime

    function note(freq, startOffset, duration, vol = 0.18) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t + startOffset)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, t + startOffset + duration)
      gain.gain.setValueAtTime(0, t + startOffset)
      gain.gain.linearRampToValueAtTime(vol, t + startOffset + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, t + startOffset + duration)
      osc.start(t + startOffset)
      osc.stop(t + startOffset + duration)
    }

    note(1047, 0, 0.22)       // C6
    note(1319, 0.12, 0.28)    // E6
  } catch (e) {}
}

// Repeating phone-ring for incoming calls — returns a stop() function
export function playCallRing() {
  try {
    const ctx = getCtx()
    let active = true

    function ring() {
      if (!active) return
      const t = ctx.currentTime

      function pulse(freq, start) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0, t + start)
        gain.gain.linearRampToValueAtTime(0.2, t + start + 0.02)
        gain.gain.setValueAtTime(0.2, t + start + 0.18)
        gain.gain.exponentialRampToValueAtTime(0.001, t + start + 0.22)
        osc.start(t + start)
        osc.stop(t + start + 0.22)
      }

      pulse(880, 0)
      pulse(1100, 0.25)
      pulse(880, 0.5)

      setTimeout(ring, 1800)
    }

    ring()
    return () => { active = false }
  } catch (e) {
    return () => {}
  }
}

// Low descending tone when call ends
export function playCallEnd() {
  try {
    const ctx = getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(520, t)
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.5)
    gain.gain.setValueAtTime(0.2, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    osc.start(t)
    osc.stop(t + 0.5)
  } catch (e) {}
}

// Short blip when joining a call
export function playCallJoin() {
  try {
    const ctx = getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, t)
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.15)
    gain.gain.setValueAtTime(0.15, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    osc.start(t); osc.stop(t + 0.2)
  } catch (e) {}
}
