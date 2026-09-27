import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Coruja from './pages/Coruja';
import Dashboard from './pages/Dashboard';
import DeckReview from './pages/DeckReview';
import Flashcards from './pages/Flashcards';
import Login from './pages/Login';
import Plans from './pages/Plans';
import Questions from './pages/Questions';
import Ranking from './pages/Ranking';
import ExamPage from './pages/ExamPage';
import Exams from './pages/Exams';

const NAV = [
  ['/', '🏠', 'Início'],
  ['/questoes', '📝', 'Questões'],
  ['/flashcards', '🃏', 'Flashcards'],
  ['/simulados', '⏱️', 'Simulados'],
  ['/cronogramas', '📅', 'Cronogramas'],
  ['/coruja', '🦉', 'Coruja IA'],
  ['/ranking', '🏆', 'Ranking'],
] as const;

function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">⚡ Med<span>Trouxa</span></div>
        <nav>
          {NAV.map(([to, icon, label]) => (
            <NavLink key={to} to={to} end={to === '/'}><span>{icon}</span>{label}</NavLink>
          ))}
        </nav>
        <div className="me">
          <strong>{user?.name}</strong>
          <button className="link" onClick={logout}>Sair</button>
        </div>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}

function Private() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center">Carregando...</div>;
  return user ? <Layout /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Private />}>
        <Route index element={<Dashboard />} />
        <Route path="questoes" element={<Questions />} />
        <Route path="flashcards" element={<Flashcards />} />
        <Route path="flashcards/:id" element={<DeckReview />} />
        <Route path="simulados" element={<Exams />} />
        <Route path="simulados/:id" element={<ExamPage />} />
        <Route path="cronogramas" element={<Plans />} />
        <Route path="coruja" element={<Coruja />} />
        <Route path="ranking" element={<Ranking />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
