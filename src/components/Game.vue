<script setup lang="ts">
import { onUnmounted } from 'vue'
import Keyboard from './Keyboard.vue'
import { GameCompleteProps, LettersGuessedProps, LettersGuessed, LetterState, OtherUser } from '../types'

const emit = defineEmits<{
  (e: 'lettersGuessed', key: LettersGuessedProps): void
  (e: 'gameComplete', key: GameCompleteProps): void
  (e: 'sendScores', key: {success: boolean}): void
}>()

const { answer, keyboardEmojis, myPresence, letterStates } = defineProps<{
  answer: string,
  keyboardEmojis: string[],
  myPresence: OtherUser,
  letterStates: LettersGuessed
}>()

function isAllowedEmoji (key: string) {
  return keyboardEmojis.includes(key)
}

function createEmptyBoard () {
  return Array.from({ length: 6 }, () =>
    Array.from({ length: 5 }, () => ({
      letter: '',
      state: LetterState.INITIAL
    }))
  )
}

function isValidBoardShape (maybeBoard: unknown): boolean {
  return Array.isArray(maybeBoard) &&
    maybeBoard.length === 6 &&
    maybeBoard.every((row) =>
      Array.isArray(row) &&
      row.length === 5 &&
      row.every((tile) =>
        tile &&
        typeof tile === 'object' &&
        'letter' in tile &&
        'state' in tile
      )
    )
}

// Board state. Each tile is represented as { letter, state }
const board = $ref(isValidBoardShape(myPresence.board) ? myPresence.board : createEmptyBoard())

// Current active row.
let currentRowIndex = $ref(myPresence.rowsComplete ? myPresence.rowsComplete : 0)
const currentRow = $computed(() => board[currentRowIndex])

// Feedback state: message and shake
let message = $ref('')
let grid = $ref('')
let shakeRowIndex = $ref(-1)
let success = $ref(false)

// Handle keyboard input.
let allowInput = true

const onKeyup = (e: KeyboardEvent) => onKey(e.key)

window.addEventListener('keyup', onKeyup)

onUnmounted(() => {
  window.removeEventListener('keyup', onKeyup)
})

function onKey (key: string) {
  if (!allowInput) return
  if (isAllowedEmoji(key)) {
    fillTile(key)
  } else if (key === 'Backspace') {
    clearTile()
  } else if (key === 'Enter') {
    completeRow()
  }
}

function fillTile (letter: string) {
  for (const tile of currentRow) {
    if (!tile.letter) {
      tile.letter = letter
      break
    }
  }
}

function clearTile () {
  for (const tile of [...currentRow].reverse()) {
    if (tile.letter) {
      tile.letter = ''
      break
    }
  }
}

