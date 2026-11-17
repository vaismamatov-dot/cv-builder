import { openDB } from 'idb';
import { resumeSchema } from '@/domain/schemas';
import { type Resume, type PhotoAsset } from '@/domain/resume';
const db = () => openDB('resume-builder', 1, { upgrade(d) { d.createObjectStore('drafts'); d.createObjectStore('assets'); d.createObjectStore('preferences'); } });
const LEASE = 15000;
export async function loadDraft() {
  const d = await db(); const tx = d.transaction(['drafts','assets']);
  const raw = await tx.objectStore('drafts').get('active');
  if (!raw) return null;
  const result = resumeSchema.safeParse(raw);
  if (!result.success) throw new Error('Черновик имеет неподдерживаемый формат. Сохраните файл восстановления перед сбросом.');
  const asset = raw.personal.photoAssetId ? await tx.objectStore('assets').get(raw.personal.photoAssetId) as PhotoAsset | undefined : undefined;
  return { resume: result.data as Resume, asset: asset ?? null };
}
export async function claim(owner: string, force = false) {
  const d=await db(); const tx=d.transaction('preferences','readwrite');
  const lease=await tx.store.get('lease');
  if (!force && lease && lease.owner !== owner && lease.until > Date.now()) { await tx.done; return false; }
  await tx.store.put({owner, until:Date.now()+LEASE},'lease'); await tx.done; return true;
}
export async function saveDraft(resume: Resume, asset: PhotoAsset | null, owner: string, expected: number | null) {
  const valid=resumeSchema.safeParse(resume); if(!valid.success) throw new Error('Данные превышают допустимый объём. Сократите текст.');
  const d=await db(); const tx=d.transaction(['drafts','assets','preferences'],'readwrite');
  const lease=await tx.objectStore('preferences').get('lease'); const old=await tx.objectStore('drafts').get('active');
  if(lease?.owner!==owner || (old?.revision ?? null)!==expected) { tx.abort(); throw new Error('Резюме изменилось в другой вкладке. Перехватите редактирование, чтобы продолжить.'); }
  await tx.objectStore('assets').clear(); if(asset) await tx.objectStore('assets').put(asset,asset.id);
  await tx.objectStore('drafts').put(resume,'active'); await tx.done;
}
export async function resetDraft(owner: string, all: boolean) {
  const d=await db(); const tx=d.transaction(['drafts','assets','preferences'],'readwrite');
  const lease=await tx.objectStore('preferences').get('lease');
  if (lease?.owner !== owner) { tx.abort(); throw new Error('Редактирование открыто в другой вкладке.'); }
  await tx.objectStore('drafts').clear(); await tx.objectStore('assets').clear();
  if(all) await tx.objectStore('preferences').clear();
  // Rotating this token makes writes from the discarded session fail atomically.
  const token=crypto.randomUUID(); await tx.objectStore('preferences').put({owner:token,until:Date.now()+LEASE},'lease');
  await tx.done; return token;
}
export async function readPreference(key: string) { return (await db()).get('preferences',key); }
export async function writePreference(key: string, value: unknown) { await (await db()).put('preferences',value,key); }
export async function rawDraft() { return (await db()).get('drafts','active'); }
