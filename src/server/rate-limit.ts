import { Redis } from '@upstash/redis';
import { createHmac, randomUUID } from 'node:crypto';
const script=`local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n`;
export async function acquireLimit(session:string,ip:string){
  const redis=new Redis({url:process.env.RATE_LIMIT_REDIS_URL!,token:process.env.RATE_LIMIT_REDIS_TOKEN!});
  const hash=createHmac('sha256',process.env.RATE_LIMIT_HASH_SECRET!).update(`${new Date().toISOString().slice(0,10)}:${ip}`).digest('hex');
  const keys=[`ai:m:${session}`,`ai:h:${session}`,`ai:ip:${hash}`];
  const counts=await Promise.all(keys.map(async(key,i)=>Number(await redis.eval(script,[key],[i===0?60:3600]))));
  if(counts.some((n,i)=>n>[5,30,100][i]))return {allowed:false,release:async()=>{}};
  const token=randomUUID();const lock=`ai:active:${session}`;const acquired=await redis.set(lock,token,{nx:true,ex:60});
  return {allowed:!!acquired,release:async()=>{if(acquired)await redis.eval(`if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0`,[lock],[token]);}};
}
