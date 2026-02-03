import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { 
  ArrowLeft, Info, Trophy, Users, Clock, Target, 
  TrendingUp, Award, Shield, Crown,
  CheckCircle, Coins, Loader2, AlertTriangle, Zap
} from 'lucide-react';

import { API_URL } from '../config';

const RankingsInfo = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const isHardcore = selectedMode === 'hardcore';
  
  // Fetch config on mount (both match config and app settings)
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Fetch match config
        const configRes = await fetch(`${API_URL}/matches/public-config`);
        const configData = await configRes.json();
        
        // Fetch app settings for ladder time restrictions
        const settingsRes = await fetch(`${API_URL}/app-settings/public`);
        const settingsData = await settingsRes.json();
        
        if (configData.success) {
          setConfig({
            ...configData,
            ladderSettings: settingsData?.ladderSettings || null
          });
        }
      } catch (err) {
        console.error('Error fetching config:', err);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchConfig();
  }, []);
  
  const colors = {
    primary: isHardcore ? 'red' : 'cyan',
    gradient: isHardcore ? 'from-red-500 to-orange-500' : 'from-cyan-500 to-blue-500',
    glow: isHardcore ? 'shadow-red-500/30' : 'shadow-cyan-500/30',
    border: isHardcore ? 'border-red-500/30' : 'border-cyan-500/30',
    text: isHardcore ? 'text-red-400' : 'text-cyan-400',
    bg: isHardcore ? 'bg-red-500/10' : 'bg-cyan-500/10',
  };

  // Traductions
  const texts = {
    fr: {
      back: 'Retour',
      title: 'Informations sur les Classements',
      subtitle: 'Tout ce que vous devez savoir sur le système de classement',
      
      // Sections
      howItWorks: 'Comment ça fonctionne',
      howItWorksDesc: 'Le système de classement NoMercy permet aux escouades de s\'affronter dans différents formats compétitifs et de grimper dans le classement pour prouver leur valeur.',
      
      ladderTypes: 'Types de Classements',
      duoTrio: 'Chill',
      duoTrioDesc: 'Format compétitif en 2v2, 3v3 ou 4v4',
      duoTrioTime: 'Ouvert de 00h00 à 20h00 (heure française)',
      squadTeam: 'Compétitif',
      squadTeamDesc: 'Format compétitif en 5v5',
      squadTeamTime: 'Disponible 24h/24, 7j/7',
      
      pointsSystem: 'Système de Points',
      pointsSystemDesc: 'Chaque victoire ou défaite affecte votre classement selon un système de points dynamique.',
      victoryPoints: 'Victoire',
      victoryPointsDesc: '+25 points par victoire',
      defeatPoints: 'Défaite',
      defeatPointsDesc: '-15 points par défaite (minimum 0)',
      rankingCalc: 'Calcul du Classement',
      rankingCalcDesc: 'Les équipes sont classées par nombre de points total, puis par ratio victoires/défaites en cas d\'égalité.',
      
      registration: 'Inscription',
      registrationTitle: 'Comment s\'inscrire',
      registrationDesc: 'Pour participer aux classements, vous devez :',
      registrationStep1: 'Avoir une escouade active',
      registrationStep2: 'Cliquer sur "S\'inscrire au classement" sur le ladder souhaité',
      registrationStep3: 'Organiser des matchs via la feuille de match',
      registrationStep4: 'Grimper dans le classement !',
      
      unregistration: 'Désinscription',
      unregistrationTitle: 'Se désinscrire d\'un classement',
      unregistrationDesc: 'Vous pouvez vous désinscrire à tout moment, mais attention :',
      unregistrationWarning: 'Toutes vos statistiques pour ce classement seront définitivement perdues (points, victoires, défaites).',
      
      matchRules: 'Règles des Matchs',
      matchRulesTitle: 'Organisation des matchs',
      matchRulesDesc: 'Les matchs se déroulent selon des règles strictes :',
      matchRule1: 'Utiliser la feuille de match officielle pour organiser vos rencontres',
      matchRule2: 'Les deux équipes doivent être inscrites au même classement',
      matchRule3: 'Les preuves (captures d\'écran) sont obligatoires',
      matchRule4: 'En cas de litige, contacter le staff via le système de litiges',
      
      rewards: 'Récompenses',
      rewardsTitle: 'Récompenses de fin de saison',
      rewardsDesc: 'Les meilleures équipes de chaque classement recevront des récompenses exclusives :',
      reward1: '1ère place : Trophée exclusif Or + 150 pts dans le top escouade',
      reward2: '2ème place : Trophée exclusif Argent + 100 pts dans le top escouade',
      reward3: '3ème place : Trophée exclusif Bronze + 75 pts dans le top escouade',
      
      tips: 'Conseils',
      tipsTitle: 'Conseils pour réussir',
      tip1: 'Communiquez avec votre équipe et développez des stratégies',
      tip2: 'Étudiez les maps et les modes de jeu autorisés',
      tip3: 'Organisez des sessions d\'entraînement régulières',
      tip4: 'Respectez les règles et le fair-play',
      tip5: 'Utilisez le système de litiges en cas de problème',
      
      faq: 'Questions Fréquentes',
      faqQuestion1: 'Puis-je être dans plusieurs escouades ?',
      faqAnswer1: 'Non, vous ne pouvez être membre que d\'une seule escouade à la fois.',
      faqQuestion2: 'Que se passe-t-il si je quitte mon escouade ?',
      faqAnswer2: 'Si vous quittez votre escouade, vous perdez votre accès aux classements jusqu\'à ce que vous rejoigniez une nouvelle escouade.',
      faqQuestion3: 'Puis-je m\'inscrire aux deux classements ?',
      faqAnswer3: 'Oui, votre escouade peut s\'inscrire simultanément au Chill et au Compétitif.',
      faqQuestion4: 'Comment sont résolus les litiges ?',
      faqAnswer4: 'Les litiges sont examinés par le staff qui analysera les preuves fournies par les deux équipes.',
      
      backToRankings: 'Retour aux Classements',
    },
    en: {
      back: 'Back',
      title: 'Rankings Information',
      subtitle: 'Everything you need to know about the ranking system',
      
      howItWorks: 'How It Works',
      howItWorksDesc: 'The NoMercy ranking system allows squads to compete in different competitive formats and climb the rankings to prove their worth.',
      
      ladderTypes: 'Ranking Types',
      duoTrio: 'Chill',
      duoTrioDesc: 'Competitive format in 2v2, 3v3 or 4v4',
      duoTrioTime: 'Open from 00:00 to 20:00 (French time)',
      squadTeam: 'Compétitif',
      squadTeamDesc: 'Competitive format in 5v5',
      squadTeamTime: 'Available 24/7',
      
      pointsSystem: 'Points System',
      pointsSystemDesc: 'Each victory or defeat affects your ranking according to a dynamic points system.',
      victoryPoints: 'Victory',
      victoryPointsDesc: '+25 points per victory',
      defeatPoints: 'Defeat',
      defeatPointsDesc: '-15 points per defeat (minimum 0)',
      rankingCalc: 'Ranking Calculation',
      rankingCalcDesc: 'Teams are ranked by total points, then by win/loss ratio in case of a tie.',
      
      registration: 'Registration',
      registrationTitle: 'How to Register',
      registrationDesc: 'To participate in rankings, you must:',
      registrationStep1: 'Have an active squad',
      registrationStep2: 'Click "Join ranking" on the desired ladder',
      registrationStep3: 'Organize matches via the match sheet',
      registrationStep4: 'Climb the rankings!',
      
      unregistration: 'Unregistration',
      unregistrationTitle: 'Unregister from a Ranking',
      unregistrationDesc: 'You can unregister at any time, but beware:',
      unregistrationWarning: 'All your statistics for this ranking will be permanently lost (points, wins, losses).',
      
      matchRules: 'Match Rules',
      matchRulesTitle: 'Match Organization',
      matchRulesDesc: 'Matches follow strict rules:',
      matchRule1: 'Use the official match sheet to organize your matches',
      matchRule2: 'Both teams must be registered in the same ranking',
      matchRule3: 'Evidence (screenshots) is mandatory',
      matchRule4: 'In case of dispute, contact staff via the dispute system',
      
      rewards: 'Rewards',
      rewardsTitle: 'End of Season Rewards',
      rewardsDesc: 'The best teams in each ranking will receive exclusive rewards:',
      reward1: '1st place: Exclusive Gold trophy + 150 pts in top squad',
      reward2: '2nd place: Exclusive Silver trophy + 100 pts in top squad',
      reward3: '3rd place: Exclusive Bronze trophy + 75 pts in top squad',
      
      tips: 'Tips',
      tipsTitle: 'Tips for Success',
      tip1: 'Communicate with your team and develop strategies',
      tip2: 'Study the allowed maps and game modes',
      tip3: 'Organize regular training sessions',
      tip4: 'Respect the rules and fair play',
      tip5: 'Use the dispute system in case of problems',
      
      faq: 'FAQ',
      faqQuestion1: 'Can I be in multiple squads?',
      faqAnswer1: 'No, you can only be a member of one squad at a time.',
      faqQuestion2: 'What happens if I leave my squad?',
      faqAnswer2: 'If you leave your squad, you lose access to rankings until you join a new squad.',
      faqQuestion3: 'Can I register for both rankings?',
      faqAnswer3: 'Yes, your squad can register for both Chill and Compétitif simultaneously.',
      faqQuestion4: 'How are disputes resolved?',
      faqAnswer4: 'Disputes are reviewed by staff who will analyze evidence provided by both teams.',
      
      backToRankings: 'Back to Rankings',
    },
    de: {
      back: 'Zurück',
      title: 'Ranglisten-Informationen',
      subtitle: 'Alles, was Sie über das Ranglistensystem wissen müssen',
      
      howItWorks: 'Wie es funktioniert',
      howItWorksDesc: 'Das NoMercy-Ranglistensystem ermöglicht es Squads, in verschiedenen Wettkampfformaten zu konkurrieren und in den Ranglisten aufzusteigen.',
      
      ladderTypes: 'Ranglisten-Typen',
      duoTrio: 'Chill',
      duoTrioDesc: 'Wettkampfformat 2v2, 3v3 oder 4v4',
      duoTrioTime: 'Geöffnet von 00:00 bis 20:00 Uhr (französische Zeit)',
      squadTeam: 'Compétitif',
      squadTeamDesc: 'Wettkampfformat 5v5',
      squadTeamTime: 'Verfügbar 24/7',
      
      pointsSystem: 'Punktesystem',
      pointsSystemDesc: 'Jeder Sieg oder Niederlage beeinflusst Ihre Rangliste nach einem dynamischen Punktesystem.',
      victoryPoints: 'Sieg',
      victoryPointsDesc: '+25 Punkte pro Sieg',
      defeatPoints: 'Niederlage',
      defeatPointsDesc: '-15 Punkte pro Niederlage (Minimum 0)',
      rankingCalc: 'Ranglistenberechnung',
      rankingCalcDesc: 'Teams werden nach Gesamtpunkten eingestuft, bei Gleichstand nach Sieg/Niederlage-Verhältnis.',
      
      registration: 'Registrierung',
      registrationTitle: 'Wie man sich registriert',
      registrationDesc: 'Um an Ranglisten teilzunehmen, müssen Sie:',
      registrationStep1: 'Ein aktives Squad haben',
      registrationStep2: 'Auf "Rangliste beitreten" bei der gewünschten Rangliste klicken',
      registrationStep3: 'Matches über das Match-Blatt organisieren',
      registrationStep4: 'In den Ranglisten aufsteigen!',
      
      unregistration: 'Abmeldung',
      unregistrationTitle: 'Von einer Rangliste abmelden',
      unregistrationDesc: 'Sie können sich jederzeit abmelden, aber Vorsicht:',
      unregistrationWarning: 'Alle Ihre Statistiken für diese Rangliste gehen dauerhaft verloren (Punkte, Siege, Niederlagen).',
      
      matchRules: 'Match-Regeln',
      matchRulesTitle: 'Match-Organisation',
      matchRulesDesc: 'Matches folgen strengen Regeln:',
      matchRule1: 'Verwenden Sie das offizielle Match-Blatt',
      matchRule2: 'Beide Teams müssen in derselben Rangliste registriert sein',
      matchRule3: 'Beweise (Screenshots) sind obligatorisch',
      matchRule4: 'Bei Streitigkeiten wenden Sie sich über das Streitbeilegungssystem an das Personal',
      
      rewards: 'Belohnungen',
      rewardsTitle: 'Saisonendbelohnungen',
      rewardsDesc: 'Die besten Teams jeder Rangliste erhalten exklusive Belohnungen:',
      reward1: '1. Platz: Exklusiver Gold-Pokal + 150 Pkt. im Top-Squad',
      reward2: '2. Platz: Exklusiver Silber-Pokal + 100 Pkt. im Top-Squad',
      reward3: '3. Platz: Exklusiver Bronze-Pokal + 75 Pkt. im Top-Squad',
      
      tips: 'Tipps',
      tipsTitle: 'Erfolgstipps',
      tip1: 'Kommunizieren Sie mit Ihrem Team und entwickeln Sie Strategien',
      tip2: 'Studieren Sie die erlaubten Karten und Spielmodi',
      tip3: 'Organisieren Sie regelmäßige Trainingssitzungen',
      tip4: 'Respektieren Sie die Regeln und Fairplay',
      tip5: 'Nutzen Sie das Streitbeilegungssystem bei Problemen',
      
      faq: 'FAQ',
      faqQuestion1: 'Kann ich in mehreren Squads sein?',
      faqAnswer1: 'Nein, Sie können nur Mitglied eines Squads gleichzeitig sein.',
      faqQuestion2: 'Was passiert, wenn ich mein Squad verlasse?',
      faqAnswer2: 'Wenn Sie Ihr Squad verlassen, verlieren Sie den Zugang zu Ranglisten, bis Sie einem neuen Squad beitreten.',
      faqQuestion3: 'Kann ich mich für beide Ranglisten registrieren?',
      faqAnswer3: 'Ja, Ihr Squad kann sich gleichzeitig für Chill und Compétitif registrieren.',
      faqQuestion4: 'Wie werden Streitigkeiten gelöst?',
      faqAnswer4: 'Streitigkeiten werden vom Personal überprüft, das die von beiden Teams bereitgestellten Beweise analysiert.',
      
      backToRankings: 'Zurück zu den Ranglisten',
    },
    it: {
      back: 'Indietro',
      title: 'Informazioni sulle Classifiche',
      subtitle: 'Tutto quello che devi sapere sul sistema di classificazione',
      
      howItWorks: 'Come Funziona',
      howItWorksDesc: 'Il sistema di classificazione NoMercy permette alle squadre di competere in diversi formati competitivi e salire nelle classifiche per dimostrare il loro valore.',
      
      ladderTypes: 'Tipi di Classifiche',
      duoTrio: 'Chill',
      duoTrioDesc: 'Formato competitivo in 2v2, 3v3 o 4v4',
      duoTrioTime: 'Aperto dalle 00:00 alle 20:00 (ora francese)',
      squadTeam: 'Compétitif',
      squadTeamDesc: 'Formato competitivo in 5v5',
      squadTeamTime: 'Disponibile 24/7',
      
      pointsSystem: 'Sistema di Punti',
      pointsSystemDesc: 'Ogni vittoria o sconfitta influisce sulla tua classifica secondo un sistema di punti dinamico.',
      victoryPoints: 'Vittoria',
      victoryPointsDesc: '+25 punti per vittoria',
      defeatPoints: 'Sconfitta',
      defeatPointsDesc: '-15 punti per sconfitta (minimo 0)',
      rankingCalc: 'Calcolo Classifica',
      rankingCalcDesc: 'Le squadre sono classificate per punti totali, poi per rapporto vittorie/sconfitte in caso di parità.',
      
      registration: 'Registrazione',
      registrationTitle: 'Come Registrarsi',
      registrationDesc: 'Per partecipare alle classifiche, devi:',
      registrationStep1: 'Avere una squadra attiva',
      registrationStep2: 'Cliccare su "Iscriviti alla classifica" nella scala desiderata',
      registrationStep3: 'Organizzare partite tramite il foglio partita',
      registrationStep4: 'Salire nelle classifiche!',
      
      unregistration: 'Cancellazione',
      unregistrationTitle: 'Cancellare dalla Classifica',
      unregistrationDesc: 'Puoi cancellarti in qualsiasi momento, ma attenzione:',
      unregistrationWarning: 'Tutte le tue statistiche per questa classifica andranno perse definitivamente (punti, vittorie, sconfitte).',
      
      matchRules: 'Regole delle Partite',
      matchRulesTitle: 'Organizzazione delle Partite',
      matchRulesDesc: 'Le partite seguono regole rigide:',
      matchRule1: 'Utilizzare il foglio partita ufficiale per organizzare le partite',
      matchRule2: 'Entrambe le squadre devono essere registrate nella stessa classifica',
      matchRule3: 'Le prove (screenshot) sono obbligatorie',
      matchRule4: 'In caso di controversia, contattare lo staff tramite il sistema di controversie',
      
      rewards: 'Ricompense',
      rewardsTitle: 'Ricompense di Fine Stagione',
      rewardsDesc: 'Le migliori squadre di ogni classifica riceveranno ricompense esclusive:',
      reward1: '1° posto: Trofeo esclusivo Oro + 150 punti nel top squadra',
      reward2: '2° posto: Trofeo esclusivo Argento + 100 punti nel top squadra',
      reward3: '3° posto: Trofeo esclusivo Bronzo + 75 punti nel top squadra',
      
      tips: 'Consigli',
      tipsTitle: 'Consigli per il Successo',
      tip1: 'Comunicare con la squadra e sviluppare strategie',
      tip2: 'Studiare le mappe e le modalità di gioco consentite',
      tip3: 'Organizzare sessioni di allenamento regolari',
      tip4: 'Rispettare le regole e il fair play',
      tip5: 'Utilizzare il sistema di controversie in caso di problemi',
      
      faq: 'FAQ',
      faqQuestion1: 'Posso essere in più squadre?',
      faqAnswer1: 'No, puoi essere membro di una sola squadra alla volta.',
      faqQuestion2: 'Cosa succede se lascio la mia squadra?',
      faqAnswer2: 'Se lasci la tua squadra, perdi l\'accesso alle classifiche fino a quando non ti unisci a una nuova squadra.',
      faqQuestion3: 'Posso iscrivermi a entrambe le classifiche?',
      faqAnswer3: 'Sì, la tua squadra può iscriversi sia a Chill che a Compétitif contemporaneamente.',
      faqQuestion4: 'Come vengono risolte le controversie?',
      faqAnswer4: 'Le controversie sono esaminate dallo staff che analizzerà le prove fornite da entrambe le squadre.',
      
      backToRankings: 'Torna alle Classifiche',
    },
  };

  const t = texts[language] || texts.en;

  // Set page title
  useEffect(() => {
    const titles = {
      fr: 'NoMercy - Informations Classements',
      en: 'NoMercy - Rankings Information',
      it: 'NoMercy - Informazioni Classifiche',
      de: 'NoMercy - Ranglisten-Informationen',
    };
    document.title = titles[language] || titles.en;
  }, [language]);

  return (
    <div className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-20"></div>
      {isHardcore ? (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 30% 0%, rgba(239, 68, 68, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 100%, rgba(249, 115, 22, 0.05) 0%, transparent 50%)' }}></div>
      ) : (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 30% 0%, rgba(6, 182, 212, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 100%, rgba(59, 130, 246, 0.05) 0%, transparent 50%)' }}></div>
      )}

      <div className="relative z-10 py-6 sm:py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            {t.back}
          </button>

          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-lg ${colors.glow}`}>
                <Info className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white">{t.title}</h1>
                <p className="text-gray-400 mt-1">{t.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Content Sections */}
          <div className="space-y-6">
            
            {/* How It Works */}
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${colors.border} p-6`}>
              <div className="flex items-center gap-3 mb-4">
                <Trophy className={`w-6 h-6 ${colors.text}`} />
                <h2 className="text-2xl font-bold text-white">{t.howItWorks}</h2>
              </div>
              <p className="text-gray-300 leading-relaxed">{t.howItWorksDesc}</p>
            </div>

            {/* Ladder Types */}
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${colors.border} p-6`}>
              <div className="flex items-center gap-3 mb-6">
                <Users className={`w-6 h-6 ${colors.text}`} />
                <h2 className="text-2xl font-bold text-white">{t.ladderTypes}</h2>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                {/* Chill Card */}
                <div className="bg-dark-800/50 rounded-xl p-5 border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-bold text-white">{t.duoTrio}</h3>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">{t.duoTrioDesc}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className={`w-4 h-4 ${
                      config?.ladderSettings?.duoTrioTimeRestriction?.enabled === false 
                        ? 'text-green-400' 
                        : 'text-orange-400'
                    }`} />
                    <span className="text-gray-300">
                      {config?.ladderSettings?.duoTrioTimeRestriction?.enabled === false
                        ? (language === 'fr' ? 'Disponible 24h/24, 7j/7' : 'Available 24/7')
                        : t.duoTrioTime
                      }
                    </span>
                  </div>
                </div>

                {/* Compétitif Card */}
                <div className="bg-dark-800/50 rounded-xl p-5 border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-bold text-white">{t.squadTeam}</h3>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">{t.squadTeamDesc}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-green-400" />
                    <span className="text-gray-300">{t.squadTeamTime}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Points System */}
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${colors.border} p-6`}>
              <div className="flex items-center gap-3 mb-6">
                <Target className={`w-6 h-6 ${colors.text}`} />
                <h2 className="text-2xl font-bold text-white">{t.pointsSystem}</h2>
              </div>
              <p className="text-gray-300 leading-relaxed mb-6">{t.pointsSystemDesc}</p>
              
              {loadingConfig ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className={`w-8 h-8 animate-spin ${colors.text}`} />
                </div>
              ) : (config?.squadMatchRewardsChill || config?.squadMatchRewardsCompetitive) ? (
                <div className="space-y-6">
                  {/* Ladder Chill Rewards */}
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-400" />
                      🎮 {language === 'fr' ? 'Ladder Chill' : 'Chill Ladder'}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
                        <Trophy className="w-5 h-5 text-green-400 mx-auto mb-1" />
                        <p className="text-green-400 font-bold text-lg">+{config.squadMatchRewardsChill?.ladderPointsWin || 15}</p>
                        <p className="text-gray-400 text-xs">{language === 'fr' ? 'Points Victoire' : 'Win Points'}</p>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
                        <Target className="w-5 h-5 text-red-400 mx-auto mb-1" />
                        <p className="text-red-400 font-bold text-lg">-{config.squadMatchRewardsChill?.ladderPointsLoss || 8}</p>
                        <p className="text-gray-400 text-xs">{language === 'fr' ? 'Points Défaite' : 'Loss Points'}</p>
                      </div>
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center">
                        <Coins className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                        <p className="text-yellow-400 font-bold text-lg">+{config.squadMatchRewardsChill?.playerCoinsWin || 40}</p>
                        <p className="text-gray-400 text-xs">{language === 'fr' ? 'Gold Victoire' : 'Win Gold'}</p>
                      </div>
                      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3 text-center">
                        <Zap className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                        <p className="text-cyan-400 font-bold text-lg">{config.squadMatchRewardsChill?.playerXPWinMin || 350}-{config.squadMatchRewardsChill?.playerXPWinMax || 450}</p>
                        <p className="text-gray-400 text-xs">XP {language === 'fr' ? 'Victoire' : 'Win'}</p>
                      </div>
                    </div>
                    {/* Additional info for Chill */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-dark-800/50 rounded-lg p-2 text-center">
                        <span className="text-gray-500">{language === 'fr' ? 'Points Général' : 'General Points'}: </span>
                        <span className="text-green-400">+{config.squadMatchRewardsChill?.generalSquadPointsWin || 10}</span>
                        <span className="text-gray-600 mx-1">/</span>
                        <span className="text-red-400">-{config.squadMatchRewardsChill?.generalSquadPointsLoss || 5}</span>
                      </div>
                      <div className="bg-dark-800/50 rounded-lg p-2 text-center">
                        <span className="text-gray-500">{language === 'fr' ? 'Gold Défaite' : 'Loss Gold'}: </span>
                        <span className="text-orange-400">+{config.squadMatchRewardsChill?.playerCoinsLoss || 20}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ladder Compétitif Rewards */}
                  <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-5">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-orange-400" />
                      🔥 {language === 'fr' ? 'Ladder Compétitif' : 'Competitive Ladder'}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
                        <Trophy className="w-5 h-5 text-green-400 mx-auto mb-1" />
                        <p className="text-green-400 font-bold text-lg">+{config.squadMatchRewardsCompetitive?.ladderPointsWin || 25}</p>
                        <p className="text-gray-400 text-xs">{language === 'fr' ? 'Points Victoire' : 'Win Points'}</p>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
                        <Target className="w-5 h-5 text-red-400 mx-auto mb-1" />
                        <p className="text-red-400 font-bold text-lg">-{config.squadMatchRewardsCompetitive?.ladderPointsLoss || 12}</p>
                        <p className="text-gray-400 text-xs">{language === 'fr' ? 'Points Défaite' : 'Loss Points'}</p>
                      </div>
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center">
                        <Coins className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                        <p className="text-yellow-400 font-bold text-lg">+{config.squadMatchRewardsCompetitive?.playerCoinsWin || 60}</p>
                        <p className="text-gray-400 text-xs">{language === 'fr' ? 'Gold Victoire' : 'Win Gold'}</p>
                      </div>
                      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3 text-center">
                        <Zap className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                        <p className="text-cyan-400 font-bold text-lg">{config.squadMatchRewardsCompetitive?.playerXPWinMin || 550}-{config.squadMatchRewardsCompetitive?.playerXPWinMax || 650}</p>
                        <p className="text-gray-400 text-xs">XP {language === 'fr' ? 'Victoire' : 'Win'}</p>
                      </div>
                    </div>
                    {/* Additional info for Competitive */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-dark-800/50 rounded-lg p-2 text-center">
                        <span className="text-gray-500">{language === 'fr' ? 'Points Général' : 'General Points'}: </span>
                        <span className="text-green-400">+{config.squadMatchRewardsCompetitive?.generalSquadPointsWin || 20}</span>
                        <span className="text-gray-600 mx-1">/</span>
                        <span className="text-red-400">-{config.squadMatchRewardsCompetitive?.generalSquadPointsLoss || 10}</span>
                      </div>
                      <div className="bg-dark-800/50 rounded-lg p-2 text-center">
                        <span className="text-gray-500">{language === 'fr' ? 'Gold Défaite' : 'Loss Gold'}: </span>
                        <span className="text-orange-400">+{config.squadMatchRewardsCompetitive?.playerCoinsLoss || 30}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`${colors.bg} border ${colors.border} rounded-xl p-4`}>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className={`w-5 h-5 ${colors.text}`} />
                      <h3 className="font-bold text-white">{t.rankingCalc}</h3>
                    </div>
                    <p className={`${colors.text} text-sm`}>{t.rankingCalcDesc}</p>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <h3 className="font-bold text-white">{t.victoryPoints}</h3>
                    </div>
                    <p className="text-green-400 text-sm">{t.victoryPointsDesc}</p>
                  </div>

                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <h3 className="font-bold text-white">{t.defeatPoints}</h3>
                    </div>
                    <p className="text-red-400 text-sm">{t.defeatPointsDesc}</p>
                  </div>

                  <div className={`${colors.bg} border ${colors.border} rounded-xl p-4`}>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className={`w-5 h-5 ${colors.text}`} />
                      <h3 className="font-bold text-white">{t.rankingCalc}</h3>
                    </div>
                    <p className={`${colors.text} text-sm`}>{t.rankingCalcDesc}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Registration */}
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${colors.border} p-6`}>
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle className={`w-6 h-6 ${colors.text}`} />
                <h2 className="text-2xl font-bold text-white">{t.registrationTitle}</h2>
              </div>
              <p className="text-gray-300 mb-4">{t.registrationDesc}</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${colors.gradient} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <span className="text-white text-xs font-bold">1</span>
                  </div>
                  <p className="text-gray-300">{t.registrationStep1}</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${colors.gradient} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <span className="text-white text-xs font-bold">2</span>
                  </div>
                  <p className="text-gray-300">{t.registrationStep2}</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${colors.gradient} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <span className="text-white text-xs font-bold">3</span>
                  </div>
                  <p className="text-gray-300">{t.registrationStep3}</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${colors.gradient} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <span className="text-white text-xs font-bold">4</span>
                  </div>
                  <p className="text-gray-300">{t.registrationStep4}</p>
                </div>
              </div>
            </div>

            {/* Unregistration Warning */}
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
                <h2 className="text-2xl font-bold text-white">{t.unregistrationTitle}</h2>
              </div>
              <p className="text-gray-300 mb-3">{t.unregistrationDesc}</p>
              <div className="bg-orange-500/20 border border-orange-500/40 rounded-lg p-4">
                <p className="text-orange-300 text-sm font-medium">{t.unregistrationWarning}</p>
              </div>
            </div>

            {/* Match Rules */}
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${colors.border} p-6`}>
              <div className="flex items-center gap-3 mb-6">
                <Shield className={`w-6 h-6 ${colors.text}`} />
                <h2 className="text-2xl font-bold text-white">{t.matchRulesTitle}</h2>
              </div>
              <p className="text-gray-300 mb-4">{t.matchRulesDesc}</p>
              <div className="space-y-2">
                {[t.matchRule1, t.matchRule2, t.matchRule3, t.matchRule4].map((rule, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-dark-800/50 rounded-lg">
                    <CheckCircle className={`w-5 h-5 ${colors.text} flex-shrink-0 mt-0.5`} />
                    <p className="text-gray-300 text-sm">{rule}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Rewards */}
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${colors.border} p-6`}>
              <div className="flex items-center gap-3 mb-6">
                <Award className={`w-6 h-6 ${colors.text}`} />
                <h2 className="text-2xl font-bold text-white">{t.rewardsTitle}</h2>
              </div>
              <p className="text-gray-300 mb-6">{t.rewardsDesc}</p>
              <div className="space-y-3">
                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl">
                  <div className="relative">
                    <Crown className="w-8 h-8 text-yellow-400" />
                    <Trophy className="w-4 h-4 text-yellow-300 absolute -bottom-1 -right-1" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{t.reward1}</p>
                    <p className="text-yellow-400/70 text-xs">{language === 'fr' ? 'Trophée légendaire' : 'Legendary trophy'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-300/20 to-gray-400/20 border border-gray-300/30 rounded-xl">
                  <div className="relative">
                    <Award className="w-7 h-7 text-gray-300" />
                    <Trophy className="w-4 h-4 text-gray-200 absolute -bottom-1 -right-1" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{t.reward2}</p>
                    <p className="text-gray-400/70 text-xs">{language === 'fr' ? 'Trophée épique' : 'Epic trophy'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-orange-600/20 to-orange-700/20 border border-orange-600/30 rounded-xl">
                  <div className="relative">
                    <Award className="w-6 h-6 text-orange-400" />
                    <Trophy className="w-4 h-4 text-orange-300 absolute -bottom-1 -right-1" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{t.reward3}</p>
                    <p className="text-orange-400/70 text-xs">{language === 'fr' ? 'Trophée rare' : 'Rare trophy'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${colors.border} p-6`}>
              <div className="flex items-center gap-3 mb-6">
                <Zap className={`w-6 h-6 ${colors.text}`} />
                <h2 className="text-2xl font-bold text-white">{t.tipsTitle}</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {[t.tip1, t.tip2, t.tip3, t.tip4, t.tip5].map((tip, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-dark-800/50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-gray-300 text-sm">{tip}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ */}
            <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${colors.border} p-6`}>
              <div className="flex items-center gap-3 mb-6">
                <Info className={`w-6 h-6 ${colors.text}`} />
                <h2 className="text-2xl font-bold text-white">{t.faq}</h2>
              </div>
              <div className="space-y-4">
                {[
                  { q: t.faqQuestion1, a: t.faqAnswer1 },
                  { q: t.faqQuestion2, a: t.faqAnswer2 },
                  { q: t.faqQuestion3, a: t.faqAnswer3 },
                  { q: t.faqQuestion4, a: t.faqAnswer4 },
                ].map((faq, index) => (
                  <div key={index} className="p-4 bg-dark-800/50 rounded-xl border border-white/10">
                    <h3 className="text-white font-semibold mb-2">{faq.q}</h3>
                    <p className="text-gray-400 text-sm">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Back to Rankings Button */}
          <div className="mt-10">
            <Link
              to={`/${selectedMode}/rankings`}
              className={`inline-flex items-center gap-3 px-6 py-4 bg-gradient-to-r ${colors.gradient} rounded-xl text-white font-bold hover:opacity-90 transition-opacity shadow-lg ${colors.glow}`}
            >
              <Trophy className="w-5 h-5" />
              {t.backToRankings}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RankingsInfo;





