import type { Resume } from './resume';
export function restoreChange(before:Resume,after:Resume,current:Resume):Resume|null {
  const keys=(Object.keys(before) as (keyof Resume)[]).filter(k=>!['revision','updatedAt'].includes(k)&&JSON.stringify(before[k])!==JSON.stringify(after[k]));
  if(keys.some(k=>JSON.stringify(current[k])!==JSON.stringify(after[k])))return null;
  const result=structuredClone(current);for(const key of keys)Object.assign(result,{[key]:structuredClone(before[key])});result.revision=current.revision+1;result.updatedAt=new Date().toISOString();return result;
}
