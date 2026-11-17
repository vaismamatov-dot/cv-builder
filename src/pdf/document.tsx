import React from 'react';
import { Document, Page, Text, View, Image, Link, Font, StyleSheet } from '@react-pdf/renderer';
import { type Resume, type PdfFormat, type SectionId, selectVisible, sectionNames, safeUrl, telegramUrl, themes } from '@/domain/resume';
let registered = false;
export function registerFonts(base: string) {
  if(registered) return;
  Font.register({ family:'ResumeSans', fonts:[{src:`${base}/fonts/NotoSans-Regular.ttf`,fontWeight:400},{src:`${base}/fonts/NotoSans-Bold.ttf`,fontWeight:700}] });
  Font.registerHyphenationCallback(word => word.length > 22 ? word.match(/.{1,14}/gu) || [word] : [word]);
  registered=true;
}
export async function unsupportedCharacters(resume:Resume) {
  await Font.load({fontFamily:'ResumeSans',fontWeight:400});
  const font=Font.getFont({fontFamily:'ResumeSans',fontWeight:400}).data;
  const collect=(v:unknown):string=>typeof v==='string'?v:Array.isArray(v)?v.map(collect).join(' '):v&&typeof v==='object'?Object.entries(v).filter(([key])=>!['id','schemaVersion','revision','updatedAt','photoAssetId'].includes(key)).map(([,value])=>collect(value)).join(' '):'';
  return [...new Set([...collect(selectVisible(resume))].filter(c=>!/[\s\u200b\u200d\ufe0f]/.test(c)&&!font?.hasGlyphForCodePoint(c.codePointAt(0)!)))].slice(0,12);
}
export function ResumeDocument({resume,format,photo}:{resume:Resume;format:PdfFormat;photo?:string|null}) {
  const r=selectVisible(resume); const mobile=format==='mobile'; const modern=r.presentation.template==='modern'&&!mobile; const minimal=r.presentation.template==='minimal';
  const accent=themes.find(x=>x.id===r.presentation.theme)!.color;
  const st=StyleSheet.create({
    page:{fontFamily:'ResumeSans',fontSize:mobile?12:11,lineHeight:mobile?1.4:1.35,color:'#202124',padding:mobile?22.68:34.02,paddingBottom:mobile?34:42},
    header:{borderBottomWidth:minimal?0:1,borderBottomColor:accent,paddingBottom:14,marginBottom:16,flexDirection:'row',gap:14,alignItems:'flex-start'},
    name:{fontSize:mobile?22:24,fontWeight:700,lineHeight:1.15,marginBottom:6}, role:{fontSize:mobile?14:13,color:accent,marginBottom:7},
    photo:{width:mobile?58:72,height:mobile?58:72,objectFit:'cover',borderRadius:2},
    contacts:{fontSize:mobile?12:10,color:'#4B5563',gap:3},link:{color:'#4B5563',textDecoration:'none'},
    section:{marginBottom:minimal?12:17},heading:{fontSize:mobile?14:13,fontWeight:700,color:accent,marginBottom:7},
    entry:{marginBottom:10},title:{fontWeight:700,marginBottom:2},muted:{color:'#4B5563',fontSize:mobile?12:10,marginBottom:4},
    bullet:{marginBottom:3},footer:{position:'absolute',bottom:mobile?14:21,left:mobile?23:34,right:mobile?23:34,textAlign:'right',fontSize:8,color:'#4B5563'},
    row:{flexDirection:'row',gap:18},sidebar:{width:'28%',paddingRight:12,borderRightWidth:1,borderRightColor:'#D1D5DB'},main:{flex:1},
    skill:{marginBottom:4},date:{fontSize:mobile?12:10,color:'#4B5563'}
  });
  const contacts=<View style={st.contacts}>
    {r.contacts.city&&<Text>{r.contacts.city}</Text>}
    {r.contacts.phone&&<Link style={st.link} src={`tel:${r.contacts.phone.replace(/[^+\d]/g,'')}`}>{r.contacts.phone}</Link>}
    {r.contacts.email&&<Link style={st.link} src={`mailto:${r.contacts.email}`}>{r.contacts.email}</Link>}
    {telegramUrl(r.contacts.telegram)&&<Link style={st.link} src={telegramUrl(r.contacts.telegram)}>{r.contacts.telegram}</Link>}
    {r.contacts.links.filter(l=>safeUrl(l.url)).map(l=><Link key={l.id} style={st.link} src={safeUrl(l.url)}>{l.label||l.url}</Link>)}
    {r.personal.birthDate&&<Text>Дата рождения: {r.personal.birthDate.split('-').reverse().join('.')}</Text>}
  </View>;
  function section(id: SectionId) {
    let content:React.ReactNode=null;
    if(id==='summary'&&r.summary.trim()) content=<Text orphans={2} widows={2}>{r.summary}</Text>;
    if(id==='strengths'&&r.strengths.length) content=r.strengths.filter(x=>x.text.trim()).map(x=><Text key={x.id} style={st.bullet}>• {x.text}</Text>);
    if(id==='skills'&&r.skills.length) content=modern?r.skills.map(x=><Text key={x.id} style={st.skill}>{x.name}</Text>):<Text>{r.skills.map(x=>x.name).join(' · ')}</Text>;
    if(id==='experience'&&r.experience.length) content=r.experience.map(x=><View key={x.id} style={st.entry}>
      <View wrap={false} minPresenceAhead={32}><Text style={st.title}>{x.position}{x.company?` · ${x.company}`:''}</Text>
      <Text style={st.muted}>{period(x.start,x.current?'Сейчас':x.end)}</Text></View>
      {x.responsibilities.filter(Boolean).map((s,i)=><Text key={`r${i}`} style={st.bullet} orphans={2} widows={2}>• {s}</Text>)}
      {x.achievements.filter(Boolean).map((s,i)=><Text key={`a${i}`} style={st.bullet} orphans={2} widows={2}>• {s}</Text>)}
    </View>);
    if(id==='education'&&r.education.length) content=r.education.map(x=><View key={x.id} style={st.entry}>
      <Text style={st.title} minPresenceAhead={22}>{x.institution}</Text><Text>{[x.specialty,x.level].filter(Boolean).join(' · ')}</Text>
      <Text style={st.muted}>{[x.startYear,x.current?'Учусь сейчас':x.endYear].filter(Boolean).join(' — ')}</Text>{x.details&&<Text>{x.details}</Text>}
    </View>);
    if(id==='projects'&&r.projects.length) content=r.projects.map(x=><View key={x.id} style={st.entry}><Text style={st.title} minPresenceAhead={22}>{x.name}</Text><Text style={st.muted}>{x.kind==='educational'?'Учебный проект':x.kind==='personal'?'Личный проект':'Проект'}</Text><Text orphans={2} widows={2}>{x.description}</Text>{safeUrl(x.url)&&<Link style={st.link} src={safeUrl(x.url)}>{x.url}</Link>}</View>);
    if(id==='courses'&&r.courses.length) content=r.courses.map(x=><View key={x.id} style={st.entry}><Text style={st.title} minPresenceAhead={15}>{x.name}</Text><Text style={st.muted}>{[x.organization,x.year].filter(Boolean).join(' · ')}</Text></View>);
    if(!content)return null;
    return <View key={id} style={st.section}><Text style={st.heading} minPresenceAhead={32}>{sectionNames[id]}</Text>{content}</View>;
  }
  return <Document title="Резюме" author="" creator="Конструктор резюме" producer="Resume Workshop">
    <Page size={mobile?[306.14,544.25]:'A4'} style={st.page} wrap>
      <View style={st.header} wrap={false}>
        {r.personal.photoAssetId&&photo&&<Image src={photo} style={st.photo}/>}
        <View style={{flex:1}}><Text style={st.name}>{r.personal.fullName}</Text><Text style={st.role}>{r.personal.targetPosition}</Text>{!modern&&contacts}</View>
      </View>
      {modern?<View style={st.row}>
        <View style={st.sidebar}>{contacts}<View style={{marginTop:18}}>{section('skills')}</View></View>
        <View style={st.main}>{r.presentation.sectionOrder.filter(x=>x!=='skills').map(section)}</View>
      </View>:r.presentation.sectionOrder.map(section)}
    </Page>
  </Document>;
}
function period(a:string|null,b:string|null) { const fmt=(s:string)=>/^\d{4}-\d{2}$/.test(s)?s.split('-').reverse().join('.'):s; return [a,b].filter(Boolean).map(x=>fmt(x!)).join(' — '); }
