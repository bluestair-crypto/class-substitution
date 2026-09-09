const tidy = value => String(value ?? '').replace(/_x000D_/gi, ' ').replace(/[\r\n]+/g, ' ').trim()

export function parseTeacherName(value) {
  const raw = tidy(value)
  const match = raw.match(/^(.*?)\s*\(([^()]*)\)\s*$/)
  return { name: (match ? match[1] : raw).trim(), hours: match ? match[2].trim() : '' }
}

const rows = sheet => sheet && Array.isArray(sheet.data) ? sheet.data : sheet

export function parseTimetable(sheet) {
  const data = rows(sheet)
  if (!Array.isArray(data) || data.length < 4) throw new Error('시간표 파일 구조를 확인해 주세요.')
  let headerRow = -1; let teacherCol = -1
  for (let r = 0; r < Math.min(data.length, 10); r++) {
    const c = (data[r] || []).findIndex(v => tidy(v) === '교사')
    if (c >= 0) { headerRow = r; teacherCol = c; break }
  }
  if (teacherCol < 0) throw new Error('시간표에서 교사 열을 찾을 수 없습니다.')
  const dayRow = data[headerRow] || []; const periodRow = data[headerRow + 1] || []
  const columns = []; let day = ''
  const dayPattern = /^(월|화|수|목|금)(요일)?$/
  for (let c = teacherCol + 1; c < Math.max(dayRow.length, periodRow.length); c++) {
    const value = tidy(dayRow[c]); if (dayPattern.test(value)) day = value[0]
    const periodText = tidy(periodRow[c]); const match = periodText.match(/(\d+)/)
    if (day && match) columns.push({ col: c, day, period: Number(match[1]) })
  }
  if (!columns.length) throw new Error('시간표에서 요일/교시 헤더를 찾을 수 없습니다.')
  const teachers = []
  for (let r = headerRow + 2; r < data.length; r++) {
    const parsed = parseTeacherName(data[r]?.[teacherCol]); if (!parsed.name) continue
    const schedule = {}
    for (const { col, day: d, period } of columns) {
      schedule[d] ||= {}; schedule[d][period] = tidy(data[r]?.[col]) !== ''
    }
    teachers.push({ ...parsed, schedule, row: r })
  }
  if (!teachers.length) throw new Error('시간표에서 교사 정보를 찾을 수 없습니다.')
  const periodsByDay = Object.fromEntries(['월','화','수','목','금'].map(d => [d, columns.filter(x => x.day === d).map(x => x.period)]).filter(([,p]) => p.length))
  return { teachers, periodsByDay }
}

export function parseSubstitutionLog(sheet) {
  const data = rows(sheet)
  if (!Array.isArray(data) || !data.length) throw new Error('결보강 일지 파일 구조를 확인해 주세요.')
  let headerRow = -1; let nameCol = -1; let totalCol = -1
  for (let r = 0; r < Math.min(data.length, 30); r++) {
    const row = data[r] || []
    const n = row.findIndex(v => /^(성명|교사|교사명|이름)$/.test(tidy(v)))
    const t = row.findIndex(v => tidy(v) === '누계')
    if (n >= 0 && t >= 0) { headerRow = r; nameCol = n; totalCol = t; break }
  }
  if (nameCol < 0) throw new Error('결보강 일지에서 교사 성명 열을 찾을 수 없습니다.')
  if (totalCol < 0) throw new Error('결보강 일지에서 누계 열을 찾을 수 없습니다.')
  const teachers = []
  for (let r = headerRow + 1; r < data.length; r++) {
    const name = tidy(data[r]?.[nameCol]); if (!name) continue
    const raw = tidy(data[r]?.[totalCol]); const total = raw === '' ? 0 : Number(raw)
    if (!Number.isFinite(total)) continue
    teachers.push({ name, total, order: teachers.length })
  }
  if (!teachers.length) throw new Error('결보강 일지에서 교사 정보를 찾을 수 없습니다.')
  return teachers
}

export function getDaySchedule(teacher, day) {
  return Object.entries(teacher.schedule?.[day] || {}).filter(([,busy]) => busy).map(([p]) => Number(p)).sort((a,b)=>a-b)
}

export function wouldCreateThreeConsecutiveClasses(existing, added) {
  const periods = [...new Set([...existing, added])].sort((a,b)=>a-b)
  return periods.some((p, i) => i >= 2 && p === periods[i-1] + 1 && p === periods[i-2] + 2)
}

export function wouldReachDailyClassLimit(existing) { return existing.length + 1 >= 5 }

export function sortCandidates(candidates) {
  return [...candidates].sort((a,b) => a.total - b.total || a.order - b.order)
}

export function calculateCandidates(teachers, logTeachers, day, period, adjustments = {}) {
  const log = new Map(logTeachers.map(x => [tidy(x.name), x])); const candidates = []; const excluded = []
  for (const teacher of teachers) {
    const reasons = []; const existing = getDaySchedule(teacher, day); const entry = log.get(tidy(teacher.name))
    if (!entry) reasons.push('결보강 순번표에 없음')
    if (teacher.hours === '18') reasons.push('18시수')
    if (existing.includes(Number(period))) reasons.push('해당 교시 기존 수업')
    if (!existing.includes(Number(period)) && wouldCreateThreeConsecutiveClasses(existing, Number(period))) {
      const all = [...new Set([...existing, Number(period)])].sort((a,b)=>a-b)
      const triple = all.findIndex((p,i)=>i>=2 && p===all[i-1]+1 && p===all[i-2]+2)
      reasons.push(`보강 시 ${all.slice(triple-2,triple+1).join('·')}교시 연속수업`)
    }
    if (!existing.includes(Number(period)) && wouldReachDailyClassLimit(existing)) reasons.push(`보강 후 하루 총 ${existing.length + 1}시간`)
    if (reasons.length) excluded.push({ name: teacher.name, reasons })
    else candidates.push({ name: teacher.name, total: entry.total + (adjustments[teacher.name] || 0), order: entry.order, existing, after: existing.length + 1 })
  }
  return { candidates: sortCandidates(candidates), excluded }
}
