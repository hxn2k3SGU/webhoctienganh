import { motion } from 'framer-motion';
import { RotateCcw, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Vocabulary } from '../../types';
import { speak } from '../../utils/speech';
import { Badge } from '../ui';

/**
 * Thẻ ghi nhớ lật 3D: mặt trước là từ, mặt sau là nghĩa, ví dụ và từ đồng nghĩa.
 * @param onFlip Gọi khi thẻ được lật, nhận trạng thái mới.
 */
export function Flashcard({ card, onFlip }: { card: Vocabulary; onFlip?: (flipped: boolean) => void }) {
 const [flipped,setFlipped]=useState(false);
 /** Lật thẻ; phát âm từ khi lật sang mặt sau. */
 const flip=()=>setFlipped(current=>{const next=!current;if(next)void speak(card.word,card.audioUrl).catch(()=>undefined);return next});
 useEffect(()=>{setFlipped(false)},[card.id]); useEffect(()=>onFlip?.(flipped),[flipped,onFlip]);
 useEffect(()=>{/** Nhấn phím Space để lật thẻ. */ const key=(e:KeyboardEvent)=>{if(e.code==='Space'&&!(e.target instanceof HTMLButtonElement)){e.preventDefault();flip()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[]);
 return <div className="flashcard-scene" onClick={flip} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'&&e.target===e.currentTarget)flip()}} aria-label={flipped?'Mặt sau thẻ':'Mặt trước thẻ'}><motion.div className="flashcard" animate={{rotateY:flipped?180:0}} transition={{duration:.48,type:'spring',bounce:.18}}><article className="flash-face flash-front"><span className="card-label">FLASHCARD · {card.tag}</span><div><h2>{card.word}</h2><p>{card.pronunciation}</p></div><span className="flip-hint"><RotateCcw size={15}/> Nhấn Space để lật</span></article><article className="flash-face flash-back"><div className="back-main"><div className="back-top"><Badge tone="brand">{card.partOfSpeech||'word'}</Badge><button className="sound" onClick={e=>{e.stopPropagation();void speak(card.word,card.audioUrl)}} onKeyDown={e=>e.stopPropagation()} aria-label="Phát âm"><Volume2 size={21}/></button></div><h2>{card.meaning}</h2>{card.example&&<blockquote>“{card.example}”</blockquote>}{card.synonyms.length>0&&<div className="synonyms"><span>GẦN NGHĨA</span>{card.synonyms.map(x=><Badge key={x}>{x}</Badge>)}</div>}</div></article></motion.div></div>;
}
