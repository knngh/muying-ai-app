const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

const root = path.resolve(__dirname, '..')
const cases = [
  ['src/components/tools/ReportArchive.vue', 'uni.chooseImage('],
  ['src/pages/tool-detail/index.vue', 'uni.chooseImage('],
  ['src/components/tools/StagePoster.vue', 'uni.saveImageToPhotosAlbum('],
]

for (const [relativePath, apiCall] of cases) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
  const gateIndex = source.indexOf('await ensurePrivacyAuthorization()')
  const apiIndex = source.indexOf(apiCall, gateIndex)
  assert.ok(gateIndex >= 0 && apiIndex > gateIndex, relativePath + ': privacy authorization must precede ' + apiCall)
  assert.ok(source.includes('<PrivacyAuthorizationPrompt'), relativePath + ': privacy prompt is not mounted')
}

const prompt = fs.readFileSync(path.join(root, 'src/components/PrivacyAuthorizationPrompt.vue'), 'utf8')
assert.ok(prompt.includes('open-type="agreePrivacyAuthorization"'), 'privacy prompt must use the platform agreement button')
assert.ok(prompt.includes('@agreeprivacyauthorization="emit(\'agree\')"'), 'privacy prompt must wait for the agreement event')

console.log('PASS privacy gates: ' + cases.length + ' photo operations and agreement prompt')
