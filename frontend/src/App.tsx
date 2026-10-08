import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './auth/routes';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { QuizPage } from './pages/QuizPage';
import { GamesPage } from './pages/GamesPage';
import { GameCatalogPage } from './pages/GameCatalogPage';
import { ArcadePage } from './pages/ArcadePage';
import { SettingsPage } from './pages/SettingsPage';
import { StudyPage } from './pages/StudyPage';
import { VocabularyPage } from './pages/VocabularyPage';
import { ToeicPage } from './pages/ToeicPage';

/** Khai báo các route của ứng dụng: trang công khai (đăng nhập/đăng ký) và trang cần đăng nhập. */
export default function App() {
  return <Routes>
    <Route element={<PublicOnlyRoute/>}><Route path="login" element={<LoginPage/>}/><Route path="register" element={<LoginPage key="register"/>}/></Route>
    <Route element={<ProtectedRoute/>}>
      <Route element={<AppShell/>}>
        <Route index element={<DashboardPage/>}/>
        <Route path="vocabulary" element={<VocabularyPage/>}/>
        <Route path="study" element={<StudyPage/>}/>
        <Route path="quiz" element={<QuizPage/>}/>
        <Route path="toeic" element={<ToeicPage/>}/>
        <Route path="games" element={<GameCatalogPage/>}/>
        <Route path="games/match" element={<GamesPage key="match" initialMode="match"/>}/>
        <Route path="games/memory" element={<GamesPage key="memory" initialMode="memory"/>}/>
        <Route path="games/blocks" element={<ArcadePage key="blocks" game="blocks"/>}/>
        <Route path="games/blast" element={<ArcadePage key="blast" game="blast"/>}/>
        <Route path="settings" element={<SettingsPage/>}/>
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}
