import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { Icon, Logo } from './components/Brand';
import ConsentBanner from './components/ConsentBanner';
import { inPreview, usePageTracking } from './lib/analytics';
import Account from './pages/Account';
import Admin from './pages/Admin';
import Checkout from './pages/Checkout';
import PaymentReturn from './pages/PaymentReturn';
import { ForgotPassword, ResetPassword } from './pages/PasswordReset';
import Coruja from './pages/Coruja';
import Dashboard from './pages/Dashboard';
import DeckReview from './pages/DeckReview';
import ExamPage from './pages/ExamPage';
import Exams from './pages/Exams';
import Flashcards from './pages/Flashcards';
import Landing from './pages/Landing';
import Legal, { DeleteAccountInfo } from './pages/Legal';
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
        {user?.role === 'admin' && <NavLink to="/admin" className="side-link"><Icon name="shield" size={16} /> <span>Admin</span></NavLink>}
        <NavLink to="/planos" className="side-plan"><Icon name="crown" size={16} /> <span>Planos</span></NavLink>
        <div className="me">
          <span className="avatar">{user?.name.charAt(0).toUpperCase()}</span>
          <NavLink to="/conta" className="me-name" title="Minha conta">{user?.name}</NavLink>
          <button className="icon-btn" onClick={() => logout()} title="Sair" aria-label="Sair"><Icon name="logout" size={16} /></button>
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

function AdminRoute() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <Admin /> : <Navigate to="/inicio" replace />;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user && !inPreview() ? <Navigate to="/inicio" replace /> : <Landing />;
}

export default function App() {
  usePageTracking();
  return (
    <>
    <ConsentBanner />
    <Routes>
      <Route index element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route path="/termos" element={<Legal doc="termos" />} />
      <Route path="/privacidade" element={<Legal doc="privacidade" />} />
      <Route path="/excluir-conta" element={<DeleteAccountInfo />} />
      <Route element={<Private bare />}>
        <Route path="checkout/:planId" element={<Checkout />} />
        <Route path="pagamento/:id" element={<PaymentReturn />} />
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
        <Route path="conta" element={<Account />} />
        <Route path="admin" element={<AdminRoute />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    </>
  );
}
