import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LanguageProvider } from './LanguageContext';
import { ModeProvider, useMode } from './ModeContext';
import { AuthProvider, useAuth } from './AuthContext';
import { AudioProvider } from './AudioProvider';
import { SocketProvider } from './SocketContext';
import ScrollToTop from './components/ScrollToTop';
import PageTransition from './components/PageTransition';
import AnnouncementModal from './components/AnnouncementModal';
import BanDialog from './components/BanDialog';
import GlobalAlerts from './components/GlobalAlerts';
import HelperConfirmationDialog from './components/HelperConfirmationDialog';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import ModeSelection from './pages/ModeSelection';
import HardcoreDashboard from './pages/HardcoreDashboard';
import CDLDashboard from './pages/CDLDashboard';
import Rankings from './pages/Rankings';
import RankingsInfo from './pages/RankingsInfo';
import RankedMode from './pages/RankedMode';
import Shop from './pages/Shop';
import PlayerProfile from './pages/PlayerProfile';
import SquadProfile from './pages/SquadProfile';
import AllSquads from './pages/AllSquads';
import SetupProfile from './pages/SetupProfile';
import MyProfile from './pages/MyProfile';
import SquadManagement from './pages/SquadManagement';
import JoinSquad from './pages/JoinSquad';
import AdminPanel from './pages/AdminPanel';
import MatchSheet from './pages/MatchSheet';
import Rules from './pages/Rules';
import Anticheat from './pages/Anticheat';
import SquadHub from './pages/SquadHub';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Messages from './pages/Messages';
import MySquad from './pages/MySquad';
import MyDisputes from './pages/MyDisputes';
import GameModeRulesEditor from './components/GameModeRulesEditor';

// Loading component
const LoadingScreen = () => (
  <div className="min-h-screen bg-dark-950 flex items-center justify-center">
    <div className="flex flex-col items-center space-y-4">
      <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
      <p className="text-gray-400">Chargement...</p>
    </div>
  </div>
);

// Composant pour protéger les routes selon le mode sélectionné
const ProtectedRoute = ({ children, requiredMode }) => {
  const { selectedMode } = useMode();
  const { isAuthenticated, isProfileComplete, loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }

  if (!selectedMode) {
    return <Navigate to="/" replace />;
  }

  // Mode CDL temporairement indisponible
  if (requiredMode === 'cdl') {
    return <Navigate to="/" replace />;
  }
  
  if (requiredMode && selectedMode !== requiredMode) {
    return <Navigate to={`/${selectedMode}`} replace />;
  }
  
  return children;
};

// Route qui nécessite authentification
const AuthenticatedRoute = ({ children }) => {
  const { isAuthenticated, isProfileComplete, loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!isProfileComplete) {
    return <Navigate to="/setup-profile" replace />;
  }
  
  return children;
};

