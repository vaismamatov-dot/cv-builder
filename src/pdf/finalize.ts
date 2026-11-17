import { PDFDocument,rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
// Post-layout numbering avoids the renderer's dynamic custom-font text defect.
// The final bytes are used by both PDF.js preview and download.
export async function finalizePdf(input:Uint8Array,fontBytes:Uint8Array):Promise<Uint8Array>{
  const doc=await PDFDocument.load(input,{updateMetadata:false});if(doc.getPageCount()===1)return input;
  doc.registerFontkit(fontkit);const font=await doc.embedFont(fontBytes,{subset:true});
  const total=doc.getPageCount();for(const [i,page] of doc.getPages().entries()){
    const mobile=page.getWidth()<400;const text=`Страница ${i+1} из ${total}`;const size=8;const margin=mobile?22.68:34.02;
    page.drawText(text,{font,size,x:page.getWidth()-margin-font.widthOfTextAtSize(text,size),y:mobile?14:21,color:rgb(.294,.333,.388)});
  }
  return doc.save();
}
