import React, { useEffect, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { ScrollText, Shield, Users, AlertTriangle, Trophy, Ban, MessageCircle, Clock, Gamepad2, ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_URL = 'https://api-nomercy.ggsecure.io/api';

const Rules = () => {
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const [rulesFromDB, setRulesFromDB] = useState(null);
  const [loading, setLoading] = useState(true);

  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-500';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-blue-600';
  const borderColor = isHardcore ? 'border-red-500/20' : 'border-cyan-500/20';
  const textAccent = isHardcore ? 'text-red-400' : 'text-cyan-400';
  const bgAccent = isHardcore ? 'bg-red-500/10' : 'bg-cyan-500/10';

  const getText = (key) => {
    const texts = {
      pageTitle: {
        fr: 'Règlement',
        en: 'Rules',
        it: 'Regolamento',
        de: 'Regeln',
      },
      pageSubtitle: {
        fr: 'Règles officielles de la plateforme NoMercy',
        en: 'Official rules of the NoMercy platform',
        it: 'Regole ufficiali della piattaforma NoMercy',
        de: 'Offizielle Regeln der NoMercy-Plattform',
      },
      back: {
        fr: 'Retour',
        en: 'Back',
        it: 'Indietro',
        de: 'Zurück',
      },
      generalRules: {
        fr: 'Règles générales',
        en: 'General Rules',
        it: 'Regole generali',
        de: 'Allgemeine Regeln',
      },
      generalRule1: {
        fr: 'Respectez tous les joueurs. Les insultes, le harcèlement et les comportements toxiques sont strictement interdits.',
        en: 'Respect all players. Insults, harassment and toxic behavior are strictly prohibited.',
        it: 'Rispetta tutti i giocatori. Insulti, molestie e comportamenti tossici sono severamente vietati.',
        de: 'Respektiere alle Spieler. Beleidigungen, Belästigungen und toxisches Verhalten sind streng verboten.',
      },
      generalRule2: {
        fr: 'Tout compte est personnel et ne peut être partagé. Un seul compte par personne est autorisé.',
        en: 'Every account is personal and cannot be shared. Only one account per person is allowed.',
        it: 'Ogni account è personale e non può essere condiviso. È consentito un solo account per persona.',
        de: 'Jedes Konto ist persönlich und kann nicht geteilt werden. Pro Person ist nur ein Konto erlaubt.',
      },
      generalRule3: {
        fr: 'Les pseudonymes offensants, discriminatoires ou inappropriés sont interdits.',
        en: 'Offensive, discriminatory or inappropriate nicknames are prohibited.',
        it: 'Soprannomi offensivi, discriminatori o inappropriati sono vietati.',
        de: 'Beleidigende, diskriminierende oder unangemessene Spitznamen sind verboten.',
      },
      matchRules: {
        fr: 'Règles de match',
        en: 'Match Rules',
        it: 'Regole di partita',
        de: 'Match-Regeln',
      },
      matchRule1: {
        fr: 'Les joueurs doivent être présents et prêts à jouer dans les 5 minutes suivant l\'heure prévue du match.',
        en: 'Players must be present and ready to play within 5 minutes of the scheduled match time.',
        it: 'I giocatori devono essere presenti e pronti a giocare entro 5 minuti dall\'orario previsto della partita.',
        de: 'Die Spieler müssen innerhalb von 5 Minuten nach der geplanten Spielzeit anwesend und spielbereit sein.',
      },
      matchRule2: {
        fr: 'En cas de déconnexion, le match peut être repris si les deux équipes sont d\'accord. Sinon, le score actuel est maintenu.',
        en: 'In case of disconnection, the match can be resumed if both teams agree. Otherwise, the current score is maintained.',
        it: 'In caso di disconnessione, la partita può essere ripresa se entrambe le squadre sono d\'accordo. Altrimenti, il punteggio attuale viene mantenuto.',
        de: 'Bei einer Trennung kann das Spiel fortgesetzt werden, wenn beide Teams zustimmen. Andernfalls wird der aktuelle Punktestand beibehalten.',
      },
      matchRule3: {
        fr: 'Les résultats doivent être signalés immédiatement après le match. Des preuves (screenshots, clips) peuvent être demandées.',
        en: 'Results must be reported immediately after the match. Evidence (screenshots, clips) may be requested.',
        it: 'I risultati devono essere segnalati immediatamente dopo la partita. Prove (screenshot, clip) possono essere richieste.',
        de: 'Ergebnisse müssen sofort nach dem Spiel gemeldet werden. Beweise (Screenshots, Clips) können angefordert werden.',
      },
      matchRule4: {
        fr: 'En cas de litige, contactez immédiatement le staff via Discord. Ne quittez pas le lobby avant résolution.',
        en: 'In case of dispute, contact staff immediately via Discord. Do not leave the lobby until resolved.',
        it: 'In caso di controversia, contatta immediatamente lo staff tramite Discord. Non abbandonare la lobby fino alla risoluzione.',
        de: 'Im Falle eines Streits wenden Sie sich sofort über Discord an das Personal. Verlassen Sie die Lobby nicht, bis das Problem gelöst ist.',
      },
      squadRules: {
        fr: 'Règles d\'escouade',
        en: 'Squad Rules',
        it: 'Regole della squadra',
        de: 'Squad-Regeln',
      },
      squadRule1: {
        fr: 'Une escouade doit avoir un minimum de 2 joueurs et un maximum de 6 joueurs.',
        en: 'A squad must have a minimum of 2 players and a maximum of 6 players.',
        it: 'Una squadra deve avere un minimo di 2 giocatori e un massimo di 6 giocatori.',
        de: 'Ein Squad muss mindestens 2 Spieler und maximal 6 Spieler haben.',
      },
      squadRule2: {
        fr: 'Le capitaine est responsable de son équipe et de l\'inscription aux matchs.',
        en: 'The captain is responsible for their team and match registration.',
        it: 'Il capitano è responsabile della sua squadra e dell\'iscrizione alle partite.',
        de: 'Der Kapitän ist für sein Team und die Spielanmeldung verantwortlich.',
      },
      squadRule3: {
        fr: 'Un joueur ne peut faire partie que d\'une seule escouade active à la fois.',
        en: 'A player can only be part of one active squad at a time.',
        it: 'Un giocatore può far parte di una sola squadra attiva alla volta.',
        de: 'Ein Spieler kann nur Teil eines aktiven Squads gleichzeitig sein.',
      },
      sanctions: {
        fr: 'Sanctions',
        en: 'Sanctions',
        it: 'Sanzioni',
        de: 'Sanktionen',
      },
      sanction1: {
        fr: 'Avertissement : Première infraction mineure',
        en: 'Warning: First minor offense',
        it: 'Avvertimento: Prima infrazione minore',
        de: 'Verwarnung: Erster geringfügiger Verstoß',
      },
      sanction2: {
        fr: 'Suspension temporaire : Infractions répétées ou comportement toxique',
        en: 'Temporary suspension: Repeated offenses or toxic behavior',
        it: 'Sospensione temporanea: Infrazioni ripetute o comportamento tossico',
        de: 'Vorübergehende Sperre: Wiederholte Verstöße oder toxisches Verhalten',
      },
      sanction3: {
        fr: 'Bannissement permanent : Triche, hacks ou infractions graves',
        en: 'Permanent ban: Cheating, hacks or serious offenses',
        it: 'Bando permanente: Cheating, hack o infrazioni gravi',
        de: 'Permanenter Bann: Cheating, Hacks oder schwere Verstöße',
      },
      cheatingTitle: {
        fr: 'Triche et fair-play',
        en: 'Cheating and Fair Play',
        it: 'Cheating e fair play',
        de: 'Cheating und Fair Play',
      },
      cheating1: {
        fr: 'Tout logiciel tiers modifiant le jeu (aimbot, wallhack, etc.) est strictement interdit.',
        en: 'Any third-party software modifying the game (aimbot, wallhack, etc.) is strictly prohibited.',
        it: 'Qualsiasi software di terze parti che modifica il gioco (aimbot, wallhack, ecc.) è severamente vietato.',
        de: 'Jegliche Drittanbieter-Software, die das Spiel modifiziert (Aimbot, Wallhack usw.), ist strengstens verboten.',
      },
      cheating2: {
        fr: 'L\'exploitation de bugs ou glitchs pour obtenir un avantage est interdite.',
        en: 'Exploiting bugs or glitches for an advantage is prohibited.',
        it: 'Lo sfruttamento di bug o glitch per ottenere un vantaggio è vietato.',
        de: 'Das Ausnutzen von Bugs oder Glitches für einen Vorteil ist verboten.',
      },
      cheating3: {
        fr: 'Tous les joueurs doivent utiliser notre système anti-cheat obligatoire.',
        en: 'All players must use our mandatory anti-cheat system.',
        it: 'Tutti i giocatori devono utilizzare il nostro sistema anti-cheat obbligatorio.',
        de: 'Alle Spieler müssen unser obligatorisches Anti-Cheat-System verwenden.',
      },
      lastUpdate: {
        fr: 'Dernière mise à jour : Décembre 2025',
        en: 'Last update: December 2025',
        it: 'Ultimo aggiornamento: Dicembre 2025',
        de: 'Letzte Aktualisierung: Dezember 2025',
      },
    };
    return texts[key]?.[language] || texts[key]?.en || key;
  };

  // Fetch rules from API
  useEffect(() => {
    const fetchRules = async () => {
      try {
        const response = await fetch(`${API_URL}/rules`);
        const data = await response.json();
        if (data.success && data.rules) {
          setRulesFromDB(data.rules);
        }
      } catch (err) {
        console.log('Using fallback rules');
      } finally {
        setLoading(false);
      }
    };
    fetchRules();
  }, []);

  useEffect(() => {
    document.title = `NoMercy - ${getText('pageTitle')}`;
  }, [language]);

  // Section configuration with icons and titles
  const sectionConfig = {
    generalRules: { icon: Shield, titleKey: 'generalRules' },
    matchRules: { icon: Gamepad2, titleKey: 'matchRules' },
    squadRules: { icon: Users, titleKey: 'squadRules' },
    sanctions: { icon: Ban, titleKey: 'sanctions' },
    cheating: { icon: AlertTriangle, titleKey: 'cheatingTitle' },
  };

  // Build sections from DB or fallback to local
  const sections = rulesFromDB ? 
    Object.entries(sectionConfig).map(([key, config]) => ({
      icon: config.icon,
      title: getText(config.titleKey),
      rules: (rulesFromDB[key] || []).map(rule => rule.content?.[language] || rule.content?.en || '')
    })).filter(s => s.rules.length > 0)
  : [
    {
      icon: Shield,
      title: getText('generalRules'),
      rules: [getText('generalRule1'), getText('generalRule2'), getText('generalRule3')],
    },
    {
      icon: Gamepad2,
      title: getText('matchRules'),
      rules: [getText('matchRule1'), getText('matchRule2'), getText('matchRule3'), getText('matchRule4')],
    },
    {
      icon: Users,
      title: getText('squadRules'),
      rules: [getText('squadRule1'), getText('squadRule2'), getText('squadRule3')],
    },
    {
      icon: AlertTriangle,
      title: getText('cheatingTitle'),
      rules: [getText('cheating1'), getText('cheating2'), getText('cheating3')],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <Loader2 className={`w-8 h-8 ${textAccent} animate-spin`} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 relative">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none" style={{ 
        background: isHardcore 
          ? 'radial-gradient(ellipse at 20% 20%, rgba(239, 68, 68, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(249, 115, 22, 0.05) 0%, transparent 50%)'
          : 'radial-gradient(ellipse at 20% 20%, rgba(34, 211, 238, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(59, 130, 246, 0.05) 0%, transparent 50%)'
      }}></div>
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-30"></div>

      <div className="relative z-10 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back button */}
          <Link 
            to={selectedMode ? `/${selectedMode}` : '/'}
            className={`inline-flex items-center space-x-2 ${textAccent} hover:underline mb-6`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{getText('back')}</span>
          </Link>

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className={`absolute inset-0 ${isHardcore ? 'bg-red-500/30' : 'bg-cyan-500/30'} blur-xl`}></div>
                <div className={`relative w-14 h-14 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-xl flex items-center justify-center shadow-lg ${isHardcore ? 'shadow-red-500/40' : 'shadow-cyan-500/40'}`}>
                  <ScrollText className="w-7 h-7 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">{getText('pageTitle')}</h1>
                <p className="text-gray-400 text-sm">{getText('pageSubtitle')}</p>
              </div>
            </div>
          </div>

          {/* Rules Sections */}
          <div className="space-y-6">
            {sections.map((section, sectionIndex) => {
              const Icon = section.icon;
              return (
                <div 
                  key={sectionIndex}
                  className={`bg-dark-900/80 backdrop-blur-xl rounded-xl border ${borderColor} overflow-hidden`}
                >
                  <div className={`px-6 py-4 border-b ${borderColor} ${bgAccent}`}>
                    <h2 className="font-bold text-white flex items-center space-x-3">
                      <Icon className={`w-5 h-5 ${textAccent}`} />
                      <span>{section.title}</span>
                    </h2>
                  </div>
                  <div className="p-6">
                    <ul className="space-y-4">
                      {section.rules.map((rule, ruleIndex) => (
                        <li key={ruleIndex} className="flex items-start space-x-3">
                          <span className={`w-6 h-6 rounded-full ${bgAccent} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                            <span className={`text-xs font-bold ${textAccent}`}>{ruleIndex + 1}</span>
                          </span>
                          <p className="text-gray-300 text-sm leading-relaxed">{rule}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-10 text-center text-gray-500 text-sm">
            <p>{getText('lastUpdate')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Rules;

