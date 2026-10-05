import type {DB} from "../db";
const statusOut:Record<string,string>={new:"New",learning:"Learning",review:"Review",mastered:"Mastered"};
const statusIn:Record<string,string>={New:"new",Learning:"learning",Review:"review",Mastered:"mastered"};
/** Chuyển một dòng bảng `cards` sang định dạng từ vựng mà giao diện sử dụng. */
export function vocabularyRow(r:any){return {id:String(r.id),deck:r.deck||undefined,word:r.word,pronunciation:r.pronunciation||undefined,meaning:r.meaning,example:r.example||undefined,partOfSpeech:r.part_of_speech||undefined,synonyms:JSON.parse(r.synonyms||"[]"),imageUrl:r.image_url||undefined,audioUrl:r.audio_url||undefined,tag:r.tag||r.topic,status:statusOut[r.status]||"New",nextReviewDate:r.due_at||undefined,createdAt:r.created_at,...(r.review_count===undefined?{}:{reviewCount:Number(r.review_count)})};}
/** Đổi trạng thái hiển thị (New, Learning...) sang giá trị lưu trong database. */
export function dbStatus(status?:string){return status?statusIn[status]:undefined;}
/** Chuyển dữ liệu từ form từ vựng sang tham số cho câu lệnh SQL. */
export function inputParams(x:any){return {word:x.word,meaning:x.meaning,example:x.example||null,pronunciation:x.pronunciation||null,partOfSpeech:x.partOfSpeech||null,topic:x.tag==="Daily conversation"?"daily-life":x.tag==="IELTS"?"travel":"work-study",imageUrl:x.imageUrl||null,audioUrl:x.audioUrl||null,tags:JSON.stringify([x.tag]),synonyms:JSON.stringify(x.synonyms||[]),tag:x.tag,status:dbStatus(x.status)||"new"};}
