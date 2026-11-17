'use client';
import { useEffect, useRef, useState } from 'react';
import { FileText, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { type Resume, type PhotoAsset, type PdfFormat, filename } from '@/domain/resume';
import { basePath,publicPath } from '@/domain/paths';

export interface PdfReady { blob:Blob; pages:number; revision:number; format:PdfFormat }
export default function DocumentPreview({resume,asset,format,onReady,onBusy}:{resume:Resume;asset:PhotoAsset|null;format:PdfFormat;onReady:(v:PdfReady|null)=>void;onBusy:(busy:boolean)=>void}) {
  const worker=useRef<Worker|null>(null);const job=useRef(0);const host=useRef<HTMLDivElement>(null);
  const [result,setResult]=useState<{blob:Blob;revision:number;format:PdfFormat}|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [retry,setRetry]=useState(0);const [zoom,setZoom]=useState(1);
  const [pages,setPages]=useState(0); const readyRef=useRef(onReady);const busyRef=useRef(onBusy);readyRef.current=onReady;busyRef.current=onBusy;
  const content=!!(resume.personal.fullName||resume.personal.targetPosition||resume.summary||resume.experience.length||resume.skills.length);
  useEffect(()=>{const w=new Worker(new URL('../../pdf/worker.ts',import.meta.url),{type:'module'});worker.current=w;return()=>{w.terminate();worker.current=null;};},[]);
  useEffect(()=>{
    const current=++job.current;readyRef.current(null);
    if(!content){setResult(null);setBusy(false);busyRef.current(false);return;}
    setBusy(true);busyRef.current(true);setError('');
    const timer=setTimeout(async()=>{
      let photo:string|null=null;
      if(asset&&resume.personal.showPhoto) photo=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);reader.onerror=reject;reader.readAsDataURL(asset.blob);});
      if(current!==job.current)return;
      const w=worker.current;if(!w)return;
      w.onmessage=e=>{if(e.data.id!==job.current)return;if(e.data.error){setError(e.data.error);setBusy(false);busyRef.current(false);}else setResult({blob:e.data.blob,revision:resume.revision,format});};
      w.onerror=()=>{if(current===job.current){setError('Не удалось запустить сборку PDF. Попробуйте снова.');setBusy(false);busyRef.current(false);}};
      w.postMessage({id:current,resume,format,photo,base:`${location.origin}${basePath}`});
    },250);
    return()=>clearTimeout(timer);
  },[resume,asset,format,retry,content]);
  useEffect(()=>{
    if(!result||!host.current)return;let cancelled=false;const current=job.current;const container=host.current;
    let cleanup:(()=>void)|undefined;
    async function draw(){
      try{
        const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=publicPath('/pdf.worker.min.mjs');
        const task=pdfjs.getDocument({data:new Uint8Array(await result!.blob.arrayBuffer())});cleanup=()=>{void task.destroy();};
        const doc=await task.promise;if(cancelled)return;setPages(doc.numPages);
        const fragment=document.createDocumentFragment();
        for(let i=1;i<=doc.numPages;i++){
          if(cancelled)return;const page=await doc.getPage(i);const viewport=page.getViewport({scale:1.65});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
          canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Страница ${i} резюме`);await page.render({canvas,viewport}).promise;
          const wrap=document.createElement('div');wrap.className='pdf-page';wrap.append(canvas);fragment.append(wrap);
        }
        if(cancelled||current!==job.current)return;container.replaceChildren(fragment);setBusy(false);busyRef.current(false);readyRef.current({...result!,pages:doc.numPages});
      }catch{if(!cancelled){setError('Не удалось показать PDF. Попробуйте обновить предпросмотр.');setBusy(false);busyRef.current(false);}}
    }
    void draw();return()=>{cancelled=true;cleanup?.();};
  },[result]);
  return <div className="document-area">
    <div className="page-meta"><span aria-live="polite">{busy?'Обновляем лист…':pages&&content?`${pages} ${pages===1?'страница':pages<5?'страницы':'страниц'}`:'Ваш будущий документ'}</span><div className="zoom-controls"><button title="Уменьшить" aria-label="Уменьшить предпросмотр" onClick={()=>setZoom(z=>Math.max(.6,z-.1))}><ZoomOut size={17}/></button><span>{Math.round(zoom*100)}%</span><button title="Увеличить" aria-label="Увеличить предпросмотр" onClick={()=>setZoom(z=>Math.min(1.6,z+.1))}><ZoomIn size={17}/></button></div></div>
    {!content&&<div className="empty-paper"><div className="empty-document-mark"><FileText size={34} strokeWidth={1.2}/></div><span className="eyebrow">ВАШ СЛЕДУЮЩИЙ ШАГ</span><h2>Хорошее резюме<br/>начинается с вас.</h2><p>Добавьте имя и желаемую должность.<br/>Лист будет собираться по мере заполнения.</p><div className="paper-rule"/><div className="empty-lines"><i/><i/><i/></div><span className="empty-footnote">Ваш опыт. Ваши слова. Ваш ритм.</span></div>}
    {error&&<div className="notice error" role="alert">{error}<button className="text-button" onClick={()=>setRetry(n=>n+1)}><RotateCw size={16}/>Повторить</button></div>}
    <div className={`pdf-pages ${format==='mobile'?'mobile-pages':''} ${busy?'is-updating':''}`} style={{'--zoom':zoom} as React.CSSProperties} ref={host} hidden={!content}/>
    {content&&<p className="preview-footnote">{filename(resume,format)}<br/>Это тот самый PDF, который вы скачаете.</p>}
  </div>;
}
