import { mkdir,writeFile,readFile } from 'node:fs/promises';
import path from 'node:path';
import { renderToBuffer } from '@react-pdf/renderer';
import { ResumeDocument,registerFonts } from '../src/pdf/document';
import { templates,themes,type PdfFormat } from '../src/domain/resume';
import { fixture } from '../tests/fixtures/resume';
import assert from 'node:assert/strict';
import { finalizePdf } from '../src/pdf/finalize';

async function main(){
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  registerFonts(path.resolve('public').replaceAll('\\','/'));
  await mkdir('outputs/pdf-check',{recursive:true});
  const fontBytes=new Uint8Array(await readFile('public/fonts/NotoSans-Regular.ttf'));
  const render=async(r:ReturnType<typeof fixture>,format:PdfFormat)=>finalizePdf(new Uint8Array(await renderToBuffer(ResumeDocument({resume:r,format}))),fontBytes);
  const report=[];
  for(const template of templates)for(const theme of themes)for(const format of ['a4','mobile'] as PdfFormat[]){
    const r=fixture();r.presentation.template=template.id;r.presentation.theme=theme.id;r.personal.birthDate='1990-01-01';r.strengths=[{id:'hidden',text:'HIDDEN_SECTION_MARKER'}];r.presentation.hiddenSections=['strengths'];
    const buffer=await render(r,format);const doc=await pdfjs.getDocument({data:new Uint8Array(buffer)}).promise;
    let text='';for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i);const v=page.getViewport({scale:1});assert(Math.abs(v.width-(format==='a4'?595.28:306.14))<1);assert(Math.abs(v.height-(format==='a4'?841.89:544.25))<1);const c=await page.getTextContent();text+=c.items.map(x=>'str'in x?x.str:'').join(' ');}
    assert(text.includes('Анна Соколова'));assert(text.includes('Продуктовый дизайнер'));assert(!text.includes('HIDDEN_SECTION_MARKER'));assert(!text.includes('1990'));assert(text.includes('Прототипирование'));assert(text.indexOf('Анна')<text.indexOf('Опыт работы'));
    const name=`${template.id}-${theme.id}-${format}`;await writeFile(`outputs/pdf-check/${name}.pdf`,buffer);
    report.push({name,pages:doc.numPages,bytes:buffer.length});await doc.cleanup();
  }
  for(const template of templates)for(const format of ['a4','mobile'] as PdfFormat[]){
    const r=fixture(true);r.presentation.template=template.id;
    const buffer=await render(r,format);await writeFile(`outputs/pdf-check/long-${template.id}-${format}.pdf`,buffer);
    const doc=await pdfjs.getDocument({data:new Uint8Array(buffer)}).promise;assert(doc.numPages>1);let text='';for(let i=1;i<=doc.numPages;i++){const p=await doc.getPage(i);const c=await p.getTextContent();assert(c.items.length>0,'Empty page');text+=c.items.map(x=>'str'in x?x.str:'').join(' ');}
    for(let i=1;i<=5;i++)assert(text.includes(`Студия продуктов ${i}`),`Missing job ${i}`);assert(text.includes('Университет дизайна'));for(let i=1;i<=doc.numPages;i++)assert(text.includes(`Страница ${i} из ${doc.numPages}`),'Missing page number');report.push({name:`long-${template.id}-${format}`,pages:doc.numPages,bytes:buffer.length});await doc.cleanup();
  }
  await writeFile('outputs/pdf-check/report.json',JSON.stringify(report,null,2));console.log(`PDF checks passed: ${report.length} documents. Cyrillic, dimensions, hidden fields and long content verified.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
