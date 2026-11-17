import { NextRequest,NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { generateSchema,validateProposal } from '@/domain/ai';
import { generate } from '@/server/ai/provider';
import { acquireLimit } from '@/server/rate-limit';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(request:NextRequest){
  const requestId=randomUUID();const error=(status:number,code:string,message:string,retryable=false)=>NextResponse.json({error:{code,message,retryable},requestId},{status,headers:{'Cache-Control':'no-store',...(status===429?{'Retry-After':'60'}:{})}});
  if(request.headers.get('origin')!==request.nextUrl.origin)return error(403,'ORIGIN_REJECTED','Запрос доступен только из приложения.');
  if(!request.headers.get('content-type')?.includes('application/json'))return error(400,'VALIDATION_ERROR','Нужен JSON-запрос.');
  if(process.env.AI_ENABLED!=='true'||!process.env.AI_API_KEY||!process.env.AI_MODEL)return error(503,'AI_NOT_CONFIGURED','Помощь ИИ пока не подключена. Вы можете заполнить текст самостоятельно.');
  if(!process.env.RATE_LIMIT_REDIS_URL||!process.env.RATE_LIMIT_REDIS_TOKEN||!process.env.RATE_LIMIT_HASH_SECRET)return error(503,'AI_UNAVAILABLE','Сервис временно недоступен.');
  const reader=request.body?.getReader();if(!reader)return error(400,'VALIDATION_ERROR','Нет данных.');
  const chunks:Uint8Array[]=[];let total=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>131072){await reader.cancel();return error(413,'PAYLOAD_TOO_LARGE','Слишком большой запрос. Улучшайте разделы отдельно.');}chunks.push(value);}}catch{return error(400,'VALIDATION_ERROR','Не удалось прочитать запрос.');}
  let raw:unknown;try{raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return error(400,'VALIDATION_ERROR','Некорректные данные.');}
  const parsed=generateSchema.safeParse(raw);if(!parsed.success)return error(400,'VALIDATION_ERROR','Проверьте исходные сведения и согласие на обработку.');
  const old=request.cookies.get('resume-session')?.value;const session=old&&/^[a-f0-9-]{36}$/i.test(old)?old:randomUUID();
  let release:()=>Promise<void>=async()=>{};
  try{
    const limit=await acquireLimit(session,request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'local');release=limit.release;
    if(!limit.allowed)return error(429,'RATE_LIMITED','Достигнут лимит запросов. Попробуйте позже.',true);
    const timeout=Math.min(55000,Math.max(1000,Number(process.env.AI_TIMEOUT_MS)||55000));
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(timeout)]);
    const raw=await generate(parsed.data,signal);let result;
    try{result=validateProposal(raw,parsed.data);}catch{return error(502,'INVALID_AI_RESPONSE','Предложение не прошло проверку фактов. Попробуйте ещё раз.',true);}
    const response=NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});response.cookies.set('resume-session',session,{httpOnly:true,secure:request.nextUrl.protocol==='https:',sameSite:'lax',maxAge:3600,path:'/'});return response;
  }catch(e){return e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError')?error(504,'AI_TIMEOUT','Ответ занял слишком много времени.',true):error(503,'AI_UNAVAILABLE','Не удалось получить предложение. Продолжите редактирование или повторите позже.',true);}
  finally{try{await release();}catch{/* No personal data or provider errors are logged. */}}
}
