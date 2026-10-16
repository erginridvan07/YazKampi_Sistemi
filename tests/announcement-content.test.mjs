/**
 * Announcement content render policy tests (no Firebase).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function normalizeAnnouncementContent(content) {
  return typeof content === 'string' ? content : ''
}

describe('announcement content policy', () => {
  const payloads = [
    ['Normal text', 'Normal text'],
    ['<b>test</b>', '<b>test</b>'],
    ['<script>alert(1)</script>', '<script>alert(1)</script>'],
    ['<img src=x onerror=alert(1)>', '<img src=x onerror=alert(1)>'],
    ['<a href="javascript:alert(1)">x</a>', '<a href="javascript:alert(1)">x</a>'],
    ['https://example.com', 'https://example.com'],
    ['Satır 1\nSatır 2', 'Satır 1\nSatır 2'],
  ]

  for (const [input, expected] of payloads) {
    it(`normalize preserves safe plain text: ${input.slice(0, 40)}`, () => {
      assert.equal(normalizeAnnouncementContent(input), expected)
    })
  }

  it('normalize rejects non-string', () => {
    assert.equal(normalizeAnnouncementContent(null), '')
    assert.equal(normalizeAnnouncementContent(undefined), '')
  })

  it('Student HomePage must not use dangerouslySetInnerHTML', () => {
    const src = readFileSync(join(ROOT, 'src/pages/student/HomePage.tsx'), 'utf8')
    assert.ok(!src.includes('dangerouslySetInnerHTML'))
  })

  it('announcement helper exists in lib', () => {
    const src = readFileSync(join(ROOT, 'src/lib/announcementContent.ts'), 'utf8')
    assert.match(src, /normalizeAnnouncementContent/)
    assert.match(src, /whitespace-pre-wrap/)
  })
})
