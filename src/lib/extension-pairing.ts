import { randomInt } from 'node:crypto'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generatePairingCode(): string {
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('')
}
