import { it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
it('project paths resolve beneath /class-substitution/ and all entry files exist', () => {
  const html = read('index.html')
  const paths = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1])
  assert.ok(paths.length >= 3)
  for (const path of paths) {
    assert.ok(path.startsWith('./'))
    assert.ok(new URL(path, 'https://example.com/class-substitution/').pathname.startsWith('/class-substitution/'))
    assert.ok(existsSync(new URL('../' + path, import.meta.url)))
  }
  assert.ok(html.includes("connect-src 'none'"))
  assert.ok(html.includes('startup-status'))
  assert.ok(!read('src/main.js').includes("from 'xlsx'"))
  assert.ok(!read('src/main.js').includes("import './style.css'"))
})
it('vendored Excel library reads an XLSX workbook without external dependencies', () => {
  const context = {}
  runInNewContext(read('vendor/xlsx.full.min.js'), context)
  const x = context.XLSX
  assert.equal(x.version, '0.18.5')
  const wb = x.utils.book_new()
  x.utils.book_append_sheet(wb, x.utils.aoa_to_sheet([['성명','누계'],['교사A',2]]), '9월')
  const result = x.read(x.write(wb, {type:'array', bookType:'xlsx'}), {type:'array'})
  assert.equal(result.Sheets['9월'].A2.v, '교사A')
  assert.equal(result.Sheets['9월'].B2.v, 2)
})
