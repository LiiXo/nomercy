import React, { useState, useEffect } from 'react';
import { X, Cookie } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

const CookieConsent = () => {
  const [show, setShow] = useState(false);
  const { language } = useLanguage();

  useEffect(() => {
    // Vérifier si l'utilisateur a déjà accepté les cookies
    const cookieConsent = localStorage.getItem('cookieConsent');
    if (!cookieConsent) {
      // Afficher après un court délai pour une meilleure UX
      setTimeout(() => setShow(true), 1000);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    localStorage.setItem('cookieConsentDate', new Date().toISOString());
    setShow(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookieConsent', 'declined');
    localStorage.setItem('cookieConsentDate', new Date().toISOString());
    setShow(false);
  };

  if (!show) return null;

  const texts = {
    fr: {
      title: 'Cookies et Confidentialité',
      message: 'Nous utilisons des cookies pour améliorer votre expérience, analyser le trafic et personnaliser le contenu. En continuant, vous acceptez notre utilisation des cookies.',
      accept: 'Accepter',
      decline: 'Refuser',
      learnMore: 'En savoir plus'
    },
    en: {
      title: 'Cookies and Privacy',
      message: 'We use cookies to improve your experience, analyze traffic, and personalize content. By continuing, you accept our use of cookies.',
      accept: 'Accept',
      decline: 'Decline',
      learnMore: 'Learn more'
    },
    de: {
      title: 'Cookies und Datenschutz',
      message: 'Wir verwenden Cookies, um Ihre Erfahrung zu verbessern, den Traffic zu analysieren und Inhalte zu personalisieren. Durch Fortfahren akzeptieren Sie unsere Verwendung von Cookies.',
      accept: 'Akzeptieren',
      decline: 'Ablehnen',
      learnMore: 'Mehr erfahren'
    },
    it: {
      title: 'Cookie e Privacy',
      message: 'Utilizziamo i cookie per migliorare la tua esperienza, analizzare il traffico e personalizzare i contenuti. Continuando, accetti il nostro utilizzo dei cookie.',
      accept: 'Accetta',
      decline: 'Rifiuta',
      learnMore: 'Scopri di più'
    }
  };

  const t = texts[language] || texts.en;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-[slideInUp_0.3s_ease-out]">
      <div className="bg-dark-900/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl p-5 max-w-md w-full">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Cookie className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold mb-1">{t.title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{t.message}</p>
          </div>
          <button
            onClick={handleDecline}
            className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleAccept}
            className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors text-sm"
          >
            {t.accept}
          </button>
          <button
            onClick={handleDecline}
            className="flex-1 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-gray-300 font-medium rounded-lg transition-colors text-sm border border-white/10"
          >
            {t.decline}
          </button>
        </div>
        
        <a
          href="/privacy"
          className="block text-center text-xs text-gray-500 hover:text-gray-400 mt-3 transition-colors"
        >
          {t.learnMore}
        </a>
      </div>
    </div>
  );
};

export default CookieConsent;































