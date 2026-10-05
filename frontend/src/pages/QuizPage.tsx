import { useStudyView } from '../hooks/useStudyView';
import { scoreMood } from '../utils/scoreMood';
import '../styles/quiz-score.css';
import { playFeedback } from '../utils/feedbackAudio';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CircleHelp, Headphones, Keyboard, ListChecks, RefreshCcw, RotateCcw, Volume2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { Button, Card, Empty, Input, PageHeader, Skeleton } from '../components/ui';
import type { QuizType } from '../types';
import { buildLetterHint, countQuizLetters, listeningPoints, nextHintPosition, normalizeQuizAnswer } from '../utils/quiz';
import { speak } from '../utils/speech';
import { MeaningPrompt } from '../components/study/MeaningPrompt';

const types=[{id:'meaning' as const,title:'Chọn nghĩa',desc:'Chọn nghĩa đúng của từ.',icon:ListChecks,color:'green'},{id:'typing' as const,title:'Gõ từ',desc:'Nhìn nghĩa, viết từ tiếng Anh.',icon:Keyboard,color:'coral'},{id:'cloze' as const,title:'Điền vào chỗ trống',desc:'Hoàn thiện từ trong ngữ cảnh.',icon:CircleHelp,color:'yellow'},{id:'listening' as const,title:'Nghe & đoán',desc:'Nghe phát âm rồi nhập từ.',icon:Headphones,color:'blue'}];
type QuizAnswer = { questionId: string; answer: string; revealedHintPositions: number[] };

