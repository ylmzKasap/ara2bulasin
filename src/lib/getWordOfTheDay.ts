
export const EMOJI_KEYBOARD = [
  '🍎', '🍌', '🍋', '🍇', '🍊',
  '🍓', '🥝', '🍑', '🍒', '🍍'
] as const

const CORRECT_ANSWER: readonly (typeof EMOJI_KEYBOARD)[number][] = [
  '🍋', '🥝', '🍑', '🍒', '🍎'
]

export function getWordOfTheDay () {
  return {
    answer: CORRECT_ANSWER.join(''),
    keyboardEmojis: [...EMOJI_KEYBOARD] as string[]
  }
}