function completeRow () {
  if (currentRow.every((tile) => tile.letter)) {
    const guessUnits = currentRow.map((tile) => tile.letter)
    const normalizedAnswer = String(answer).trim()
    const answerUnits = [...normalizedAnswer]

    if (
      guessUnits.length !== 5 ||
      answerUnits.length !== 5 ||
      !guessUnits.every((g) => isAllowedEmoji(g))
    ) {
      shake()
      showMessage('5 emoji sec')
      return
    }

    const resultStates: LetterState[] = Array.from({ length: 5 }, () => LetterState.ABSENT)
    const remainingAnswerCounts: Record<string, number> = {}

    // Pass 1: exact matches (green), collect remaining answer emojis.
    for (let i = 0; i < 5; i++) {
      const guessed = guessUnits[i]
      const ans = answerUnits[i]
      if (guessed === ans) {
        resultStates[i] = LetterState.CORRECT
      } else {
        remainingAnswerCounts[ans] = (remainingAnswerCounts[ans] || 0) + 1
      }
    }

    // Pass 2: misplaced matches (yellow) using remaining counts.
    for (let i = 0; i < 5; i++) {
      if (resultStates[i] === LetterState.CORRECT) continue
      const guessed = guessUnits[i]
      if ((remainingAnswerCounts[guessed] || 0) > 0) {
        resultStates[i] = LetterState.PRESENT
        remainingAnswerCounts[guessed] -= 1
      }
    }

    // Apply row states and merge keyboard states without downgrading colors.
    const statePriority: Record<LetterState, number> = {
      [LetterState.INITIAL]: 0,
      [LetterState.ABSENT]: 1,
      [LetterState.PRESENT]: 2,
      [LetterState.CORRECT]: 3
    }

    currentRow.forEach((tile, i) => {
      const state = resultStates[i]
      tile.state = state

      const previous = letterStates[tile.letter] || LetterState.INITIAL
      if (statePriority[state] > statePriority[previous]) {
        letterStates[tile.letter] = state
      }
    })

    // Emit lettersGuessed event to parent
    emit('lettersGuessed', { letterStates: letterStates, letterBoard: board })

    allowInput = false
    if (resultStates.every((state) => state === LetterState.CORRECT)) {
      // yay!
      emit('sendScores', { success: true });
      setTimeout(() => {
        grid = genResultGrid()
        showMessage(
          ['Devenin bale pabucu!', 'Yok devenin nalı!', 'Süper sonik', 'Fecaat', 'Dehşet', 'Dehşetengiz'][
            currentRowIndex
          ],
          -1
        )
        emit('gameComplete', { success: true, successGrid: grid })
        success = true
      }, 1600)
    } else if (currentRowIndex < board.length - 1) {
      // go the next row
      currentRowIndex++
      setTimeout(() => {
        allowInput = true
      }, 1600)
    } else {
      // game over :(
      emit('sendScores', { success: false });
      setTimeout(() => {
        showMessage(answer, -1)
        emit('gameComplete', { success: false })
      }, 1600)
    }
  } else {
    shake()
    showMessage('5 emoji doldur')
  }
}

function showMessage (msg: string, time = 1000) {
  message = msg
  if (time > 0) {
    setTimeout(() => {
      message = ''
    }, time)
  }
}

function shake () {
  shakeRowIndex = currentRowIndex
  setTimeout(() => {
    shakeRowIndex = -1
  }, 1000)
}

const icons = {
  [LetterState.CORRECT]: '🟩',
  [LetterState.PRESENT]: '🟨',
  [LetterState.ABSENT]: '⬜',
  [LetterState.INITIAL]: null
}

function genResultGrid () {
  return board
    .slice(0, currentRowIndex + 1)
    .map((row) => {
      return row.map((tile) => icons[tile.state]).join('')
    })
    .join('\n')
}

</script>

<template>
  <Transition>
  </Transition>
  <div id="board-wrapper">
    <div id="board">
      <div v-if="message" :class="['board-message', 'backdrop-blur', success && 'board-message-success']">
        <button v-if="success" @click="message = ''" class="absolute right-6 top-3 text-gray-300 hover:text-gray-100 focus:text-gray-100 w-8 h-8 flex items-center justify-center -mr-3 rounded-full">
          <span class="sr-only">İletişim kutusunu kapat</span>
          <svg class="w-6 h-6" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M2.96967 11.9697L11.9697 2.96967L13.0303 4.03033L4.03033 13.0303L2.96967 11.9697Z"></path>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M13.0303 11.9697L4.03033 2.96967L2.96968 4.03033L11.9697 13.0303L13.0303 11.9697Z"></path>
          </svg>
        </button>
        <div class="board-message-main">
          {{ message }}
        </div>
        <div v-if="success">
          Diğer amatörler bekleniyor...
        </div>
      </div>
      <div class="board-left">
        <slot name="board-left" />
      </div>
      <div
        v-for="(row, index) in board"
        :key="`row-${index}`"
        :class="[
          'row',
          shakeRowIndex === index && 'shake',
          success && currentRowIndex === index && 'jump'
        ]"
      >
        <div
          v-for="(tile, index) in row"
          :key="`tile-${index}`"
          :class="['tile', tile.letter && 'filled', tile.state && 'revealed']"
        >
          <div class="front" :style="{ transitionDelay: `${index * 300}ms` }">
            {{ tile.letter }}
          </div>
          <div
            :class="['back', tile.state]"
            :style="{
              transitionDelay: `${index * 300}ms`,
              animationDelay: `${index * 100}ms`
            }"
          >
            {{ tile.letter }}
          </div>
        </div>
      </div>
      <div class="board-right">
        <slot name="board-right" />
      </div>
    </div>
  </div>
  <div id="keyboard-wrapper">
    <Keyboard @key="onKey" :letter-states="letterStates" :keyboard-emojis="keyboardEmojis" />
  </div>