/** Trang quiz: chọn nghĩa, gõ từ, điền vào câu và nghe viết. */
export function QuizPage(){
 const queryClient=useQueryClient();
 const [type,setType]=useState<QuizType>();const [index,setIndex]=useState(0);const [answer,setAnswer]=useState('');const [answers,setAnswers]=useState<QuizAnswer[]>([]);const [revealed,setRevealed]=useState<boolean>();const [revealedHintPositions,setRevealedHintPositions]=useState<number[]>([]);const [hintInput,setHintInput]=useState('');const inputRef=useRef<HTMLInputElement>(null);
 const settings=useQuery({queryKey:['settings'],queryFn:api.settings});
 const [deck,setDeck]=useState('');
 const decks=useQuery({queryKey:['decks'],queryFn:api.decks});
 const enterActionRef=useRef<(() => void) | undefined>();
 const restartQuizRef=useRef<() => void>(() => {});
 const otherQuizRef=useRef<() => void>(() => {});
 const quiz=useQuery({queryKey:['quiz',type,deck,settings.data?.quizQuestionCount??10],queryFn:()=>api.quiz(type!,settings.data?.quizQuestionCount??10,deck),enabled:!!type&&settings.isSuccess,retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false});
 useStudyView('quiz', type&&!quiz.isFetching&&!quiz.isError?quiz.data?.sessionId:undefined, quiz.data?.questions[index]?.vocabularyId);
 const submit=useMutation({mutationFn:()=>api.submitQuiz(quiz.data!.sessionId,answers),onSuccess:()=>{void queryClient.invalidateQueries({queryKey:['progress']});void queryClient.invalidateQueries({queryKey:['dashboard']})}});
 otherQuizRef.current=()=>{setType(undefined);setIndex(0);setAnswers([]);setAnswer('');setRevealed(undefined);setRevealedHintPositions([]);setHintInput('');submit.reset()};
 restartQuizRef.current=()=>{if(quiz.isFetching||submit.isPending)return;submit.reset();setIndex(0);setAnswers([]);setAnswer('');setRevealed(undefined);setRevealedHintPositions([]);setHintInput('');void quiz.refetch()};
 enterActionRef.current=undefined;
 const finished=!!type&&!!quiz.data?.questions.length&&index>=quiz.data.questions.length;
 useEffect(()=>{
   if(!type)return;
   /** Nhấn Enter để xác nhận câu trả lời hoặc sang câu tiếp theo. */
   const handleEnter=(event:KeyboardEvent)=>{
     if(event.key!=='Enter'||event.repeat||event.isComposing||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey)return;
     const target=event.target;
     if(target instanceof HTMLElement&&(target.isContentEditable||target.closest('textarea,select')||(target.closest('input')&&target!==inputRef.current)))return;
     if(!enterActionRef.current)return;
     event.preventDefault();event.stopPropagation();enterActionRef.current();
   };
   window.addEventListener('keydown',handleEnter,true);
   return()=>window.removeEventListener('keydown',handleEnter,true);
 },[type]);
 if(finished&&!quiz.isFetching&&!submit.isPending)enterActionRef.current=()=>restartQuizRef.current();
 useEffect(()=>{if(revealed===false&&!q.options){inputRef.current?.focus();const end=inputRef.current?.value.length??0;inputRef.current?.setSelectionRange(end,end)}},[revealed,revealedHintPositions,type]);
 if(!type)return <div className="page"><PageHeader eyebrow="KIỂM TRA NHANH" title="Thử sức ghi nhớ" body="Bốn cách kiểm tra, một mục tiêu: biến từ vựng thành phản xạ."/><label style={{display:'block',marginBottom:20}}>Bộ flashcard<select className="input" value={deck} onChange={event=>setDeck(event.target.value)} disabled={decks.isLoading}><option value="">Tất cả các bộ</option>{decks.data?.map(item=><option key={item.name} value={item.name}>{item.name} ({item.count} từ)</option>)}</select></label>{decks.error&&<p role="alert">Chưa tải được danh sách bộ. <button onClick={()=>void decks.refetch()}>Thử lại</button></p>}<div className="quiz-type-grid">{types.map(({id,title,desc,icon:Icon,color})=><Card className={`quiz-type type-${color}`} key={id} onClick={()=>setType(id)}><Icon size={24}/><div><h2>{title}</h2><p>{desc}</p></div></Card>)}</div></div>;
 if(settings.isLoading||quiz.isFetching)return <div className="quiz-wrap">{type==='cloze'&&<p role="status">Đang chuẩn bị câu có ngữ cảnh. Các từ chưa có ví dụ sẽ được Gemini tạo câu; có thể mất khoảng 20 giây.</p>}<Skeleton className="h-96"/></div>;
 if(quiz.error||!quiz.data?.questions.length)return <div className="page"><Empty title="Chưa tạo được câu hỏi" body={quiz.error instanceof Error?quiz.error.message:"Bạn cần thêm từ vựng có câu ví dụ hoặc thử lại sau."}/><Button onClick={()=>void quiz.refetch()}>Thử lại</Button><Button onClick={()=>setType(undefined)}>Quay lại</Button></div>;
 const qs=quiz.data.questions;
 if(index>=qs.length){if(!submit.data&&!submit.isPending)submit.mutate();const maxPoints=submit.data?.maxPoints??qs.length*100;const points=submit.data?.points??0;const percent=maxPoints?Math.min(100,Math.max(0,points/maxPoints*100)):0;const mood=scoreMood(points,submit.data?maxPoints:0);const ringRadius=76,ringLength=2*Math.PI*ringRadius;return <div className={`page quiz-result score-mood score-mood-${mood.tone}`}><div className="score-ring score-ring-total"><svg viewBox="0 0 170 170" role="img" aria-label={submit.data?`Đạt ${points} trên ${maxPoints} điểm`:"Đang tính điểm"}><circle cx="85" cy="85" r={ringRadius} className="score-track"/><circle cx="85" cy="85" r={ringRadius} className="score-arc" strokeDasharray={`${ringLength*percent/100} ${ringLength}`}/></svg><strong>{submit.data?points.toLocaleString('vi-VN'):'—'}</strong><span>/ {maxPoints.toLocaleString('vi-VN')} điểm</span></div><div key={submit.data?mood.tone:'loading'} className="score-arrival" role="status">{submit.data&&(mood.tone==='great'||mood.tone==='perfect')&&<div className="score-celebration" aria-hidden="true">&#10022; &#9733; &#10022;</div>}<h1>{submit.data?mood.title:'...'}</h1>{submit.data&&<p>{mood.message}</p>}</div>{submit.data&&<p>Bạn đạt {submit.data.points.toLocaleString('vi-VN')} / {submit.data.maxPoints.toLocaleString('vi-VN')} điểm.</p>}<p>Mỗi lần kiểm tra là một lần ký ức được củng cố.</p><div className="complete-actions"><Button variant="secondary" disabled={submit.isPending} onClick={()=>restartQuizRef.current()}><RotateCcw size={16}/> Làm lại</Button><Button onClick={()=>otherQuizRef.current()}><RefreshCcw size={16}/> Quiz khác</Button></div></div>}
 const q=qs[index]; const selected=answer.trim(); const correct=normalizeQuizAnswer(selected)===normalizeQuizAnswer(q.answer);const isTyped=!q.options;const totalLetters=countQuizLetters(q.answer);const hint=buildLetterHint(q.answer,hintInput,revealedHintPositions);const possiblePoints=listeningPoints(q.answer,revealedHintPositions.length);
 const completedPoints=answers.reduce((sum,item)=>{const question=qs.find(question=>question.id===item.questionId);return sum+(question&&normalizeQuizAnswer(item.answer)===normalizeQuizAnswer(question.answer)?listeningPoints(question.answer,item.revealedHintPositions.length):0)},0);
 const livePoints=completedPoints+(revealed===true?possiblePoints:0);
 const canAdvance=revealed===true||(!isTyped&&revealed===false);
 const liveMood=scoreMood(livePoints,(answers.length+(canAdvance?1:0))*100);
 /** Kiểm tra câu trả lời; với câu gõ sai sẽ mở thêm một chữ gợi ý. */
 const confirm=()=>{if(!selected)return;playFeedback(correct,settings.data?.soundEffects!==false,settings.data?.soundEffectsVolume);if(isTyped&&!correct){const position=nextHintPosition(q.answer,answer,revealedHintPositions);if(position!==undefined)setRevealedHintPositions(current=>current.includes(position)?current:[...current,position]);setHintInput(answer);setRevealed(false);return}setRevealed(correct);if(isTyped)void speak(q.answer,q.audioUrl).catch(()=>undefined)};
 /** Lưu câu trả lời và chuyển câu tiếp theo; nộp bài khi đến câu cuối. */
 const next=()=>{if(isTyped&&!correct)return;setAnswers(current=>[...current,{questionId:q.id,answer:selected,revealedHintPositions:isTyped?revealedHintPositions:[]}]);setAnswer('');setRevealed(undefined);setRevealedHintPositions([]);setHintInput('');setIndex(value=>value+1)};
 enterActionRef.current=canAdvance?next:confirm;
 /** Thoát quiz và đặt lại trạng thái. */
 const leaveQuiz=()=>{setType(undefined);setIndex(0);setAnswers([]);setAnswer('');setRevealed(undefined);setRevealedHintPositions([]);setHintInput('')};
 return <div className="quiz-wrap"><header className="quiz-head"><button onClick={leaveQuiz}>Thoát</button><div><b>{types.find(x=>x.id===type)?.title}</b><span>Câu {index+1} / {qs.length}</span></div><div className="quiz-progress"><i style={{width:`${index/qs.length*100}%`}}/></div></header><div className={`quiz-live-score score-mood score-mood-${liveMood.tone}`} role="status" aria-live="polite"><span>Điểm bài làm <strong>{livePoints.toLocaleString('vi-VN')} / {(qs.length*100).toLocaleString('vi-VN')}</strong></span><span>Câu này: {revealed===true?possiblePoints:revealed===false&&!isTyped?0:possiblePoints} / 100 điểm{revealed===true||revealed===false&&!isTyped?'':' tối đa'}</span><div key={liveMood.tone} className="score-message score-arrival"><b>{liveMood.title}</b><span>{liveMood.message}</span></div></div><Card className="question-card"><span className="question-no">CÂU {String(index+1).padStart(2,'0')}</span>{type==='listening'?<MeaningPrompt key={`${quiz.data.sessionId}:${q.id}`} word={q.answer} audioUrl={q.audioUrl} listening/>:type==='meaning'?<MeaningPrompt key={`${quiz.data.sessionId}:${q.id}`} word={q.prompt} audioUrl={q.audioUrl}/>:<h1>{q.prompt}</h1>}{type==='listening'&&revealed===true&&<div className="question-context" style={{overflowWrap:'anywhere'}}><p><strong>Nghĩa tiếng Việt: </strong>{q.meaningHint || 'Chưa có nghĩa'}</p><p><strong>Từ loại: </strong>{q.partOfSpeech || 'Chưa cập nhật'}</p></div>}{type==='cloze'&&q.meaningHint&&<details className="question-context"><summary>Gợi ý nghĩa tiếng Việt</summary><p>{q.meaningHint}</p></details>}{q.example&&type==='typing'&&<p className="question-context">{q.example}</p>}{q.options?<div className="answer-options">{q.options.map((option,i)=><button key={option} className={`${answer===option?'selected':''} ${revealed!==undefined?(option===q.answer?'correct':answer===option?'wrong':''):''}`} onClick={()=>revealed===undefined&&setAnswer(option)}><kbd>{String.fromCharCode(65+i)}</kbd>{option}{revealed!==undefined&&option===q.answer&&<Check size={18}/>}</button>)}</div>:<><Input ref={inputRef} className={revealed!==undefined?(correct?'answer-correct':'answer-wrong'):''} value={answer} readOnly={revealed===true} onChange={event=>{setAnswer(event.target.value);if(isTyped&&revealed===false)setRevealed(undefined)}} placeholder="Nhập câu trả lời..." aria-label={type==='listening'?'Nhập từ bạn nghe được':'Nhập câu trả lời'} aria-invalid={revealed===false} aria-describedby={isTyped&&revealedHintPositions.length?'listening-hint':undefined} autoFocus/>{isTyped&&revealedHintPositions.length>0&&<div id="listening-hint" className="quiz-hint" role="status" aria-live="polite"><span>GỢI Ý TỪNG CHỮ</span><strong>{hint}</strong><small>Đã gợi ý {revealedHintPositions.length} / {totalLetters} chữ · còn tối đa {possiblePoints} điểm</small></div>}</>}{revealed!==undefined&&<div className={`feedback ${correct?'ok':'no'}`} role="status" aria-live="polite">{correct?<Check size={20}/>:<X size={20}/>}<div><strong>{correct?`Chính xác! +${possiblePoints} điểm`:'Chưa đúng, thử lại nhé'}</strong>{!correct&&!isTyped&&<span>Đáp án: {q.answer}</span>}{!correct&&isTyped&&<span>Một chữ cái mới đã được mở.</span>}</div></div>}<Button className="quiz-next" disabled={!selected} onClick={canAdvance?next:confirm}>{canAdvance?'Câu tiếp theo':revealed===false&&isTyped?'Thử lại':'Kiểm tra'}</Button></Card></div>;
}
