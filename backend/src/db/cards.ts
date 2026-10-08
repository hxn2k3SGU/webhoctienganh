import type { DB } from "./index";
/** Chuyển một dòng bảng `cards` (snake_case) sang đối tượng thẻ (camelCase) trả về cho API. */
export function rowCard(r:any){return {id:r.id,word:r.word,meaning:r.meaning,example:r.example,pronunciation:r.pronunciation,partOfSpeech:r.part_of_speech,topic:r.topic,audioUrl:r.audio_url,tags:JSON.parse(r.tags||"[]"),status:r.status,easeFactor:r.ease_factor,intervalDays:r.interval_days,repetitions:r.repetitions,dueAt:r.due_at,createdAt:r.created_at,updatedAt:r.updated_at};}
/** Lấy một thẻ theo id; trả `null` nếu không tồn tại. */
export function getCard(db:DB,id:number){const r=db.prepare("SELECT * FROM cards WHERE id=?").get(id);return r?rowCard(r):null;}