</template>

<style scoped>
#board-wrapper {
  --border-radius: 4px;

  display: flex;
  width: 100%;
  max-width: 100vw;
  justify-content: center;
  align-items: center;
  margin: 0 auto;
  flex-grow: 12;
  --height: min(420px, calc(var(--vh, 100vh) - 380px)); /* was 310 */
  overflow: hidden;
}

#board {
  display: grid;
  grid-template-rows: repeat(6, 1fr);
  grid-gap: 5px;
  box-sizing: border-box;
  height: var(--height);
  width: min(350px, calc(var(--height) / 6 * 5));
  position: relative;
}

.board-left, .board-right {
  position: absolute;
  top: 0;
  bottom: 0;
}

.board-left {
  right: 100%;
}

.board-right {
  left: 100%;
}

#keyboard-wrapper {
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
}

.board-message {
  white-space: nowrap;
  font-size: 16px;
  position: absolute;
  left: 50%;
  top: 80px;
  color: #fff;
  background-color: rgba(0, 0, 0, 0.80);
  padding: 16px 20px;
  z-index: 2;
  border-radius: var(--border-radius);
  transform: translateX(-50%);
  transition: opacity 0.3s ease-out;
  font-weight: 600;
}

.board-message.board-message-success {
  white-space: normal;
  font-size: 16px;
  width: 100%;
  max-width: 80%;
}

/*
.board-message.board-message-success {
  white-space: normal;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: 4px;
  color: #fff;
  background-color: rgba(0, 0, 0, 0.80);
  padding: 16px 20px;
  z-index: 2;
  border-radius: var(--border-radius);
  transition: opacity 0.3s ease-out;
  font-size: 18px;
  text-align: center;
  transform: none;
}
 */

.board-message-success .board-message-main {
  font-size: 21px;
  font-weight: 500;
  margin-bottom: 10px;
}

.message.v-leave-to {
  opacity: 0;
}

.row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-gap: 5px;
}

.tile {
  width: 100%;
  font-size: 1.75rem;
  line-height: 2rem;
  font-weight: bold;
  vertical-align: middle;
  text-transform: none;
  user-select: none;
  position: relative;
}

.tile.filled {
  animation: zoom 0.2s;
}

.tile .front,
.tile .back {
  box-sizing: border-box;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transition: transform 0.6s;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: var(--border-radius);
}

.tile {
  color: #000;
}

.dark .tile {
  color: #fff;
}

.tile .front {
  border: 2px solid #d3d6da;
}

.dark .tile .front {
  border-color: #3F3F46;
}

.tile.filled .front {
  border-color: #999;
}

.dark .tile.filled .front {
  border-color: #52525B;
}

.tile .back {
  transform: rotateX(180deg);
}

.tile.revealed .front {
  transform: rotateX(180deg);
}

.tile.revealed .back {
  transform: rotateX(0deg);
}

@keyframes zoom {
  0% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

.shake {
  animation: shake 0.5s;
}

@keyframes shake {
  0% {
    transform: translate(1px);
  }
  10% {
    transform: translate(-2px);
  }
  20% {
    transform: translate(2px);
  }
  30% {
    transform: translate(-2px);
  }
  40% {
    transform: translate(2px);
  }
  50% {
    transform: translate(-2px);
  }
  60% {
    transform: translate(2px);
  }
  70% {
    transform: translate(-2px);
  }
  80% {
    transform: translate(2px);
  }
  90% {
    transform: translate(-2px);
  }
  100% {
    transform: translate(1px);
  }
}

.jump .tile .back {
  animation: jump 0.5s;
}

@keyframes jump {
  0% {
    transform: translateY(0px);
  }
  20% {
    transform: translateY(5px);
  }
  60% {
    transform: translateY(-25px);
  }
  90% {
    transform: translateY(3px);
  }
  100% {
    transform: translateY(0px);
  }
}

@media (max-height: 680px) {
  .tile {
    font-size: 3vh;
  }
}

@media (max-width: 715px) {
  .board-left, .board-right {
    display: none;
  }
}
</style>
