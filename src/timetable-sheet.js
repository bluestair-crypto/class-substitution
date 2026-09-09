// Keep Excel row/column coordinates and merge metadata; never upload workbook data.
export function readTimetableSheet(workbook, XLSX) {
  const normalize = value => String(value).replace(/[\s\u200B-\u200D\uFEFF]/g, '')
  const name = workbook.SheetNames.find(n => normalize(n) === '주간시간표') || workbook.SheetNames[0]
  const sheet = workbook.Sheets[name]
  if (!sheet?.['!ref']) throw new Error('시간표 파일 구조를 확인해 주세요.')
  const range = XLSX.utils.decode_range(sheet['!ref'])
  range.s = { r: 0, c: 0 }
  return {
    data: XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true, blankrows: true, range }),
    merges: sheet['!merges'] || []
  }
}
