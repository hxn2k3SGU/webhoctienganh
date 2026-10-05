import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Award, BookOpen, Crown, Flame, Gem, GraduationCap, Library, LockKeyhole, Medal, Rocket, Sparkles, Star, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import '../../styles/rewards.css';

const emblems = [BookOpen, Sparkles, Library, GraduationCap, Gem, Crown];
const streakEmblems = [Flame, Star, Medal, Trophy, Rocket];

/** Hiển thị chuỗi ngày học, lịch hoạt động và các huy hiệu đã mở khóa. */
export function Rewards() {
  const { data, error, refetch } = useQuery({ queryKey: ['progress'], queryFn: api.progress });
  if (error) return <p role="alert">Chưa tải được danh hiệu. <button onClick={() => void refetch()}>Thử lại</button></p>;
  if (!data) return <p role="status">Đang tải thành tích...</p>;
  const earned = data.achievements.filter(item => item.unlockedAt).length;
  const next = data.achievements.filter(item => !item.unlockedAt).sort((a, b) => b.value / b.target - a.value / a.target)[0];
  return <section className="rewards" aria-label="Chuỗi học và danh hiệu">
    <div className={`streak-banner ${data.studiedToday ? 'streak-active' : ''}`}><Flame size={36}/><div><h2>{data.streak} ngày liên tiếp</h2><p>{data.studiedToday ? 'Đã giữ nhịp hôm nay!' : 'Học hôm nay để tiếp nối chuỗi của bạn.'}</p></div><span>Kỷ lục <strong>{data.longest} ngày</strong></span></div>
    <div className="rewards-heading"><div><span className="rewards-eyebrow">DẤU ẤN HÀNH TRÌNH</span><h2>Danh hiệu của bạn</h2></div><span className="rewards-count"><Award size={18}/><strong>{earned}</strong> / {data.achievements.length} đã mở khóa</span></div>
    {next ? <div className="reward-next"><div><span>MỤC TIÊU TIẾP THEO</span><h3>{next.title}</h3><p>{next.kind === 'words' ? `Thêm ${Math.max(0, next.target - data.learned)} từ ghi nhớ để nhận huy hiệu này.` : `Chinh phục chuỗi ${next.target} ngày. Chuỗi hiện tại: ${data.streak} ngày.`}</p></div><Link to="/study">Tiếp tục học <ArrowRight size={17}/></Link></div> : <div className="reward-next"><div><h3>Bộ sưu tập đã trọn vẹn!</h3><p>{data.learned} từ đã ghi nhớ. Mỗi ngày học tiếp là một kỷ lục mới.</p></div><Crown size={32}/></div>}
    <div className="achievement-grid">{data.achievements.map(item => {
      const rank = data.achievements.filter(other => other.kind === item.kind).findIndex(other => other.id === item.id);
      const Icon = (item.kind === 'streak' ? streakEmblems : emblems)[rank % (item.kind === 'streak' ? streakEmblems.length : emblems.length)];
      return <article className={`achievement achievement-tier-${rank % 4} ${item.unlockedAt ? 'achievement-unlocked' : 'achievement-locked'}`} key={item.id}>
      <span className="achievement-category">{item.kind === 'words' ? 'TRI THỨC' : 'BỀN BỈ'} · {String(rank + 1).padStart(2, '0')}</span>
      <div className="achievement-medal"><span className="medal-face"><Icon size={30} strokeWidth={1.7}/></span><span className="medal-ribbon" aria-hidden="true"/>{item.unlockedAt && <span className="medal-star" aria-hidden="true"><Star size={13} fill="currentColor"/></span>}</div>
      <h3>{item.title}</h3><p>{item.target} {item.kind === 'words' ? 'từ ghi nhớ' : 'ngày liên tiếp'}</p>
      <div className="achievement-footer">{item.unlockedAt ? <span className="achievement-earned"><Award size={15}/> Đã chinh phục</span> : <><div className="achievement-progress-label"><LockKeyhole size={12}/><small>{item.value} / {item.target}</small></div><progress max={item.target} value={Math.min(item.value, item.target)} aria-label={item.title}/></>}</div>
    </article>})}</div>
  </section>;
}