// Route pour le setup de profil
const SetupProfileRoute = ({ children }) => {
  const { isAuthenticated, isProfileComplete, loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (isProfileComplete) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

// Route admin
const AdminRoute = ({ children }) => {
  const { isAuthenticated, isProfileComplete, loading, isStaff } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || !isProfileComplete) {
    return <Navigate to="/" replace />;
  }

  if (!isStaff()) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

// Composant pour la page d'accueil - Landing page de présentation
const HomeRedirect = () => {
  return <LandingPage />;
};

function AppContent() {
  const { selectedMode, selectMode } = useMode();
  const { loading, banInfo, clearBanInfo } = useAuth();
  const location = useLocation();
  const isHomePage = location.pathname === '/' || location.pathname === '/play';
  const isSetupPage = location.pathname === '/setup-profile';
  const isAdminPage = location.pathname === '/admin';
  const isMyProfilePage = location.pathname === '/my-profile';
  const isSquadManagementPage = location.pathname === '/squad-management';
  const isMySquadPage = location.pathname === '/my-squad';
  const isMessagesPage = location.pathname === '/messages';
  const isMyDisputesPage = location.pathname === '/my-disputes';
  const isRulesPage = location.pathname === '/rules';
  const isAnticheatPage = location.pathname === '/anticheat';
  const isSquadHubPage = location.pathname === '/squad-hub';
  const isTermsPage = location.pathname === '/terms';
  const isPrivacyPage = location.pathname === '/privacy';

  // Pages qui n'ont pas besoin d'un mode mais doivent afficher la navbar
  const isStandalonePage = isMyProfilePage || isSquadManagementPage || isMySquadPage || isMessagesPage || isMyDisputesPage || isRulesPage || isAnticheatPage || isSquadHubPage || isTermsPage || isPrivacyPage;

  // Si on est sur une page standalone sans mode, on sélectionne hardcore par défaut
  React.useEffect(() => {
    if (isStandalonePage && !selectedMode) {
      selectMode('hardcore');
    }
  }, [isStandalonePage, selectedMode, selectMode]);

  if (loading) {
    return <LoadingScreen />;
  }

  // Afficher la navbar sur les pages avec mode OU sur les pages standalone
  const showNavbar = (selectedMode || isStandalonePage) && !isHomePage && !isSetupPage && !isAdminPage;

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      <ScrollToTop />
      <BanDialog
        isOpen={!!banInfo}
        onClose={clearBanInfo}
        banInfo={banInfo}
      />
      {showNavbar && <Navbar />}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={
            <PageTransition>
              <HomeRedirect />
            </PageTransition>
          } />

          {/* Play - Mode Selection */}
          <Route path="/play" element={
            <PageTransition>
              <ModeSelection />
            </PageTransition>
          } />
          
          {/* Setup Profile - Required after first Discord login */}
          <Route path="/setup-profile" element={
            <SetupProfileRoute>
              <PageTransition>
                <SetupProfile />
              </PageTransition>
            </SetupProfileRoute>
          } />

          {/* My Profile - Authenticated users only */}
          <Route path="/my-profile" element={
            <AuthenticatedRoute>
              <PageTransition>
                <MyProfile />
              </PageTransition>
            </AuthenticatedRoute>
          } />

          {/* Squad Management - Authenticated users only */}
          <Route path="/squad-management" element={
            <AuthenticatedRoute>
              <PageTransition>
                <SquadManagement />
              </PageTransition>
            </AuthenticatedRoute>
          } />

          {/* Join Squad via invite code */}
          <Route path="/join/:inviteCode" element={
            <PageTransition>
              <JoinSquad />
            </PageTransition>
          } />

          {/* Admin Panel - Staff only */}
          <Route path="/admin" element={
            <AdminRoute>
              <PageTransition>
                <AdminPanel />
              </PageTransition>
            </AdminRoute>
          } />

          {/* Game Rules Editor - Staff only */}
          <Route path="/admin/game-rules-editor" element={
            <AdminRoute>
              <PageTransition>
                <GameModeRulesEditor />
              </PageTransition>
            </AdminRoute>
          } />

          <Route 
            path="/hardcore" 
            element={
              <ProtectedRoute requiredMode="hardcore">
                <PageTransition>
                  <HardcoreDashboard />
                </PageTransition>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/cdl" 
            element={
              <ProtectedRoute requiredMode="cdl">
                <PageTransition>
                  <CDLDashboard />
                </PageTransition>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/cdl/rankings" 
            element={
              <ProtectedRoute requiredMode="cdl">
                <PageTransition>
                  <Rankings />
                </PageTransition>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/hardcore/rankings" 
            element={
              <ProtectedRoute requiredMode="hardcore">
                <PageTransition>
                  <Rankings />
                </PageTransition>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/cdl/ladder-rules" 
            element={
              <ProtectedRoute requiredMode="cdl">
                <PageTransition>
                  <RankingsInfo />
                </PageTransition>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/hardcore/ladder-rules" 
            element={
              <ProtectedRoute requiredMode="hardcore">
                <PageTransition>
                  <RankingsInfo />
                </PageTransition>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/cdl/ranked" 
            element={
              <ProtectedRoute requiredMode="cdl">
                <PageTransition>
                  <RankedMode />
                </PageTransition>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/hardcore/ranked" 
            element={
              <ProtectedRoute requiredMode="hardcore">
                <PageTransition>
                  <RankedMode />
                </PageTransition>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/cdl/shop" 
            element={
              <ProtectedRoute requiredMode="cdl">
                <PageTransition>
                  <Shop />
                </PageTransition>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/hardcore/shop" 
            element={
              <ProtectedRoute requiredMode="hardcore">
                <PageTransition>
                  <Shop />
                </PageTransition>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/player/:playerId" 
            element={
              <ProtectedRoute>
                <PageTransition>
                  <PlayerProfile />
                </PageTransition>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/squads" 
            element={
              <ProtectedRoute>
                <PageTransition>
                  <AllSquads />
                </PageTransition>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/squad/:squadId" 
            element={
              <ProtectedRoute>
                <PageTransition>
                  <SquadProfile />
                </PageTransition>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/match/:matchId" 
            element={
              <AuthenticatedRoute>
                <PageTransition>
                  <MatchSheet />
                </PageTransition>
              </AuthenticatedRoute>
            } 
          />

          {/* Rules */}
          <Route 
            path="/rules" 
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Rules />
                </PageTransition>
              </ProtectedRoute>
            } 
          />

          {/* Anticheat */}
          <Route 
            path="/anticheat" 
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Anticheat />
                </PageTransition>
              </ProtectedRoute>
            } 
          />

          {/* Squad Hub */}
          <Route 
            path="/squad-hub" 
            element={
              <ProtectedRoute>
                <PageTransition>
                  <SquadHub />
                </PageTransition>
              </ProtectedRoute>
            } 
          />

          {/* Terms of Service */}
          <Route 
            path="/terms" 
            element={
              <ProtectedRoute>
                <PageTransition>
                  <TermsOfService />
                </PageTransition>
              </ProtectedRoute>
            } 
          />

          {/* Privacy Policy */}
          <Route 
            path="/privacy" 
            element={
              <ProtectedRoute>
                <PageTransition>
                  <PrivacyPolicy />
                </PageTransition>
              </ProtectedRoute>
            } 
          />

          {/* Messages - Authenticated users only */}
          <Route 
            path="/messages" 
            element={
              <AuthenticatedRoute>
                <PageTransition>
                  <Messages />
                </PageTransition>
              </AuthenticatedRoute>
            } 
          />

          {/* My Squad - Authenticated users only */}
          <Route 
            path="/my-squad" 
            element={
              <AuthenticatedRoute>
                <PageTransition>
                  <MySquad />
                </PageTransition>
              </AuthenticatedRoute>
            } 
          />

          {/* My Disputes - Authenticated users only */}
          <Route 
            path="/my-disputes" 
            element={
              <AuthenticatedRoute>
                <PageTransition>
                  <MyDisputes />
                </PageTransition>
              </AuthenticatedRoute>
            } 
          />
        </Routes>
      </main>
      {showNavbar && <Footer />}
      
      {/* Announcement Modal - Shows pending announcements */}
      <AnnouncementModal />
      
      {/* Global Alerts - Shows app-wide notifications and disabled features */}
      <GlobalAlerts />
      
      {/* Helper Confirmation Dialog - Shows when someone requests you as helper */}
      <HelperConfirmationDialog />
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <SocketProvider>
          <ModeProvider>
            <Router>
              <AudioProvider>
                <AppContent />
              </AudioProvider>
            </Router>
          </ModeProvider>
        </SocketProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
