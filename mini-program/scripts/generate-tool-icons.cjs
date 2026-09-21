// Run from any directory: node mini-program/scripts/generate-tool-icons.cjs
const sharp = require('sharp')
const fs = require('node:fs/promises')
const path = require('node:path')
const icons = {
  calendar: ['#a55a32', '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 10h16m-11 4h2m3 0h1m-6 3h2"/>'],
  contractions: ['#a44e5c', '<circle cx="12" cy="14" r="7.5"/><path d="M10 2h4m-2 0v4m6 2 2-2m-8 4v4l3 2"/>'],
  movement: ['#a44e5c', '<path d="M11 14c-3-5-7-4-7-1 0 2 1 3 1 5a3 3 0 0 0 6 0zm3-5c3-5 7-4 7-1 0 2-1 3-1 5a3 3 0 0 1-6 0z"/><circle cx="5" cy="7" r="1"/><circle cx="20" cy="2" r="1"/>'],
  weight: ['#166c5b', '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 7a8 8 0 0 1 10 0l-2 5H9zm5 3 2-3M8 17h8"/>'],
  care: ['#166c5b', '<path d="M10 5V3a2 2 0 0 1 4 0v2m-6 3-2 3v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8l-2-3M14 13h4m-3 4h3"/><rect x="7" y="5" width="10" height="3" rx="1"/>'],
  growth: ['#166c5b', '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M7 6h5m-5 4h3m-3 4h5m-5 4h3"/>'],
  packing: ['#a55a32', '<rect x="4" y="7" width="16" height="14" rx="3"/><path d="M9 7V4a3 3 0 0 1 6 0v3m-3 5v5m-2.5-2.5h5"/>'],
  vaccines: ['#166c5b', '<path d="m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5zm0 5v8m-4-4h8"/>'],
  foods: ['#a55a32', '<path d="M3 11h18c0 6-4 10-9 10S3 17 3 11zm2-4 1-4m5 4 1-4m5 4 1-4M7 22h10"/>'],
  reports: ['#785784', '<path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M8 11h8m-8 4h8m-8 4h4"/><rect x="8" y="2" width="8" height="4" rx="1.5"/>'],
  poster: ['#a44e5c', '<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="9" cy="8" r="2"/><path d="m5 17 5-5 3 3 3-4 4 6M8 19h8"/>'],
  diary: ['#785784', '<path d="M11 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6M7 17h7m-3-6 8-8 3 3-8 8-4 1z"/>'],
  album: ['#a44e5c', '<rect x="6" y="3" width="15" height="15" rx="2"/><path d="M3 7v13a2 2 0 0 0 2 2h12M7 16l4-5 3 3 3-4 3 5"/><circle cx="11" cy="7" r="1"/>'],
  expenses: ['#a55a32', '<path d="M20 7H5a2 2 0 0 1 0-4h13v4M3 5v14a2 2 0 0 0 2 2h15V7m0 5h-6v5h6"/><circle cx="16.5" cy="14.5" r=".5"/>'],
  names: ['#a55a32', '<path d="m3 4 8-1 10 10a2 2 0 0 1 0 3l-5 5a2 2 0 0 1-3 0L3 11z"/><circle cx="7" cy="7" r="1"/><path d="m12 10 5 5m-7-3 3 3"/>'],
}
async function main() {
  const destination = path.join(__dirname, '../src/static/tools')
  await fs.mkdir(destination, { recursive: true })
  await Promise.all(Object.entries(icons).map(([id, [color, drawing]]) => sharp(Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="${color}" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${drawing}</g></svg>`,
  )).resize(96, 96).png().toFile(path.join(destination, `${id}.png`))))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
