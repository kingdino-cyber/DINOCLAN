export const DINO_EMOJIS = ['🦕', '🦖', '🐊', '🦎', '🐢', '🥚', '🦴', '🌋']
export const CODE_LENGTH = 4

export function generateDinoCode() {
  return Array.from({ length: CODE_LENGTH }, () =>
    DINO_EMOJIS[Math.floor(Math.random() * DINO_EMOJIS.length)]
  ).join('')
}
