import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { 
  ArrowLeft, Shield, FileText, AlertTriangle, Check, 
  Monitor, Cpu, HardDrive, Wifi, Search, Layers, Bug, 
  Camera, Zap, Eye, Lock, Cloud, Activity, Users, Brain
} from 'lucide-react';

const IrisTermsOfUse = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const isHardcore = selectedMode === 'hardcore';
  const accentColor = isHardcore ? 'red' : 'cyan';
  const gradientFrom = isHardcore ? 'from-red-500' : 'from-cyan-400';
  const gradientTo = isHardcore ? 'to-orange-600' : 'to-cyan-600';

  const content = {
    fr: {
      title: 'Conditions d\'utilisation d\'Iris',
      lastUpdated: 'Dernière mise à jour',
      back: 'Retour',
      intro: {
        title: 'À propos d\'Iris Anti-Cheat',
        content: 'Iris est la solution anticheat de nouvelle génération de NoMercy. En téléchargeant et en utilisant Iris, vous acceptez les conditions suivantes. Ces conditions sont conçues pour garantir un environnement de jeu équitable et sécurisé pour tous les joueurs.'
      },
      sections: [
        {
          icon: Cpu,
          title: '1. Identification matérielle (TPM 2.0)',
          content: 'Iris utilise le module TPM 2.0 de votre ordinateur pour créer un identifiant matériel unique. Cet identifiant permet de lier votre compte Discord à votre machine physique.',
          details: [
            'Présence et état du TPM (activé/désactivé)',
            'Version du TPM (2.0 requise)',
            'Fabricant du module TPM',
            'Génération d\'un identifiant matériel unique et crypté'
          ],
          purpose: 'Empêche la création de comptes multiples et garantit qu\'un compte = une machine.'
        },
        {
          icon: Shield,
          title: '2. État de sécurité Windows',
          content: 'Iris vérifie les fonctionnalités de sécurité de Windows pour s\'assurer que votre système n\'a pas été compromis ou modifié.',
          details: [
            'Secure Boot (démarrage sécurisé UEFI)',
            'Windows Defender (activé, protection en temps réel)',
            'VBS (Virtualization-Based Security)',
            'HVCI (Hypervisor-enforced Code Integrity)',
            'État de virtualisation (VT-x, AMD-V, IOMMU)'
          ],
          purpose: 'Détecte les systèmes potentiellement compromis ou configurés pour faciliter la triche.'
        },
        {
          icon: Activity,
          title: '3. Surveillance des processus',
          content: 'Iris collecte la liste des processus en cours d\'exécution sur votre système toutes les 30 secondes.',
          details: [
            'Nom de chaque processus actif',
            'Identifiant du processus (PID)',
            'Correspondance avec une base de données de logiciels de triche connus'
          ],
          purpose: 'Détecte les logiciels de triche, injecteurs, et programmes suspects en cours d\'exécution.'
        },
        {
          icon: HardDrive,
          title: '4. Périphériques USB',
          content: 'Iris surveille les périphériques USB connectés à votre système.',
          details: [
            'Liste des périphériques USB connectés',
            'VID/PID (identifiants fabricant/produit)',
            'Détection de dispositifs comme Cronus, Titan, XIM'
          ],
          purpose: 'Identifie les adaptateurs et dispositifs utilisés pour la triche (scripts, macros matérielles).'
        },
        {
          icon: Wifi,
          title: '5. Configuration réseau',
          content: 'Iris analyse votre configuration réseau pour détecter les VPN et proxys.',
          details: [
            'Adaptateurs réseau virtuels (TAP, TUN)',
            'Processus VPN en cours d\'exécution',
            'Configuration proxy du système'
          ],
          purpose: 'Détecte l\'utilisation de VPN/proxy pouvant être utilisés pour contourner les bans.'
        },
        {
          icon: Search,
          title: '6. Analyse du registre Windows',
          content: 'Iris scanne des clés de registre spécifiques pour détecter des traces de logiciels de triche.',
          details: [
            'Traces d\'installation de cheats connus',
            'Traces de spoofers (changement d\'identifiant)',
            'Traces de pilotes de triche',
            'Historique de désinstallation de cheats'
          ],
          purpose: 'Détecte les tentatives actuelles ou passées d\'utilisation de logiciels de triche.'
        },
        {
          icon: Lock,
          title: '7. Intégrité des pilotes',
          content: 'Iris vérifie les pilotes système pour détecter des modifications suspectes.',
          details: [
            'Pilotes non signés ou suspects',
            'Pilotes d\'interception (clavier/souris)',
            'Pilotes de triche connus'
          ],
          purpose: 'Détecte les pilotes utilisés pour l\'injection de code ou l\'interception d\'entrées.'
        },
        {
          icon: Zap,
          title: '8. Détection de macros',
          content: 'Iris détecte les logiciels d\'automatisation et de macros.',
          details: [
            'AutoHotkey et scripts similaires',
            'Logiciels Logitech G Hub / Gaming Software',
            'Logiciels Razer Synapse',
            'Autres logiciels de macro'
          ],
          purpose: 'Identifie les logiciels d\'automatisation qui peuvent donner un avantage déloyal.'
        },
        {
          icon: Layers,
          title: '9. Détection d\'overlays',
          content: 'Iris analyse les fenêtres superposées pour détecter les overlays suspects.',
          details: [
            'Fenêtres transparentes superposées au jeu',
            'Fenêtres "topmost" suspectes',
            'Overlays de triche connus (ESP, aimbot visuel)'
          ],
          purpose: 'Détecte les interfaces visuelles de triche affichées par-dessus le jeu.'
        },
        {
          icon: Bug,
          title: '10. Détection d\'injection DLL',
          content: 'Iris surveille les tentatives d\'injection de code.',
          details: [
            'DLL injecteurs connus',
            'DLL non signées suspectes',
            'DLL de hook système'
          ],
          purpose: 'Détecte les techniques d\'injection de code utilisées par les cheats.'
        },
        {
          icon: Cloud,
          title: '11. Détection VM et Cloud PC',
          content: 'Iris détecte l\'exécution dans des environnements virtualisés.',
          details: [
            'Machines virtuelles (VMware, VirtualBox, Hyper-V, QEMU)',
            'Services de cloud gaming (Shadow, GeForce NOW, Parsec)',
            'Indicateurs de virtualisation'
          ],
          purpose: 'Détecte les environnements pouvant être utilisés pour contourner les restrictions.'
        },
        {
          icon: Camera,
          title: '12. Captures d\'écran (Mode Scan)',
          content: 'En mode scan, Iris peut capturer des screenshots pour vérification.',
          details: [
            'Captures d\'écran périodiques',
            'Uniquement sur activation admin'
          ],
          purpose: 'Vérification visuelle en cas de suspicion.',
          warning: true
        },
        {
          icon: Brain,
          title: '13. Analyse comportementale (Machine Learning)',
          content: 'Iris utilise l\'intelligence artificielle pour analyser vos mouvements de souris et vos frappes clavier en temps réel, créant un profil comportemental unique.',
          details: [
            'Échantillonnage des mouvements souris/clavier à 60Hz',
            'Calcul du score de snap (mouvements brusques de visée)',
            'Analyse de la consistance des mouvements',
            'Détection des temps de réaction inhumains (<100ms)',
            'Analyse des micro-corrections naturelles',
            'Ratio de trajectoires parfaitement droites',
            'Création d\'une baseline comportementale personnalisée'
          ],
          purpose: 'Détecte les comportements inhumains typiques des aimbots et logiciels d\'assistance à la visée grâce au machine learning.'
        }
      ],
      privacy: {
        title: 'Confidentialité et données',
        content: 'Vos données sont traitées conformément à notre politique de confidentialité :',
        items: [
          'Les données sont stockées de manière sécurisée sur nos serveurs',
          'Les screenshots ne sont visibles que par les administrateurs autorisés',
          'Les données sont utilisées uniquement pour la détection de triche',
          'Vous pouvez demander la suppression de vos données en contactant l\'équipe'
        ]
      },
      acceptance: {
        title: 'Acceptation des conditions',
        content: 'En téléchargeant et en utilisant Iris Anti-Cheat, vous déclarez avoir lu, compris et accepté toutes les conditions ci-dessus. Vous reconnaissez que la surveillance décrite est nécessaire pour maintenir l\'intégrité compétitive de NoMercy.'
      }
    },
    en: {
      title: 'Iris Terms of Use',
      lastUpdated: 'Last updated',
      back: 'Back',
      intro: {
        title: 'About Iris Anti-Cheat',
        content: 'Iris is NoMercy\'s next-generation anticheat solution. By downloading and using Iris, you agree to the following terms. These conditions are designed to ensure a fair and secure gaming environment for all players.'
      },
      sections: [
        {
          icon: Cpu,
          title: '1. Hardware Identification (TPM 2.0)',
          content: 'Iris uses your computer\'s TPM 2.0 module to create a unique hardware identifier. This identifier links your Discord account to your physical machine.',
          details: [
            'TPM presence and status (enabled/disabled)',
            'TPM version (2.0 required)',
            'TPM module manufacturer',
            'Generation of unique encrypted hardware ID'
          ],
          purpose: 'Prevents multi-accounting and ensures one account = one machine.'
        },
        {
          icon: Shield,
          title: '2. Windows Security Status',
          content: 'Iris checks Windows security features to ensure your system has not been compromised or modified.',
          details: [
            'Secure Boot (UEFI secure boot)',
            'Windows Defender (enabled, real-time protection)',
            'VBS (Virtualization-Based Security)',
            'HVCI (Hypervisor-enforced Code Integrity)',
            'Virtualization status (VT-x, AMD-V, IOMMU)'
          ],
          purpose: 'Detects potentially compromised systems or systems configured to facilitate cheating.'
        },
        {
          icon: Activity,
          title: '3. Process Monitoring',
          content: 'Iris collects the list of running processes on your system every 30 seconds.',
          details: [
            'Name of each active process',
            'Process identifier (PID)',
            'Matching against known cheat software database'
          ],
          purpose: 'Detects cheat software, injectors, and suspicious programs running.'
        },
        {
          icon: HardDrive,
          title: '4. USB Devices',
          content: 'Iris monitors USB devices connected to your system.',
          details: [
            'List of connected USB devices',
            'VID/PID (manufacturer/product identifiers)',
            'Detection of devices like Cronus, Titan, XIM'
          ],
          purpose: 'Identifies adapters and devices used for cheating (scripts, hardware macros).'
        },
        {
          icon: Wifi,
          title: '5. Network Configuration',
          content: 'Iris analyzes your network configuration to detect VPNs and proxies.',
          details: [
            'Virtual network adapters (TAP, TUN)',
            'Running VPN processes',
            'System proxy configuration'
          ],
          purpose: 'Detects VPN/proxy usage that could be used to bypass bans.'
        },
        {
          icon: Search,
          title: '6. Windows Registry Analysis',
          content: 'Iris scans specific registry keys to detect traces of cheat software.',
          details: [
            'Installation traces of known cheats',
            'Spoofer traces (ID spoofing)',
            'Cheat driver traces',
            'Cheat uninstallation history'
          ],
          purpose: 'Detects current or past attempts to use cheat software.'
        },
        {
          icon: Lock,
          title: '7. Driver Integrity',
          content: 'Iris checks system drivers for suspicious modifications.',
          details: [
            'Unsigned or suspicious drivers',
            'Interception drivers (keyboard/mouse)',
            'Known cheat drivers'
          ],
          purpose: 'Detects drivers used for code injection or input interception.'
        },
        {
          icon: Zap,
          title: '8. Macro Detection',
          content: 'Iris detects automation and macro software.',
          details: [
            'AutoHotkey and similar scripts',
            'Logitech G Hub / Gaming Software',
            'Razer Synapse software',
            'Other macro software'
          ],
          purpose: 'Identifies automation software that can provide unfair advantage.'
        },
        {
          icon: Layers,
          title: '9. Overlay Detection',
          content: 'Iris analyzes overlay windows to detect suspicious overlays.',
          details: [
            'Transparent windows overlaid on game',
            'Suspicious "topmost" windows',
            'Known cheat overlays (ESP, visual aimbot)'
          ],
          purpose: 'Detects visual cheat interfaces displayed over the game.'
        },
        {
          icon: Bug,
          title: '10. DLL Injection Detection',
          content: 'Iris monitors code injection attempts.',
          details: [
            'Known DLL injectors',
            'Suspicious unsigned DLLs',
            'System hook DLLs'
          ],
          purpose: 'Detects code injection techniques used by cheats.'
        },
        {
          icon: Cloud,
          title: '11. VM and Cloud PC Detection',
          content: 'Iris detects execution in virtualized environments.',
          details: [
            'Virtual machines (VMware, VirtualBox, Hyper-V, QEMU)',
            'Cloud gaming services (Shadow, GeForce NOW, Parsec)',
            'Virtualization indicators'
          ],
          purpose: 'Detects environments that could be used to bypass restrictions.'
        },
        {
          icon: Camera,
          title: '12. Screenshots (Scan Mode)',
          content: 'In scan mode, Iris can capture screenshots for verification.',
          details: [
            'Periodic screenshots',
            'Only on admin activation'
          ],
          purpose: 'Visual verification when suspicious activity detected.',
          warning: true
        },
        {
          icon: Brain,
          title: '13. Behavioral Analysis (Machine Learning)',
          content: 'Iris uses artificial intelligence to analyze your mouse movements and keystrokes in real-time, creating a unique behavioral profile.',
          details: [
            'Mouse/keyboard input sampling at 60Hz',
            'Aim snap score calculation (sudden aim movements)',
            'Movement consistency analysis',
            'Detection of inhuman reaction times (<100ms)',
            'Natural micro-correction analysis',
            'Perfectly straight trajectory ratio',
            'Creation of personalized behavioral baseline'
          ],
          purpose: 'Detects inhuman behaviors typical of aimbots and aim-assist software through machine learning.'
        }
      ],
      privacy: {
        title: 'Privacy and Data',
        content: 'Your data is processed in accordance with our privacy policy:',
        items: [
          'Data is securely stored on our servers',
          'Screenshots are only visible to authorized administrators',
          'Data is used solely for cheat detection',
          'You can request data deletion by contacting the team'
        ]
      },
      acceptance: {
        title: 'Acceptance of Terms',
        content: 'By downloading and using Iris Anti-Cheat, you declare that you have read, understood, and accepted all the above conditions. You acknowledge that the described monitoring is necessary to maintain NoMercy\'s competitive integrity.'
      }
    }
  };

  const t = content[language] || content.en;

  return (
    <div className="min-h-screen bg-dark-950 relative">
      <div className="absolute inset-0 bg-mesh pointer-events-none"></div>
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-30"></div>
      {isHardcore ? (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(239, 68, 68, 0.15) 0%, transparent 60%)' }}></div>
      ) : (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(6, 182, 212, 0.15) 0%, transparent 60%)' }}></div>
      )}
      
      <div className="relative z-10 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back button */}
          <button 
            onClick={() => navigate(-1)}
            className={`mb-6 flex items-center space-x-2 text-gray-400 hover:text-${accentColor}-400 transition-colors group`}
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>{t.back}</span>
          </button>

          {/* Header */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 p-8 mb-8`}>
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center`}>
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className={`text-3xl font-bold bg-gradient-to-r ${gradientFrom} ${gradientTo} bg-clip-text text-transparent`}>
                  {t.title}
                </h1>
                <p className="text-gray-400 text-sm">
                  {t.lastUpdated}: {new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
                </p>
              </div>
            </div>

            {/* Introduction */}
            <div className="mb-8">
              <h2 className={`text-xl font-bold text-${accentColor}-400 mb-3`}>{t.intro.title}</h2>
              <p className="text-gray-300 leading-relaxed">{t.intro.content}</p>
            </div>
          </div>

          {/* Monitoring Sections */}
          <div className="space-y-6 mb-8">
            {t.sections.map((section, index) => {
              const IconComponent = section.icon;
              return (
                <div 
                  key={index} 
                  className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border ${section.warning ? 'border-orange-500/30' : 'border-white/10'} p-6 hover:border-${accentColor}-500/30 transition-colors`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${section.warning ? 'bg-gradient-to-br from-orange-500 to-red-600' : `bg-gradient-to-br ${gradientFrom} ${gradientTo}`} flex items-center justify-center flex-shrink-0`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-lg font-bold ${section.warning ? 'text-orange-400' : `text-${accentColor}-400`} mb-2`}>
                        {section.title}
                      </h3>
                      <p className="text-gray-300 mb-4">{section.content}</p>
                      
                      {/* Details */}
                      <div className="bg-dark-800/50 rounded-xl p-4 mb-4">
                        <h4 className="text-white text-sm font-semibold mb-2">
                          {language === 'fr' ? 'Données collectées :' : 'Data collected:'}
                        </h4>
                        <ul className="space-y-1">
                          {section.details.map((detail, dIndex) => (
                            <li key={dIndex} className="text-gray-400 text-sm flex items-start gap-2">
                              <span className={`${section.warning ? 'text-orange-500' : `text-${accentColor}-500`} mt-1`}>•</span>
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {/* Purpose */}
                      <div className="flex items-start gap-2">
                        <Eye className={`w-4 h-4 ${section.warning ? 'text-orange-400' : `text-${accentColor}-400`} mt-0.5 flex-shrink-0`} />
                        <p className="text-gray-400 text-sm">
                          <span className="font-semibold text-white">{language === 'fr' ? 'Objectif :' : 'Purpose:'}</span> {section.purpose}
                        </p>
                      </div>

                      {section.warning && (
                        <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-start gap-2">
                          <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                          <p className="text-orange-300 text-sm">
                            {language === 'fr' 
                              ? 'Cette fonctionnalité n\'est activée que par les administrateurs en cas de suspicion.' 
                              : 'This feature is only enabled by administrators when suspicion arises.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Privacy */}
          <div className={`bg-dark-900/80 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/20 p-6 mb-6`}>
            <div className="flex items-center gap-3 mb-4">
              <Lock className={`w-6 h-6 text-${accentColor}-400`} />
              <h2 className={`text-xl font-bold text-${accentColor}-400`}>{t.privacy.title}</h2>
            </div>
            <p className="text-gray-300 mb-4">{t.privacy.content}</p>
            <ul className="space-y-2">
              {t.privacy.items.map((item, index) => (
                <li key={index} className="text-gray-400 text-sm flex items-start gap-2">
                  <Check className={`w-4 h-4 text-${accentColor}-500 mt-0.5 flex-shrink-0`} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Acceptance */}
          <div className={`bg-gradient-to-r ${gradientFrom}/10 ${gradientTo}/10 backdrop-blur-xl rounded-2xl border border-${accentColor}-500/30 p-6`}>
            <div className="flex items-center gap-3 mb-4">
              <FileText className={`w-6 h-6 text-${accentColor}-400`} />
              <h2 className={`text-xl font-bold text-${accentColor}-400`}>{t.acceptance.title}</h2>
            </div>
            <p className="text-gray-300 leading-relaxed">{t.acceptance.content}</p>
          </div>

          {/* Back to Anticheat link */}
          <div className="mt-8 text-center">
            <Link 
              to="/anticheat"
              className={`inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white font-bold rounded-xl hover:opacity-90 transition-all`}
            >
              <Shield className="w-5 h-5" />
              {language === 'fr' ? 'Retour à Iris Anti-Cheat' : 'Back to Iris Anti-Cheat'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IrisTermsOfUse;
