import { ArrowUpRight, Grid2X2, Rocket, Layers, Brain } from 'lucide-react';
import { Link } from 'react-router-dom';
import '../styles/arcade.css';

const games = [
  { id: 'blocks', name: 'Khối hộp', tag: 'TƯ DUY × TỪ VỰNG', text: 'Trả lời đúng, nhận khối mới. Xếp kín hàng để dọn bàn và ghi điểm.', icon: Grid2X2, chips: '8 × 8 ô · Xếp khối', art: 'blocks' },
  { id: 'blast', name: 'Blast', tag: 'PHẢN XẠ × TỐC ĐỘ', text: 'Ngắm đúng nghĩa, bắn tan thiên thạch. Giữ chuỗi đúng trước khi hết giờ.', icon: Rocket, chips: 'Đếm ngược · Chuỗi điểm', art: 'blast' },
  { id: 'match', name: 'Ghép thẻ', tag: 'NHANH MẮT × NHANH TAY', text: 'Ghép từ với nghĩa để dọn sạch bàn thẻ trong thời gian ngắn nhất.', icon: Layers, chips: '4–8 cặp · Tính giờ', art: 'match' },
  { id: 'memory', name: 'Lật thẻ', tag: 'KHÁM PHÁ × GHI NHỚ', text: 'Lật hai thẻ, nhớ vị trí và tìm những cặp từ thuộc về nhau.', icon: Brain, chips: '4–8 cặp · Trí nhớ', art: 'memory' },
];
/** Trang danh sách các trò chơi. */
export function GameCatalogPage() {
  return <div className="page arcade-catalog"><header className="arcade-catalog-head"><span className="arcade-eyebrow">LEXILO / PLAY LAB</span><h1>Học thêm một từ.<br/><em>Chơi thêm một ván.</em></h1><p>Chọn sân chơi của bạn. Mỗi trò là một cách mới để nhớ lâu hơn.</p></header><div className="arcade-catalog-grid">{games.map(({id,name,tag,text,icon:Icon,chips,art},index)=><Link className={`arcade-game-card art-${art}`} to={`/games/${id}`} key={id}><div className="arcade-card-top"><span>0{index+1} / {tag}</span><ArrowUpRight size={20}/></div><div className="arcade-art" aria-hidden="true">{art==='blocks'?<div className="arcade-block-preview">{Array.from({length:16},(_,i)=><i key={i}/>)}</div>:art==='blast'?<><i className="art-planet p1"/><i className="art-planet p2"/><Rocket className="art-rocket" size={80}/></>:<div className="art-cards"><span>{art==='match'?'hello':'?'}</span><span>{art==='match'?'xin chào':'?'}</span></div>}</div><div className="arcade-card-title"><Icon size={23}/><h2>{name}</h2></div><p>{text}</p><footer><span>{chips}</span><b>Chơi ngay →</b></footer></Link>)}</div></div>;
}
