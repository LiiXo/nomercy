import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { ArrowLeft, FileText } from 'lucide-react';

const TermsOfService = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';

  const content = {
    fr: {
      title: 'Conditions d\'utilisation',
      lastUpdated: 'Dernière mise à jour',
      sections: [
        {
          title: '1. Acceptation des conditions',
          content: 'En accédant et en utilisant NoMercy, vous acceptez d\'être lié par ces conditions d\'utilisation. Si vous n\'acceptez pas ces conditions, veuillez ne pas utiliser notre plateforme.'
        },
        {
          title: '2. Description du service',
          content: 'NoMercy est une plateforme de compétition Call of Duty qui propose des modes Hardcore et CDL, des classements, des tournois et une boutique d\'objets virtuels.'
        },
        {
          title: '3. Compte utilisateur',
          content: 'Vous êtes responsable de maintenir la confidentialité de votre compte. Vous acceptez de ne pas partager vos identifiants avec des tiers. Toute activité sur votre compte est de votre responsabilité.'
        },
        {
          title: '4. Comportement des utilisateurs',
          content: 'Vous vous engagez à respecter les autres joueurs et à ne pas adopter de comportement toxique, insultant ou inapproprié. Tout comportement contraire peut entraîner des sanctions, y compris un bannissement permanent.'
        },
        {
          title: '5. Anti-triche',
          content: 'L\'utilisation de logiciels de triche, de mods non autorisés ou de toute forme de triche est strictement interdite. Les joueurs PC doivent utiliser GGSecure Anti-Cheat pour participer aux matchs.'
        },
        {
          title: '6. Propriété intellectuelle',
          content: 'Tous les contenus de NoMercy, y compris les logos, les textes, les graphismes et les fonctionnalités, sont la propriété de NoMercy et sont protégés par les lois sur la propriété intellectuelle.'
        },
        {
          title: '7. Limitation de responsabilité',
          content: 'NoMercy ne peut être tenu responsable des dommages directs ou indirects résultant de l\'utilisation ou de l\'impossibilité d\'utiliser la plateforme.'
        },
        {
          title: '8. Modifications des conditions',
          content: 'NoMercy se réserve le droit de modifier ces conditions à tout moment. Les utilisateurs seront informés des modifications importantes.'
        }
      ]
    },
    en: {
      title: 'Terms of Service',
      lastUpdated: 'Last updated',
      sections: [
        {
          title: '1. Acceptance of Terms',
          content: 'By accessing and using NoMercy, you agree to be bound by these terms of service. If you do not agree to these terms, please do not use our platform.'
        },
        {
          title: '2. Service Description',
          content: 'NoMercy is a Call of Duty competition platform offering Hardcore and CDL modes, rankings, tournaments, and a virtual item shop.'
        },
        {
          title: '3. User Account',
          content: 'You are responsible for maintaining the confidentiality of your account. You agree not to share your credentials with third parties. Any activity on your account is your responsibility.'
        },
        {
          title: '4. User Conduct',
          content: 'You agree to respect other players and not engage in toxic, insulting, or inappropriate behavior. Any contrary behavior may result in sanctions, including permanent ban.'
        },
        {
          title: '5. Anti-Cheat',
          content: 'The use of cheat software, unauthorized mods, or any form of cheating is strictly prohibited. PC players must use GGSecure Anti-Cheat to participate in matches.'
        },
        {
          title: '6. Intellectual Property',
          content: 'All NoMercy content, including logos, texts, graphics, and features, is the property of NoMercy and is protected by intellectual property laws.'
        },
        {
          title: '7. Limitation of Liability',
          content: 'NoMercy cannot be held liable for direct or indirect damages resulting from the use or inability to use the platform.'
        },
        {
          title: '8. Modification of Terms',
          content: 'NoMercy reserves the right to modify these terms at any time. Users will be informed of significant changes.'
        }
      ]
    },
    de: {
      title: 'Nutzungsbedingungen',
      lastUpdated: 'Zuletzt aktualisiert',
      sections: [
        {
          title: '1. Annahme der Bedingungen',
          content: 'Durch den Zugriff auf und die Nutzung von NoMercy stimmen Sie zu, an diese Nutzungsbedingungen gebunden zu sein. Wenn Sie diesen Bedingungen nicht zustimmen, verwenden Sie bitte unsere Plattform nicht.'
        },
        {
          title: '2. Dienstbeschreibung',
          content: 'NoMercy ist eine Call of Duty-Wettkampfplattform, die Hardcore- und CDL-Modi, Ranglisten, Turniere und einen virtuellen Artikel-Shop anbietet.'
        },
        {
          title: '3. Benutzerkonto',
          content: 'Sie sind dafür verantwortlich, die Vertraulichkeit Ihres Kontos zu wahren. Sie stimmen zu, Ihre Anmeldedaten nicht mit Dritten zu teilen. Jede Aktivität auf Ihrem Konto liegt in Ihrer Verantwortung.'
        },
        {
          title: '4. Benutzerverhalten',
          content: 'Sie verpflichten sich, andere Spieler zu respektieren und kein toxisches, beleidigendes oder unangemessenes Verhalten an den Tag zu legen. Jedes gegenteilige Verhalten kann zu Sanktionen führen, einschließlich einer dauerhaften Sperre.'
        },
        {
          title: '5. Anti-Cheat',
          content: 'Die Verwendung von Cheat-Software, nicht autorisierten Mods oder jeder Form von Betrug ist strengstens untersagt. PC-Spieler müssen GGSecure Anti-Cheat verwenden, um an Matches teilzunehmen.'
        },
        {
          title: '6. Geistiges Eigentum',
          content: 'Alle NoMercy-Inhalte, einschließlich Logos, Texte, Grafiken und Funktionen, sind Eigentum von NoMercy und durch Gesetze zum geistigen Eigentum geschützt.'
        },
        {
          title: '7. Haftungsbeschränkung',
          content: 'NoMercy kann nicht für direkte oder indirekte Schäden haftbar gemacht werden, die aus der Nutzung oder Unfähigkeit zur Nutzung der Plattform resultieren.'
        },
        {
          title: '8. Änderung der Bedingungen',
          content: 'NoMercy behält sich das Recht vor, diese Bedingungen jederzeit zu ändern. Benutzer werden über wichtige Änderungen informiert.'
        }
      ]
    },
    it: {
      title: 'Termini di Servizio',
      lastUpdated: 'Ultimo aggiornamento',
      sections: [
        {
          title: '1. Accettazione dei Termini',
          content: 'Accedendo e utilizzando NoMercy, accetti di essere vincolato da questi termini di servizio. Se non accetti questi termini, non utilizzare la nostra piattaforma.'
        },
        {
          title: '2. Descrizione del Servizio',
          content: 'NoMercy è una piattaforma di competizione Call of Duty che offre modalità Hardcore e CDL, classifiche, tornei e un negozio di oggetti virtuali.'
        },
        {
          title: '3. Account Utente',
          content: 'Sei responsabile di mantenere la riservatezza del tuo account. Accetti di non condividere le tue credenziali con terze parti. Qualsiasi attività sul tuo account è di tua responsabilità.'
        },
        {
          title: '4. Condotta dell\'Utente',
          content: 'Ti impegni a rispettare gli altri giocatori e a non adottare comportamenti tossici, offensivi o inappropriati. Qualsiasi comportamento contrario può comportare sanzioni, incluso un ban permanente.'
        },
        {
          title: '5. Anti-Cheat',
          content: 'L\'uso di software di cheat, mod non autorizzati o qualsiasi forma di cheating è severamente vietato. I giocatori PC devono utilizzare GGSecure Anti-Cheat per partecipare alle partite.'
        },
        {
          title: '6. Proprietà Intellettuale',
          content: 'Tutti i contenuti di NoMercy, inclusi loghi, testi, grafica e funzionalità, sono proprietà di NoMercy e sono protetti dalle leggi sulla proprietà intellettuale.'
        },
        {
          title: '7. Limitazione di Responsabilità',
          content: 'NoMercy non può essere ritenuta responsabile per danni diretti o indiretti derivanti dall\'uso o dall\'impossibilità di utilizzare la piattaforma.'
        },
        {
          title: '8. Modifica dei Termini',
          content: 'NoMercy si riserva il diritto di modificare questi termini in qualsiasi momento. Gli utenti saranno informati delle modifiche significative.'
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
              <FileText className={`w-8 h-8 text-${accentColor}-400`} />
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

export default TermsOfService;






















