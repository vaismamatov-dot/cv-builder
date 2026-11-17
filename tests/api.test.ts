import { describe,it,expect,vi,afterEach,beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { fixture } from './fixtures/resume';
import { makeAiRequest } from '../src/domain/ai';
vi.mock('../src/server/ai/provider',()=>({generate:vi.fn(async()=>({proposal:{summary:'Создаю прототипы и изучаю задачи пользователей.'},questions:[],warnings:[]}))}));
vi.mock('../src/server/rate-limit',()=>({acquireLimit:vi.fn(async()=>({allowed:true,release:async()=>{}}))}));
import { POST } from '../src/app/api/ai/generate/route';
function request(body:unknown,origin='http://localhost:3000'){return new NextRequest('http://localhost:3000/api/ai/generate',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});}
beforeEach(()=>{for(const key of ['AI_API_KEY','AI_MODEL','RATE_LIMIT_REDIS_URL','RATE_LIMIT_REDIS_TOKEN','RATE_LIMIT_HASH_SECRET'])vi.stubEnv(key,'test-only');vi.stubEnv('AI_ENABLED','true');});
afterEach(()=>vi.unstubAllEnvs());
describe('AI API без реального провайдера',()=>{
  it('запрещает сторонний origin',async()=>{expect((await POST(request({},'https://example.com'))).status).toBe(403);});
  it('возвращает понятную ошибку при отсутствии ключа',async()=>{vi.stubEnv('AI_API_KEY','');const res=await POST(request({}));expect(res.status).toBe(503);expect((await res.json()).error.code).toBe('AI_NOT_CONFIGURED');});
  it('отклоняет персональные поля вне allowlist',async()=>{const input=makeAiRequest(fixture(),'summary');expect((await POST(request({...input,fullName:'Not allowed'}))).status).toBe(400);});
  it('ограничивает размер запроса до JSON-парсинга',async()=>{const res=await POST(request({text:'x'.repeat(140000)}));expect(res.status).toBe(413);});
  it('возвращает проверенное предложение и не кэширует его',async()=>{const input=makeAiRequest(fixture(),'summary');const res=await POST(request(input));expect(res.status).toBe(200);expect(res.headers.get('cache-control')).toBe('no-store');const body=await res.json();expect(body.sourceRevision).toBe(input.sourceRevision);expect(body.proposal.summary).toBeTruthy();expect(JSON.stringify(body)).not.toContain('anna@example.com');});
});
