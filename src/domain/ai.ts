import { z } from 'zod';
import { type Resume, selectVisible } from './resume';
import { experienceSchema,educationSchema,skillSchema,courseSchema } from './schemas';
export const CONSENT_VERSION='resume-ai-v1';
export type AiScope='all'|'summary'|'strengths'|'experience'|'skills';
const text=z.string().max(3000);const id=z.string().min(1).max(100);const refs=z.array(z.string().max(180)).min(1).max(50);
export const generateSchema=z.object({requestId:z.uuid(),sourceRevision:z.number().int().nonnegative(),consentVersion:z.literal(CONSENT_VERSION),scope:z.enum(['all','summary','strengths','experience','skills']),targetExperienceIds:z.array(id).max(20).optional(),locale:z.literal('ru'),source:z.object({
  targetPosition:z.string().min(1).max(150),summary:text.optional(),experience:z.array(experienceSchema).max(20).optional(),skills:z.array(skillSchema).max(100).optional(),education:z.array(educationSchema).max(20).optional(),projects:z.array(z.object({id,name:z.string().max(200),kind:z.enum(['personal','educational','other']),description:text}).strict()).max(20).optional(),courses:z.array(courseSchema).max(20).optional()
}).strict()}).strict().refine(v=>JSON.stringify(v.source).length<=25000,'Слишком много данных для одного запроса.').refine(v=>!!(v.source.experience?.length||v.source.skills?.length||v.source.education?.length||v.source.projects?.length),'Добавьте профессиональные сведения.');
export const proposalSchema=z.object({
  proposal:z.object({summary:text.optional(),strengths:z.array(z.object({text:z.string().max(1000),evidenceRefs:refs}).strict()).max(20).optional(),experience:z.array(z.object({id,responsibilities:z.array(z.string().max(1000)).max(30),achievements:z.array(z.string().max(1000)).max(30),evidenceRefs:refs}).strict()).max(20).optional(),skills:z.array(z.object({sourceSkillIds:z.array(id).min(1).max(100),name:z.string().min(1).max(80),group:z.string().max(100).nullable()}).strict()).max(100).optional()}).strict(),
  questions:z.array(z.object({text,relatedSourceIds:z.array(id).max(50)}).strict()).max(10),warnings:z.array(text).max(10)
}).strict();
export type GenerateRequest=z.infer<typeof generateSchema>;
export type Proposal=z.infer<typeof proposalSchema> & {requestId:string;sourceRevision:number};
export function maskContacts(s:string){return s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email скрыт]').replace(/(?:\+\d[\d ()-]{6,}\d|\b\d[\d ()-]{8,}\d\b)/g,'[телефон скрыт]');}
export function makeAiRequest(resume:Resume,scope:AiScope):GenerateRequest {
  const r=selectVisible(resume);
  const source:GenerateRequest['source']={targetPosition:r.personal.targetPosition,summary:r.summary||undefined,
    experience:r.experience,skills:r.skills,education:r.education,projects:r.projects.map(({id,name,kind,description})=>({id,name,kind,description})),courses:r.courses};
  function mask(v:unknown):unknown{if(typeof v==='string')return maskContacts(v);if(Array.isArray(v))return v.map(mask);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,val])=>[k,['id','start','end'].includes(k)?val:mask(val)]));return v;}
  return {requestId:crypto.randomUUID(),sourceRevision:r.revision,consentVersion:CONSENT_VERSION,scope,locale:'ru',source:mask(source) as GenerateRequest['source']};
}
export function evidenceRefs(req:GenerateRequest){const refs=new Set<string>();if(req.source.summary)refs.add('summary');for(const kind of ['experience','education','skills','projects','courses'] as const){for(const item of req.source[kind]||[]){refs.add(`${kind}:${item.id}`);refs.add(item.id);if(kind==='experience'){const x=item as NonNullable<GenerateRequest['source']['experience']>[number];x.responsibilities.forEach((_,i)=>refs.add(`experience:${x.id}:responsibility:${i}`));x.achievements.forEach((_,i)=>refs.add(`experience:${x.id}:achievement:${i}`));}}}return refs;}
export function validateProposal(raw:unknown,req:GenerateRequest){const p=proposalSchema.parse(raw);const allowed=evidenceRefs(req);const experienceIds=new Set(req.source.experience?.map(x=>x.id));const skillIds=new Set(req.source.skills?.map(x=>x.id));
  const permitted=req.scope==='all'?['summary','strengths','experience','skills']:[req.scope];
  if(Object.keys(p.proposal).some(k=>!permitted.includes(k)))throw Error('Scope mismatch');
  for(const x of [...p.proposal.strengths||[],...p.proposal.experience||[]])if(x.evidenceRefs.some(id=>!allowed.has(id)))throw Error('Unknown evidence');
  if(p.questions.some(q=>q.relatedSourceIds.some(id=>!allowed.has(id))))throw Error('Unknown question source');
  if(p.proposal.experience?.some(x=>!experienceIds.has(x.id)||(req.targetExperienceIds&&!req.targetExperienceIds.includes(x.id))))throw Error('Unknown experience');
  if(p.proposal.skills?.some(x=>x.sourceSkillIds.some(id=>!skillIds.has(id))))throw Error('Unknown skill');
  const seen=new Set<string>();for(const x of p.proposal.experience||[]){if(seen.has(x.id))throw Error('Duplicate experience');seen.add(x.id);}
  const clean=(v:unknown):string=>{if(typeof v==='string')return v;if(Array.isArray(v))return v.map(clean).join(' ');if(v&&typeof v==='object')return Object.entries(v).filter(([k])=>!['id','evidenceRefs','sourceSkillIds'].includes(k)).map(([,v])=>clean(v)).join(' ');return typeof v==='number'?String(v):'';};
  const numbers=(s:string)=>s.match(/\d+(?:[.,]\d+)?/g)||[];const original=new Set(numbers(clean(req.source)).map(s=>s.replace(',','.')));
  if(numbers(clean(p.proposal)).some(n=>!original.has(n.replace(',','.'))))throw Error('Unsupported numeric claim');
  return {...p,requestId:req.requestId,sourceRevision:req.sourceRevision};
}
export function applyProposal(r:Resume,p:Proposal,sections:string[]):Resume {if(r.revision!==p.sourceRevision)throw Error('Данные изменились. Получите новое предложение.');const v=structuredClone(r);const q=p.proposal;
  if(sections.includes('summary')&&q.summary!==undefined)v.summary=q.summary;
  if(sections.includes('strengths')&&q.strengths)v.strengths=q.strengths.map(x=>({id:crypto.randomUUID(),text:x.text}));
  if(sections.includes('experience')&&q.experience)for(const x of q.experience){const target=v.experience.find(y=>y.id===x.id);if(target){target.responsibilities=x.responsibilities;target.achievements=x.achievements;}}
  if(sections.includes('skills')&&q.skills){const replaced=new Set(q.skills.flatMap(x=>x.sourceSkillIds));v.skills=[...q.skills.map(x=>({id:x.sourceSkillIds[0],name:x.name,group:x.group})),...v.skills.filter(x=>!replaced.has(x.id))];}
  return v;
}
