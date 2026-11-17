import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { ResumeDocument, registerFonts, unsupportedCharacters } from './document';
import type { Resume, PdfFormat } from '@/domain/resume';
import { finalizePdf } from './finalize';
type Job={id:number;resume:Resume;format:PdfFormat;photo:string|null;base:string};
let busy=false; let pending:Job|null=null;
let fontBytes:Uint8Array|null=null;
self.onmessage=(event:MessageEvent<Job>)=>{pending=event.data;void run();};
async function run(){
  if(busy||!pending)return;busy=true;const job=pending;pending=null;
  try{registerFonts(job.base);const missing=await unsupportedCharacters(job.resume);if(missing.length)throw Error(`Шрифт PDF не поддерживает символы: ${missing.join(' ')}. Замените их в тексте.`);const raw=await pdf(ResumeDocument({resume:job.resume,format:job.format,photo:job.photo})).toBlob();if(!fontBytes)fontBytes=new Uint8Array(await (await fetch(`${job.base}/fonts/NotoSans-Regular.ttf`)).arrayBuffer());const output=await finalizePdf(new Uint8Array(await raw.arrayBuffer()),fontBytes);const blob=new Blob([output as Uint8Array<ArrayBuffer>],{type:'application/pdf'});self.postMessage({id:job.id,blob});}
  catch(e){self.postMessage({id:job.id,error:e instanceof Error&&e.message.startsWith('Шрифт PDF')?e.message:'Не удалось собрать PDF. Проверьте данные и повторите.'});}
  finally{busy=false;void run();}
}
