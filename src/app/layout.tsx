import type { Metadata } from 'next';
import { publicPath } from '@/domain/paths';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/cyrillic-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/cyrillic-600.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/manrope/cyrillic-700.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/cyrillic-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/cyrillic-500.css';
import './globals.css';
export const metadata: Metadata={title:'Резюме — ваша личная мастерская',description:'Соберите опыт, найдите точные слова и создайте своё резюме. Три оформления и PDF для телефона и компьютера.',icons:{icon:publicPath('/icon.svg')}};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="ru"><body>{children}</body></html>;}
