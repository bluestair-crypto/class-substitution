import { it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { parseTimetable } from '../src/logic.js'
import { readTimetableSheet } from '../src/timetable-sheet.js'
const context = {}
runInNewContext(readFileSync(new URL('../vendor/xlsx.full.min.js', import.meta.url), 'utf8'), context)
const XLSX = context.XLSX
function fixture(header = '교사') {
  const data = [['전체 제목'], [header], [''], ['교사A(15)'], ['교사B(18)'], ['교사C']]
  const merges = [{s:{r:0,c:0},e:{r:0,c:13}}, {s:{r:1,c:0},e:{r:2,c:0}}]
  let c = 1
  for (const [day, count] of [['월',3],['화',2],['수',4],['목',2],['금',2]]) {
    data[1][c] = day + '요일'
    merges.push({s:{r:1,c},e:{r:1,c:c+count-1}})
    for (let p=1;p<=count;p++,c++) {
      data[2][c] = p
      data[3][c] = p === 1 ? '수업' : ''
      data[4][c] = ''
      data[5][c] = ''
    }
  }
  const sheet = XLSX.utils.aoa_to_sheet(data)
  sheet['!merges'] = merges
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['다른 시트']]), '안내')
  XLSX.utils.book_append_sheet(wb, sheet, '주간시간표')
  return wb
}
function parseExcel(wb, bookType='xlsx') {
  const restored = XLSX.read(XLSX.write(wb, {type:'array',bookType}), {type:'array'})
  return parseTimetable(readTimetableSheet(restored, XLSX))
}
it('A2:A3 교사 병합, 월~금 병합 헤더, 4행부터 교사 데이터 및 동적 교시', () => {
  const result = parseExcel(fixture())
  assert.deepEqual(result.periodsByDay, {월:[1,2,3],화:[1,2],수:[1,2,3,4],목:[1,2],금:[1,2]})
  assert.deepEqual(result.teachers.map(t=>[t.name,t.hours,t.row]), [['교사A','15',3],['교사B','18',4],['교사C','',5]])
  assert.equal(result.teachers[0].schedule.수[1], true)
  assert.equal(result.teachers[0].schedule.수[2], false)
})
it('헤더 내부 공백, 개행, Excel 개행 문자 및 숨은 문자', () => {
  for (const header of ['교 사', '교\r\n사', '교_x000D_사', '\uFEFF교\u200B사\u00A0']) {
    assert.equal(parseExcel(fixture(header)).teachers.length, 3)
  }
})
it('구형 XLS도 병합 헤더를 해석', () => {
  assert.equal(parseExcel(fixture('교\n사'), 'biff8').teachers.length, 3)
})
it('배열 입력과 10행 이후의 교사 헤더 탐색', () => {
  const data = [...Array.from({length:12},()=>[]), ['교 사','월',''], ['',1,2], ['교사A(15)','수업','']]
  const result = parseTimetable(data)
  assert.equal(result.teachers[0].row, 14)
  assert.deepEqual(result.periodsByDay, {월:[1,2]})
})
it('원본 행/열 좌표와 병합 정보 보존', () => {
  const wb = fixture()
  wb.Sheets['주간시간표']['!ref'] = 'B2:N6'
  const result = parseTimetable(readTimetableSheet(wb, XLSX))
  assert.equal(result.teachers[0].name, '교사A')
  assert.equal(result.teachers[0].row, 3)
})
it('교사 헤더가 없으면 A열을 임의로 교사로 간주하지 않음', () => {
  assert.throws(()=>parseExcel(fixture('알 수 없는 열')), /교사 열/)
})
it('중복 교시와 누락된 요일 헤더를 거부', () => {
  assert.throws(()=>parseTimetable([['제목'],['교사','월',''],['',1,1],['교사A','','']]), /중복/)
  assert.throws(()=>parseTimetable([['제목'],['교사'],['',1,2],['교사A','','']]), /요일\/교시/)
})
