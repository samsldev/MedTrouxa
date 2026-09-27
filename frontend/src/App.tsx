import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { Icon, Logo } from './components/Brand';
import Checkout from './pages/Checkout';
import Coruja from './pages/Coruja';
import Dashboard from './pages/Dashboard';
import DeckReview from './pages/DeckReview';
import ExamPage from './pages/ExamPage';
import Exams from './pages/Exams';
import Flashcards from './pages/Flashcards';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Plans from './pages/Plans';
import Questions from './pages/Questions';
import Ranking from './pages/Ranking';
import Subscription from './pages/Subscription';

const NAV = [
  ['/inicio', 'home', 'Início'],
  ['/questoes', 'questions', 'Questões'],
  ['/flashcards', 'cards', 'Flashcards'],
  ['/simulados', 'timer', 'Simulados'],
  ['/cronogramas', 'calendar', 'Cronogramas'],
  ['/coruja', 'owl', 'Coruja IA'],
  ['/ranking', 'trophy', 'Ranking'],
] as const;

function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="layout">
      <aside className="sidebar">
        <NavLink to="/inicio" className="side-logo"><Logo size={26} /></NavLink>
        <nav>
          {NAV.map(([to, icon, label]) => (
            <NavLink key={to} to={to}><Icon name={icon} /> <span>{label}</span></NavLink>
          ))}
        </nav>
        <NavLink to="/planos" className="side-plan"><Icon name="crown" size={16} /> <span>Planos</span></NavLink>
        <div className="me">
          <span className="avatar">{user?.name.charAt(0).toUpperCase()}</span>
          <span className="me-name">{user?.name}</span>
          <button className="icon-btn" onClick={logout} title="Sair" aria-label="Sair"><Icon name="logout" size={16} /></button>
        </div>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}

function Private({ bare = false }: { bare?: boolean }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="center">Carregando...</div>;
  if (!user) return <Navigate to={`/login?mode=register&next=${encodeURIComponent(loc.pathname)}`} replace />;
  return bare ? <Outlet /> : <Layout />;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/inicio" replace /> : <Landing />;
}

export default function App() {
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route element={<Private bare />}>
        <Route path="checkout/:planId" element={<Checkout />} />
      </Route>
      <Route element={<Private />}>
        <Route path="inicio" element={<Dashboard />} />
        <Route path="questoes" element={<Questions />} />
        <Route path="flashcards" element={<Flashcards />} />
        <Route path="flashcards/:id" element={<DeckReview />} />
        <Route path="simulados" element={<Exams />} />
        <Route path="simulados/:id" element={<ExamPage />} />
        <Route path="cronogramas" element={<Plans />} />
        <Route path="coruja" element={<Coruja />} />
        <Route path="ranking" element={<Ranking />} />
        <Route path="planos" element={<Subscription />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
