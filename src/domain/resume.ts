export type TemplateId = 'classic' | 'modern' | 'minimal';
export type ThemeId = 'graphite' | 'blue' | 'green' | 'burgundy' | 'purple';
export type PdfFormat = 'a4' | 'mobile';
export type SectionId = 'summary' | 'strengths' | 'experience' | 'skills' | 'education' | 'projects' | 'courses';
export interface Experience { id: string; company: string; position: string; start: string | null; end: string | null; current: boolean; responsibilities: string[]; achievements: string[] }
export interface Education { id: string; institution: string; specialty: string; level: string; startYear: number | null; endYear: number | null; current: boolean; details: string }
export interface Skill { id: string; name: string; group: string | null }
export interface Strength { id: string; text: string }
export interface Project { id: string; name: string; kind: 'personal' | 'educational' | 'other'; description: string; url: string }
export interface Course { id: string; name: string; organization: string; year: number | null }
export interface Resume {
  schemaVersion: 1; id: string; revision: number; updatedAt: string;
  personal: { fullName: string; targetPosition: string; birthDate: string | null; showBirthDate: boolean; photoAssetId: string | null; showPhoto: boolean };
  contacts: { phone: string; email: string; city: string; telegram: string; links: { id: string; label: string; url: string }[] };
  summary: string; strengths: Strength[]; noExperience: boolean; experience: Experience[];
  education: Education[]; skills: Skill[]; projects: Project[]; courses: Course[];
  presentation: { template: TemplateId; theme: ThemeId; hiddenSections: SectionId[]; sectionOrder: SectionId[]; experienceOrder: 'recent-first' | 'manual' };
}
export interface PhotoAsset { id: string; blob: Blob; width: number; height: number; mime: string; crop: { x: number; y: number; zoom: number } }
export const sectionNames: Record<SectionId, string> = { summary: 'О себе', strengths: 'Сильные стороны', experience: 'Опыт работы', skills: 'Навыки', education: 'Образование', projects: 'Проекты', courses: 'Курсы и сертификаты' };
export const sectionOrder: SectionId[] = ['summary', 'strengths', 'experience', 'skills', 'education', 'projects', 'courses'];
export const templates: { id: TemplateId; name: string; description: string }[] = [
  { id: 'classic', name: 'Классика', description: 'Одна колонка. Всё по делу.' },
  { id: 'modern', name: 'Современный', description: 'Выразительный боковой блок.' },
  { id: 'minimal', name: 'Минимализм', description: 'Текст и ничего лишнего.' }
];
export const themes: { id: ThemeId; name: string; color: string }[] = [
  { id: 'graphite', name: 'Графитовый', color: '#374151' }, { id: 'blue', name: 'Синий', color: '#1D4ED8' },
  { id: 'green', name: 'Зелёный', color: '#166534' }, { id: 'burgundy', name: 'Бордовый', color: '#9F1239' },
  { id: 'purple', name: 'Фиолетовый', color: '#6B21A8' }
];
export function blankResume(): Resume {
  return { schemaVersion: 1, id: crypto.randomUUID(), revision: 0, updatedAt: new Date().toISOString(),
    personal: { fullName: '', targetPosition: '', birthDate: null, showBirthDate: false, photoAssetId: null, showPhoto: true },
    contacts: { phone: '', email: '', city: '', telegram: '', links: [] },
    summary: '', strengths: [], noExperience: false, experience: [], education: [], skills: [], projects: [], courses: [],
    presentation: { template: 'classic', theme: 'graphite', hiddenSections: [], sectionOrder: [...sectionOrder], experienceOrder: 'recent-first' }
  };
}
export function isVisible(r: Resume, id: SectionId) { return !r.presentation.hiddenSections.includes(id) && !(id === 'experience' && r.noExperience); }
export function selectVisible(r: Resume): Resume {
  const v = structuredClone(r);
  for (const id of sectionOrder) if (!isVisible(v, id)) { if (id === 'summary') v.summary = ''; else v[id] = []; }
  if (!v.personal.showBirthDate) v.personal.birthDate = null;
  if (!v.personal.showPhoto) v.personal.photoAssetId = null;
  v.experience = v.experience.filter(x => x.company || x.position || x.responsibilities.some(Boolean) || x.achievements.some(Boolean));
  v.education = v.education.filter(x => x.institution || x.specialty || x.details);
  v.projects = v.projects.filter(x => x.name || x.description);
  v.courses = v.courses.filter(x => x.name || x.organization);
  if (v.presentation.experienceOrder === 'recent-first') v.experience.sort((a,b) => (b.start || '').localeCompare(a.start || ''));
  return v;
}
export function safeUrl(s: string) { try { const u = new URL(s); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
export function telegramUrl(s: string) { const name = s.trim().replace(/^https:\/\/t\.me\//, '').replace(/^@/, ''); return /^[a-zA-Z0-9_]{5,32}$/.test(name) ? `https://t.me/${name}` : ''; }
export function filename(r: Resume, format: PdfFormat) { const n = r.personal.fullName.trim().replace(/[\x00-\x1F<>:"/\\|?*]/g, '').replace(/\s+/g, '_').slice(0,100); return `Резюме${n ? '_' + n : ''}_${format === 'a4' ? 'A4' : 'Mobile'}.pdf`; }
export function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
