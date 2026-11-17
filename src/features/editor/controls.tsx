'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Field({label,name,value,onChange,type='text',hint,error,maxLength=200,multiline=false,required=false}:{label:string;name:string;value:string|number|null;onChange:(v:string)=>void;type?:string;hint?:string;error?:string;maxLength?:number;multiline?:boolean;required?:boolean}) {
  const id=useId();const common={id,name,value:value??'',onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>onChange(e.target.value),maxLength,'aria-invalid':!!error,'aria-describedby':hint||error?`${id}-help`:undefined};
  const nativeDate=type==='date'||type==='month';
  return <div className={`field ${error?'has-error':''}`}><label htmlFor={id}>{label}{required&&<span className="required-dot" title="Обязательное поле"> ·</span>}</label>{multiline?<textarea {...common} rows={4}/>:<input {...common} type={type} onInput={nativeDate?e=>{if(e.currentTarget.value!==(value??''))onChange(e.currentTarget.value);}:undefined} onBlur={nativeDate?e=>{if(e.currentTarget.value!==(value??''))onChange(e.currentTarget.value);}:undefined}/ >}{(hint||error)&&<span id={`${id}-help`} className={`field-help ${error?'field-error':''}`}>{error||hint}</span>}</div>;
}
export function Toggle({label,checked,onChange,description}:{label:string;checked:boolean;onChange:(v:boolean)=>void;description?:string}) {return <label className="toggle-row"><span>{label}{description&&<small>{description}</small>}</span><input className="toggle-input" type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span aria-hidden="true" className="toggle-track"/></label>;}
export function Dialog({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null);const heading=useId();const closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const el=ref.current;el?.showModal();return()=>{el?.close();previous?.focus();};},[]);
  return <dialog ref={ref} className={`dialog ${wide?'wide-dialog':''}`} aria-labelledby={heading} onCancel={e=>{e.preventDefault();closeRef.current();}} onClick={e=>{if(e.target===e.currentTarget)closeRef.current();}}><div className="dialog-heading"><h2 id={heading}>{title}</h2><button className="icon-button" aria-label="Закрыть" onClick={onClose}><X size={20}/></button></div><div className="dialog-content">{children}</div></dialog>;
}
