import { z } from 'zod';
import { type Resume, selectVisible, safeUrl, telegramUrl, localDate } from './resume';
const s = z.string();
const id = s.min(1).max(100);
const month = s.regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable();
export const experienceSchema = z.object({ id, company: s.max(200), position: s.max(200), start: month, end: month, current: z.boolean(), responsibilities: z.array(s.max(1000)).max(30), achievements: z.array(s.max(1000)).max(30) }).strict();
export const educationSchema = z.object({ id, institution: s.max(200), specialty: s.max(200), level: s.max(200), startYear: z.number().int().min(1900).max(2200).nullable(), endYear: z.number().int().min(1900).max(2200).nullable(), current: z.boolean(), details: s.max(3000) }).strict();
export const skillSchema = z.object({ id, name: s.max(80), group: s.max(100).nullable() }).strict();
export const projectSchema = z.object({ id, name: s.max(200), kind: z.enum(['personal','educational','other']), description: s.max(3000), url: s.max(2048) }).strict();
export const courseSchema = z.object({ id, name: s.max(200), organization: s.max(200), year: z.number().int().min(1900).max(2200).nullable() }).strict();
const section = z.enum(['summary','strengths','experience','skills','education','projects','courses']);
export const resumeSchema = z.object({
  schemaVersion: z.literal(1), id, revision: z.number().int().nonnegative(), updatedAt: s,
  personal: z.object({ fullName: s.max(150), targetPosition: s.max(150), birthDate: s.regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), showBirthDate: z.boolean(), photoAssetId: id.nullable(), showPhoto: z.boolean() }).strict(),
  contacts: z.object({ phone: s.max(40), email: s.max(254), city: s.max(200), telegram: s.max(100), links: z.array(z.object({ id, label: s.max(100), url: s.max(2048) }).strict()).max(10) }).strict(),
  summary: s.max(3000), strengths: z.array(z.object({ id, text: s.max(1000) }).strict()).max(20), noExperience: z.boolean(),
  experience: z.array(experienceSchema).max(20), education: z.array(educationSchema).max(20), skills: z.array(skillSchema).max(100), projects: z.array(projectSchema).max(20), courses: z.array(courseSchema).max(20),
  presentation: z.object({ template: z.enum(['classic','modern','minimal']), theme: z.enum(['graphite','blue','green','burgundy','purple']), hiddenSections: z.array(section), sectionOrder: z.array(section).length(7).refine(v => new Set(v).size === 7), experienceOrder: z.enum(['recent-first','manual']) }).strict()
}).strict().refine(r => JSON.stringify(r).length < 65000, 'Слишком много данных. Сократите текст резюме.');
export type FieldErrors = Record<string, string>;
export function validateExport(r: Resume): FieldErrors {
  const e: FieldErrors = {};
  const parsed = resumeSchema.safeParse(r);
  if (!parsed.success) for (const i of parsed.error.issues) e[i.path.join('.') || '_form'] = i.message;
  if (!r.personal.fullName.trim()) e['personal.fullName'] = 'Укажите ваше имя.';
  if (!r.personal.targetPosition.trim()) e['personal.targetPosition'] = 'Укажите желаемую должность.';
  if (!r.contacts.phone.trim() && !r.contacts.email.trim()) e['contacts.email'] = 'Добавьте телефон или электронную почту.';
  if (r.contacts.email && !z.email().safeParse(r.contacts.email).success) e['contacts.email'] = 'Проверьте адрес электронной почты.';
  if (r.contacts.phone && (!/^[+\d\s()\-]+$/.test(r.contacts.phone) || !/^\d{7,15}$/.test(r.contacts.phone.replace(/\D/g,'')))) e['contacts.phone'] = 'Укажите номер из 7–15 цифр, можно с кодом страны.';
  if (r.personal.showBirthDate && r.personal.birthDate && (r.personal.birthDate > localDate() || Number.isNaN(Date.parse(r.personal.birthDate)))) e['personal.birthDate'] = 'Проверьте дату рождения.';
  if (r.contacts.telegram && !telegramUrl(r.contacts.telegram)) e['contacts.telegram'] = 'Укажите @username или ссылку https://t.me/username.';
  r.contacts.links.forEach((l,i) => { if (l.url && !safeUrl(l.url)) e[`contacts.links.${i}.url`] = 'Нужна полная ссылка http:// или https://.'; });
  const v = selectVisible(r);
  v.experience.forEach(x => {
    const i = r.experience.findIndex(y=>y.id===x.id); const p = `experience.${i}`;
    if (!x.company.trim()) e[`${p}.company`] = 'Укажите компанию.';
    if (!x.position.trim()) e[`${p}.position`] = 'Укажите должность.';
    if (!x.start) e[`${p}.start`] = 'Укажите начало работы.';
    if (!x.current && !x.end) e[`${p}.end`] = 'Укажите окончание или отметьте, что работаете сейчас.';
    if (x.start && x.start > localDate().slice(0,7)) e[`${p}.start`] = 'Начало работы не может быть в будущем.';
    if (x.end && ((x.start && x.end < x.start) || x.end > localDate().slice(0,7))) e[`${p}.end`] = 'Проверьте период работы.';
  });
  v.education.forEach(x => { const i = r.education.findIndex(y=>y.id===x.id); const p = `education.${i}`; if (!x.institution.trim()) e[`${p}.institution`] = 'Укажите учебное заведение.'; if (!x.current && !x.endYear) e[`${p}.endYear`] = 'Укажите год окончания или отметьте «Учусь сейчас».'; if (x.startYear && x.endYear && x.endYear < x.startYear) e[`${p}.endYear`] = 'Год окончания должен быть не раньше начала.'; });
  v.projects.forEach(x=>{ const i=r.projects.findIndex(y=>y.id===x.id); if (!x.name.trim()) e[`projects.${i}.name`]='Добавьте название проекта.'; if (x.url && !safeUrl(x.url)) e[`projects.${i}.url`]='Проверьте ссылку.'; });
  v.courses.forEach(x=>{if (!x.name.trim()) e[`courses.${r.courses.findIndex(y=>y.id===x.id)}.name`]='Добавьте название курса.';});
  return e;
}
