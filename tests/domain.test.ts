import { describe,it,expect } from 'vitest';
import { fixture } from './fixtures/resume';
import { selectVisible,safeUrl,filename } from '../src/domain/resume';
import { validateExport } from '../src/domain/schemas';
import { makeAiRequest,generateSchema,validateProposal,applyProposal,maskContacts } from '../src/domain/ai';
import { restoreChange } from '../src/domain/commands';
describe('Резюме и экспорт',()=>{
  it('проверяет контакты независимо от возможности черновика',()=>{const r=fixture();expect(validateExport(r)).toEqual({});r.contacts.email='invalid';expect(validateExport(r)['contacts.email']).toBeTruthy();});
  it('исключает скрытые данные физически и не меняет оригинал',()=>{const r=fixture();r.personal.birthDate='1990-01-01';r.presentation.hiddenSections=['experience','summary'];const v=selectVisible(r);expect(v.experience).toEqual([]);expect(v.summary).toBe('');expect(v.personal.birthDate).toBeNull();expect(r.experience.length).toBe(1);});
  it('не блокирует экспорт из-за неполной скрытой записи',()=>{const r=fixture();r.experience[0].company='';expect(validateExport(r)['experience.0.company']).toBeTruthy();r.presentation.hiddenSections=['experience'];expect(validateExport(r)).toEqual({});});
  it('проверяет последовательность дат',()=>{const r=fixture();r.experience[0].end='2020-01';expect(validateExport(r)['experience.0.end']).toBeTruthy();});
  it('блокирует опасные ссылки и формирует безопасное имя',()=>{expect(safeUrl('javascript:alert(1)')).toBe('');expect(safeUrl('https://example.com')).toBe('https://example.com/');const r=fixture();r.personal.fullName='Анна/Соколова:*';expect(filename(r,'mobile')).toBe('Резюме_АннаСоколова_Mobile.pdf');});
  it('отмена сохраняет несвязанные правки, но не стирает новый текст',()=>{const before=fixture();const after=structuredClone(before);after.summary='Новый текст';after.revision++;const current=structuredClone(after);current.contacts.city='Самарканд';current.revision++;const restored=restoreChange(before,after,current);expect(restored?.summary).toBe(before.summary);expect(restored?.contacts.city).toBe('Самарканд');current.summary='Написано вручную';expect(restoreChange(before,after,current)).toBeNull();});
});
describe('Приватность и предложения ИИ',()=>{
  it('отправляет только разрешённые поля',()=>{const r=fixture();r.personal.birthDate='1990-01-01';r.presentation.hiddenSections=['education'];const req=makeAiRequest(r,'all');const json=JSON.stringify(req);expect(json).not.toContain(r.personal.fullName);expect(json).not.toContain(r.contacts.email);expect(json).not.toContain(r.contacts.phone);expect(json).not.toContain('1990-01-01');expect(req.source.education).toEqual([]);expect(generateSchema.safeParse({...req,personal:r.personal}).success).toBe(false);});
  it('маскирует контакты внутри свободного текста',()=>{expect(maskContacts('Почта anna@example.com, телефон +998 90 123 45 67')).not.toContain('anna@example.com');expect(maskContacts('+998 90 123 45 67')).toBe('[телефон скрыт]');});
  it('отклоняет выдуманные числа, ссылки и лишний scope',()=>{const r=fixture();const req=makeAiRequest(r,'summary');expect(()=>validateProposal({proposal:{summary:'Повысила продажи на 99%'},questions:[],warnings:[]},req)).toThrow();expect(()=>validateProposal({proposal:{strengths:[{text:'Системность',evidenceRefs:['invented']}]},questions:[],warnings:[]},req)).toThrow();});
  it('применяет предложение без изменения фактов и блокирует старое',()=>{const r=fixture();const req=makeAiRequest(r,'summary');const p=validateProposal({proposal:{summary:'Создаю прототипы и исследую задачи пользователей.'},questions:[],warnings:[]},req);const next=applyProposal(r,p,['summary']);expect(next.summary).toBe(p.proposal.summary);expect(next.personal).toEqual(r.personal);expect(next.contacts).toEqual(r.contacts);r.revision++;expect(()=>applyProposal(r,p,['summary'])).toThrow();});
});
