import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LanguageProvider } from './LanguageContext';
import { ModeProvider, useMode } from './ModeContext';
import { AuthProvider, useAuth } from './AuthContext';
import { AudioProvider } from './AudioProvider';
import { SocketProvider } from './SocketContext';
import { DataProvider, useData } from './DataContext';
import ScrollToTop from './components/ScrollToTop';
import PageTransition from './components/PageTransition';
import AnnouncementModal from './components/AnnouncementModal';
import BanDialog from './components/BanDialog';
import GlobalAlerts from './components/GlobalAlerts';
import HelperConfirmationDialog from './components/HelperConfirmationDialog';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Lazy-loaded pages for code splitting - dramatically reduces initial bundle size
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const ModeSelection = React.lazy(() => import('./pages/ModeSelection'));
const HardcoreDashboard = React.lazy(() => import('./pages/HardcoreDashboard'));
const CDLDashboard = React.lazy(() => import('./pages/CDLDashboard'));
const Rankings = React.lazy(() => import('./pages/Rankings'));
const RankingsInfo = React.lazy(() => import('./pages/RankingsInfo'));
const RankedMode = React.lazy(() => import('./pages/RankedMode'));
const Shop = React.lazy(() => import('./pages/Shop'));
const PlayerProfile = React.lazy(() => import('./pages/PlayerProfile'));
const SquadProfile = React.lazy(() => import('./pages/SquadProfile'));
const AllSquads = React.lazy(() => import('./pages/AllSquads'));
const SetupProfile = React.lazy(() => import('./pages/SetupProfile'));
const MyProfile = React.lazy(() => import('./pages/MyProfile'));
const SquadManagement = React.lazy(() => import('./pages/SquadManagement'));
const JoinSquad = React.lazy(() => import('./pages/JoinSquad'));
const AdminPanel = React.lazy(() => import('./pages/AdminPanel'));
const MatchSheet = React.lazy(() => import('./pages/MatchSheet'));
const Rules = React.lazy(() => import('./pages/Rules'));
const Anticheat = React.lazy(() => import('./pages/Anticheat'));
const IrisAuthorize = React.lazy(() => import('./pages/IrisAuthorize'));
const IrisCallback = React.lazy(() => import('./pages/IrisCallback'));
const TermsOfService = React.lazy(() => import('./pages/TermsOfService'));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const Messages = React.lazy(() => import('./pages/Messages'));
const MySquad = React.lazy(() => import('./pages/MySquad'));
const MyPurchases = React.lazy(() => import('./pages/MyPurchases'));
const GameModeRulesEditor = React.lazy(() => import('./components/GameModeRulesEditor'));
const RecentRankedMatches = React.lazy(() => import('./pages/RecentRankedMatches'));
const StrickerMode = React.lazy(() => import('./pages/StrickerMode'));
const StrickerMatchSheet = React.lazy(() => import('./pages/StrickerMatchSheet'));
const Team = React.lazy(() => import('./pages/Team'));
const IrisTermsOfUse = React.lazy(() => import('./pages/IrisTermsOfUse'));
const TournamentDetail = React.lazy(() => import('./pages/TournamentDetail'));

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
  const { isAuthenticated, isProfileComplete, loading, isStaff } = useAuth();
  const { isCdlModeEnabled, isHardcoreModeEnabled } = useData();
  
  if (loading) {
    return <LoadingScreen />;
  }

  if (!selectedMode) {
    return <Navigate to="/" replace />;
  }

  // Check if CDL mode is accessible (enabled OR staff)
  if (requiredMode === 'cdl' && !isCdlModeEnabled && !isStaff()) {
    return <Navigate to="/" replace />;
  }
  
  // Check if Hardcore mode is accessible (enabled OR staff)
  if (requiredMode === 'hardcore' && !isHardcoreModeEnabled && !isStaff()) {
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

// Route admin (for admin, staff, and arbitre)
const AdminRoute = ({ children }) => {
  const { isAuthenticated, isProfileComplete, loading, hasAdminAccess } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || !isProfileComplete) {
    return <Navigate to="/" replace />;
  }

  if (!hasAdminAccess()) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

// Route stricker (for admin, staff, arbitre, OR everyone when strickerMode is enabled)
const StrickerRoute = ({ children }) => {
  const { isAuthenticated, isProfileComplete, loading, hasAdminAccess } = useAuth();
  const { isStrickerModeEnabled, strickerModeLoading } = useData();
  
  if (loading || strickerModeLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || !isProfileComplete) {
    return <Navigate to="/" replace />;
  }

  // Allow access if strickerMode is enabled globally OR if user has admin access
  if (!isStrickerModeEnabled && !hasAdminAccess()) {
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
  const isRulesPage = location.pathname === '/rules';
  const isAnticheatPage = location.pathname === '/anticheat';
  const isTermsPage = location.pathname === '/terms';
  const isPrivacyPage = location.pathname === '/privacy';
  const isIrisTermsPage = location.pathname === '/iris-terms';
  const isTournamentsPage = location.pathname.startsWith('/tournaments');

  // Pages qui n'ont pas besoin d'un mode mais doivent afficher la navbar
  const isStandalonePage = isMyProfilePage || isSquadManagementPage || isMySquadPage || isMessagesPage || isRulesPage || isAnticheatPage || isTermsPage || isPrivacyPage || isIrisTermsPage || isTournamentsPage;

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
        <Suspense fallback={<LoadingScreen />}>
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
            path="/cdl/ranked/recent-matches" 
            element={
              <ProtectedRoute requiredMode="cdl">
                <PageTransition>
                  <RecentRankedMatches />
                </PageTransition>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/hardcore/ranked/recent-matches" 
            element={
              <ProtectedRoute requiredMode="hardcore">
                <PageTransition>
                  <RecentRankedMatches />
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
          <Route 
            path="/ranked/match/:matchId" 
            element={
              <AuthenticatedRoute>
                <PageTransition>
                  <MatchSheet />
                </PageTransition>
              </AuthenticatedRoute>
            } 
          />

          {/* Tournament Detail */}
          <Route 
            path="/tournaments/:tournamentId" 
            element={
              <ProtectedRoute>
                <PageTransition>
                  <TournamentDetail />
                </PageTransition>
              </ProtectedRoute>
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

          {/* Iris Authorization (for desktop app) */}
          <Route 
            path="/iris/authorize" 
            element={<IrisAuthorize />} 
          />

          {/* Iris Discord Callback */}
          <Route 
            path="/iris/callback" 
            element={<IrisCallback />} 
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

          {/* Iris Terms of Use */}
          <Route 
            path="/iris-terms" 
            element={
              <ProtectedRoute>
                <PageTransition>
                  <IrisTermsOfUse />
                </PageTransition>
              </ProtectedRoute>
            } 
          />

          {/* Team Page */}
          <Route 
            path="/team" 
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Team />
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

          {/* My Purchases - Authenticated users only */}
          <Route 
            path="/my-purchases" 
            element={
              <AuthenticatedRoute>
                <PageTransition>
                  <MyPurchases />
                </PageTransition>
              </AuthenticatedRoute>
            } 
          />

          {/* Stricker Mode - Admin, Staff, Arbitre only */}
          <Route 
            path="/:mode/stricker" 
            element={
              <StrickerRoute>
                <PageTransition>
                  <StrickerMode />
                </PageTransition>
              </StrickerRoute>
            } 
          />

          {/* Stricker Match Sheet - Admin, Staff, Arbitre only */}
          <Route 
            path="/:mode/stricker/match/:matchId" 
            element={
              <StrickerRoute>
                <PageTransition>
                  <StrickerMatchSheet />
                </PageTransition>
              </StrickerRoute>
            } 
          />
        </Routes>
        </Suspense>
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
          <DataProvider>
            <ModeProvider>
              <Router>
                <AudioProvider>
                  <AppContent />
                </AudioProvider>
              </Router>
            </ModeProvider>
          </DataProvider>
        </SocketProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
