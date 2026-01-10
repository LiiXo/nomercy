import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { ArrowLeft, Shield } from 'lucide-react';

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';

  const content = {
    fr: {
      title: 'Politique de confidentialité',
      lastUpdated: 'Dernière mise à jour',
      sections: [
        {
          title: '1. Collecte d\'informations',
          content: 'NoMercy collecte les informations suivantes : nom d\'utilisateur Discord, avatar Discord, email Discord (optionnel), nom d\'utilisateur personnalisé, bio, plateforme de jeu, Activision ID, et statistiques de jeu.'
        },
        {
          title: '2. Utilisation des informations',
          content: 'Nous utilisons vos informations pour : gérer votre compte, afficher les classements, organiser les matchs, personnaliser votre expérience, et améliorer nos services.'
        },
        {
          title: '3. Partage des informations',
          content: 'Nous ne vendons pas vos informations personnelles. Nous partageons uniquement les informations nécessaires avec GGSecure Anti-Cheat pour la vérification de l\'intégrité des joueurs PC.'
        },
        {
          title: '4. Cookies et stockage',
          content: 'Nous utilisons des cookies HTTP-only pour maintenir votre session. Ces cookies sont sécurisés et ne peuvent pas être accédés par JavaScript côté client.'
        },
        {
          title: '5. Sécurité des données',
          content: 'Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos informations contre tout accès non autorisé, altération, divulgation ou destruction.'
        },
        {
          title: '6. Vos droits',
          content: 'Vous avez le droit d\'accéder, de modifier ou de supprimer vos informations personnelles à tout moment via votre profil. Vous pouvez également demander la suppression de votre compte.'
        },
        {
          title: '7. Données de tiers',
          content: 'Nous utilisons Discord OAuth pour l\'authentification. Discord peut collecter certaines informations conformément à sa propre politique de confidentialité.'
        },
        {
          title: '8. Modifications',
          content: 'Nous nous réservons le droit de modifier cette politique de confidentialité. Les utilisateurs seront informés des modifications importantes.'
        }
      ]
    },
    en: {
      title: 'Privacy Policy',
      lastUpdated: 'Last updated',
      sections: [
        {
          title: '1. Information Collection',
          content: 'NoMercy collects the following information: Discord username, Discord avatar, Discord email (optional), custom username, bio, gaming platform, Activision ID, and game statistics.'
        },
        {
          title: '2. Information Use',
          content: 'We use your information to: manage your account, display rankings, organize matches, personalize your experience, and improve our services.'
        },
        {
          title: '3. Information Sharing',
          content: 'We do not sell your personal information. We only share necessary information with GGSecure Anti-Cheat for PC player integrity verification.'
        },
        {
          title: '4. Cookies and Storage',
          content: 'We use HTTP-only cookies to maintain your session. These cookies are secure and cannot be accessed by client-side JavaScript.'
        },
        {
          title: '5. Data Security',
          content: 'We implement appropriate security measures to protect your information against unauthorized access, alteration, disclosure, or destruction.'
        },
        {
          title: '6. Your Rights',
          content: 'You have the right to access, modify, or delete your personal information at any time through your profile. You can also request account deletion.'
        },
        {
          title: '7. Third-Party Data',
          content: 'We use Discord OAuth for authentication. Discord may collect certain information in accordance with its own privacy policy.'
        },
        {
          title: '8. Modifications',
          content: 'We reserve the right to modify this privacy policy. Users will be informed of significant changes.'
        }
      ]
    },
    de: {
      title: 'Datenschutzrichtlinie',
      lastUpdated: 'Zuletzt aktualisiert',
      sections: [
        {
          title: '1. Informationssammlung',
          content: 'NoMercy sammelt folgende Informationen: Discord-Benutzername, Discord-Avatar, Discord-E-Mail (optional), benutzerdefinierter Benutzername, Bio, Spieleplattform, Activision-ID und Spielstatistiken.'
        },
        {
          title: '2. Informationsnutzung',
          content: 'Wir verwenden Ihre Informationen, um: Ihr Konto zu verwalten, Ranglisten anzuzeigen, Matches zu organisieren, Ihre Erfahrung zu personalisieren und unsere Dienste zu verbessern.'
        },
        {
          title: '3. Informationsweitergabe',
          content: 'Wir verkaufen Ihre persönlichen Informationen nicht. Wir teilen nur notwendige Informationen mit GGSecure Anti-Cheat zur Integritätsprüfung von PC-Spielern.'
        },
        {
          title: '4. Cookies und Speicherung',
          content: 'Wir verwenden HTTP-only-Cookies, um Ihre Sitzung aufrechtzuerhalten. Diese Cookies sind sicher und können nicht von clientseitigem JavaScript aufgerufen werden.'
        },
        {
          title: '5. Datensicherheit',
          content: 'Wir setzen angemessene Sicherheitsmaßnahmen um, um Ihre Informationen vor unbefugtem Zugriff, Änderung, Offenlegung oder Zerstörung zu schützen.'
        },
        {
          title: '6. Ihre Rechte',
          content: 'Sie haben das Recht, jederzeit über Ihr Profil auf Ihre persönlichen Informationen zuzugreifen, sie zu ändern oder zu löschen. Sie können auch die Löschung Ihres Kontos beantragen.'
        },
        {
          title: '7. Daten von Dritten',
          content: 'Wir verwenden Discord OAuth zur Authentifizierung. Discord kann bestimmte Informationen gemäß seiner eigenen Datenschutzrichtlinie sammeln.'
        },
        {
          title: '8. Änderungen',
          content: 'Wir behalten uns das Recht vor, diese Datenschutzrichtlinie zu ändern. Benutzer werden über wichtige Änderungen informiert.'
        }
      ]
    },
    it: {
      title: 'Politica sulla Privacy',
      lastUpdated: 'Ultimo aggiornamento',
      sections: [
        {
          title: '1. Raccolta di Informazioni',
          content: 'NoMercy raccoglie le seguenti informazioni: nome utente Discord, avatar Discord, email Discord (opzionale), nome utente personalizzato, bio, piattaforma di gioco, ID Activision e statistiche di gioco.'
        },
        {
          title: '2. Utilizzo delle Informazioni',
          content: 'Utilizziamo le tue informazioni per: gestire il tuo account, visualizzare le classifiche, organizzare le partite, personalizzare la tua esperienza e migliorare i nostri servizi.'
        },
        {
          title: '3. Condivisione delle Informazioni',
          content: 'Non vendiamo le tue informazioni personali. Condividiamo solo le informazioni necessarie con GGSecure Anti-Cheat per la verifica dell\'integrità dei giocatori PC.'
        },
        {
          title: '4. Cookie e Archiviazione',
          content: 'Utilizziamo cookie HTTP-only per mantenere la tua sessione. Questi cookie sono sicuri e non possono essere accessibili da JavaScript lato client.'
        },
        {
          title: '5. Sicurezza dei Dati',
          content: 'Implementiamo misure di sicurezza appropriate per proteggere le tue informazioni da accesso non autorizzato, alterazione, divulgazione o distruzione.'
        },
        {
          title: '6. I Tuoi Diritti',
          content: 'Hai il diritto di accedere, modificare o eliminare le tue informazioni personali in qualsiasi momento tramite il tuo profilo. Puoi anche richiedere l\'eliminazione del tuo account.'
        },
        {
          title: '7. Dati di Terze Parti',
          content: 'Utilizziamo Discord OAuth per l\'autenticazione. Discord può raccogliere determinate informazioni in conformità con la propria politica sulla privacy.'
        },
        {
          title: '8. Modifiche',
          content: 'Ci riserviamo il diritto di modificare questa politica sulla privacy. Gli utenti saranno informati delle modifiche significative.'
        }
      ]
    }
  };

  const t = content[language] || content.en;

  return (
    <div className="min-h-screen bg-dark-950 relative">
      <div className="absolute inset-0 bg-mesh pointer-events-none"></div>
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-30"></div>
      
      <div className="relative z-10 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <button 
            onClick={() => navigate(-1)}
            className={`mb-6 flex items-center space-x-2 text-gray-400 hover:text-${accentColor}-400 transition-colors group`}
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>{language === 'fr' ? 'Retour' : language === 'de' ? 'Zurück' : language === 'it' ? 'Indietro' : 'Back'}</span>
          </button>

          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 p-8`}>
            <div className="flex items-center gap-3 mb-6">
              <Shield className={`w-8 h-8 text-${accentColor}-400`} />
              <h1 className="text-3xl font-bold text-white">{t.title}</h1>
            </div>

            <p className="text-gray-400 text-sm mb-8">
              {t.lastUpdated}: {new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US')}
            </p>

            <div className="space-y-6">
              {t.sections.map((section, index) => (
                <div key={index} className="border-b border-white/5 pb-6 last:border-b-0">
                  <h2 className={`text-xl font-bold text-${accentColor}-400 mb-3`}>
                    {section.title}
                  </h2>
                  <p className="text-gray-300 leading-relaxed">
                    {section.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

































