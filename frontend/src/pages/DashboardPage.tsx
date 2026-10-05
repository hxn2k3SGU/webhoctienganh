import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookMarked, Flame, Layers3, Sparkles, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { ActivityChart, StatusChart } from '../components/dashboard/Charts';
import { Button, Card, PageHeader, Skeleton } from '../components/ui';
import { Rewards } from '../components/dashboard/Rewards';

/** Trang tổng quan: số liệu học tập, biểu đồ hoạt động và huy hiệu. */
export function DashboardPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard });
  const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());
  if (isLoading) return <div className="page"><PageHeader eyebrow={today} title="Chào buổi học."/><div className="kpi-grid">{[1,2,3,4].map(x => <Skeleton key={x} className="h-36"/>)}</div></div>;
  if (error || !data) return <div className="page"><PageHeader title="Chưa tải được bảng điều khiển" body="Máy chủ có thể chưa khởi động. Hãy thử tải lại sau."/><Button onClick={() => location.reload()}>Thử lại</Button></div>;
  const stats = [{ label: 'Cần ôn hôm nay', value: data.dueToday, icon: Layers3, tone: 'green' }, { label: 'Từ mới sẵn sàng', value: data.newAvailable, icon: Sparkles, tone: 'yellow' }, { label: 'Đã thành thạo', value: data.mastered, icon: Trophy, tone: 'coral' }, { label: 'Chuỗi ngày học', value: `${data.streak} ngày`, icon: Flame, tone: 'blue' }];
  return <div className="page">
    <PageHeader eyebrow={today} title="Chào buổi học." body="Một chút mỗi ngày, ký ức sẽ thành phản xạ." action={<Link to="/study"><Button>Bắt đầu ôn <ArrowRight size={17}/></Button></Link>}/>
    <motion.div className="kpi-grid" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: .08 } } }}>{stats.map(({ label, value, icon: Icon, tone }) => <motion.div key={label} variants={{ hidden: { y: 16, opacity: 0 }, show: { y: 0, opacity: 1 } }}><Card className={`kpi kpi-${tone}`}><div className="kpi-icon"><Icon size={22}/></div><strong>{value}</strong><span>{label}</span></Card></motion.div>)}</motion.div>
    <Rewards/>
    <div className="dashboard-grid">
      <Card className="chart-card"><div className="section-title"><div><span>NHỊP HỌC</span><h2>7 ngày gần đây</h2></div><b>{data.reviewedThisWeek} lượt</b></div><ActivityChart data={data.activity}/></Card>
      <Card className="chart-card"><div className="section-title"><div><span>THƯ VIỆN</span><h2>Trạng thái từ</h2></div></div><StatusChart data={data.statuses}/></Card>
      <Card className="today-card"><div className="today-art"><BookMarked size={38}/></div><div><span>VIỆC HÔM NAY</span><h2>Giữ nhịp, đừng giữ áp lực.</h2><p>Bắt đầu với {data.dueToday} thẻ đến hạn, sau đó khám phá {Math.min(data.newAvailable, 10)} từ mới.</p><Link to="/study"><Button variant="secondary">Chọn phiên học <ArrowRight size={16}/></Button></Link></div></Card>
      <Card className="tag-card"><div className="section-title"><div><span>CHỦ ĐỀ</span><h2>Bộ sưu tập nổi bật</h2></div></div><div className="tag-bars">{data.tags.slice(0,5).map((tag, i) => <div key={tag.name}><span>{tag.name}</span><div><i style={{ width: `${Math.max(12, tag.value / Math.max(...data.tags.map(t => t.value)) * 100)}%`, animationDelay: `${i * 100}ms` }}/></div><b>{tag.value}</b></div>)}</div></Card>
    </div>
  </div>;
}
