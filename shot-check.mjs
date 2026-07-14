import { chromium } from 'playwright'
const OUT = 'C:/Users/AM/AppData/Local/Temp/claude/I--dev/fbefe6dc-513a-40d1-be06-431558d77865/scratchpad'
const browser = await chromium.launch()
const errors = []
const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const p = await c.newPage()
await c.addInitScript(() => localStorage.setItem('lazymal-prefs', JSON.stringify({ state: { onboarded: true, genres: [], forYou: false }, version: 0 })))
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await p.goto('http://localhost:5173/lazymal/', { waitUntil: 'domcontentloaded' })
let imgs = 0
for (let i = 0; i < 25; i++) { imgs = await p.locator('main img').count(); if (imgs) break; await p.waitForTimeout(1000) }
await p.waitForTimeout(1500)
await p.screenshot({ path: `${OUT}/check-grid.png` })
console.log('imgs=' + imgs)
console.log(errors.length ? 'ERR:\n' + errors.slice(0, 6).join('\n') : 'no console errors')
await browser.close()
