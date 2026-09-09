import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
const expect = actual => ({ toBe: expected => assert.equal(actual, expected), toEqual: expected => assert.deepEqual(actual, expected), toContain: expected => assert.ok(actual.includes(expected)) })
import { calculateCandidates, wouldCreateThreeConsecutiveClasses } from '../src/logic.js'
const teacher=(name,hours='',periods=[])=>({name,hours,schedule:{월:Object.fromEntries([1,2,3,4,5,6,7].map(p=>[p,periods.includes(p)]))}})
const log=(...items)=>items.map(([name,total],order)=>({name,total,order}))
describe('추천 조건',()=>{
 it('앞 또는 양쪽 수업으로 3연속이 되면 제외한다',()=>{expect(wouldCreateThreeConsecutiveClasses([2,3],4)).toBe(true);expect(wouldCreateThreeConsecutiveClasses([3,5],4)).toBe(true)})
 it('기존 4시간은 제외하고 3시간은 허용한다',()=>{const r=calculateCandidates([teacher('교사A','',[1,2,4,6]),teacher('교사B','',[1,3,6])],log(['교사A',0],['교사B',0]),'월',7);expect(r.candidates.map(x=>x.name)).toEqual(['교사B']);expect(r.excluded[0].reasons).toContain('보강 후 하루 총 5시간')})
 it('18시수와 순번표 밖 교사를 제외한다',()=>{const r=calculateCandidates([teacher('교사A','18'),teacher('교사B')],log(['교사A',0]),'월',1);expect(r.excluded.find(x=>x.name==='교사A').reasons).toContain('18시수');expect(r.excluded.find(x=>x.name==='교사B').reasons).toContain('결보강 순번표에 없음')})
 it('누계가 적은 순, 동률이면 일지 순으로 정렬한다',()=>{const r=calculateCandidates([teacher('교사A'),teacher('교사B'),teacher('교사C')],log(['교사B',1],['교사C',0],['교사A',1]),'월',1);expect(r.candidates.map(x=>x.name)).toEqual(['교사C','교사B','교사A'])})
})
