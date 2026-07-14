/**
 * The first-run taste quiz. Each question offers options that map to genre/theme
 * names; the answers are aggregated into the user's favorite genres, which then
 * drive the "For You" highlights.
 */
export interface QuizOption {
  label: string
  emoji: string
  genres: string[]
}

export interface QuizQuestion {
  question: string
  hint: string
  options: QuizOption[]
}

export const QUIZ: QuizQuestion[] = [
  {
    question: 'What are you in the mood for?',
    hint: 'Pick any that sound good',
    options: [
      { label: 'Edge-of-seat action', emoji: '⚔️', genres: ['Action'] },
      { label: 'All the feels', emoji: '😭', genres: ['Drama', 'Romance'] },
      { label: 'Nonstop laughs', emoji: '😂', genres: ['Comedy'] },
      { label: 'Pure escapism', emoji: '🐉', genres: ['Fantasy', 'Adventure'] },
    ],
  },
  {
    question: 'Pick your ideal world',
    hint: 'Where should it take you?',
    options: [
      { label: 'Another world', emoji: '🌀', genres: ['Isekai', 'Fantasy'] },
      { label: 'Future & tech', emoji: '🚀', genres: ['Sci-Fi', 'Mecha'] },
      { label: 'Everyday life', emoji: '🍵', genres: ['Slice of Life'] },
      { label: 'Something spooky', emoji: '👻', genres: ['Supernatural', 'Horror'] },
    ],
  },
  {
    question: 'And the vibe?',
    hint: 'Last one — pick your flavor',
    options: [
      { label: 'Mind-bending mystery', emoji: '🔍', genres: ['Mystery'] },
      { label: 'Heart-racing romance', emoji: '💕', genres: ['Romance'] },
      { label: 'Team spirit & sports', emoji: '⚽', genres: ['Sports'] },
      { label: 'A little spicy', emoji: '🔥', genres: ['Ecchi'] },
    ],
  },
]
