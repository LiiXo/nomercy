import React from 'react';
import { useLanguage } from '../LanguageContext';
import { AlertTriangle, X, Clock, Calendar } from 'lucide-react';

const BanDialog = ({ isOpen, onClose, banInfo }) => {
  const { language } = useLanguage();

  if (!isOpen || !banInfo) return null;

  const texts = {
    fr: {
      title: 'Compte banni',
      reason: 'Raison',
      expiresAt: 'Expire le',
      permanent: 'Bannissement permanent',
      close: 'Fermer',
      message: 'Votre compte a été banni et vous ne pouvez plus accéder à la plateforme.',
    },
    en: {
      title: 'Account Banned',
      reason: 'Reason',
      expiresAt: 'Expires on',
      permanent: 'Permanent ban',
      close: 'Close',
      message: 'Your account has been banned and you can no longer access the platform.',
    },
    de: {
      title: 'Konto gesperrt',
      reason: 'Grund',
      expiresAt: 'Läuft ab am',
      permanent: 'Permanente Sperre',
      close: 'Schließen',
      message: 'Ihr Konto wurde gesperrt und Sie können nicht mehr auf die Plattform zugreifen.',
    },
    it: {
      title: 'Account bannato',
      reason: 'Motivo',
      expiresAt: 'Scade il',
      permanent: 'Ban permanente',
      close: 'Chiudi',
      message: 'Il tuo account è stato bannato e non puoi più accedere alla piattaforma.',
    },
  };

  const t = texts[language] || texts.en;

  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : language === 'it' ? 'it-IT' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="relative bg-gradient-to-br from-dark-900 to-dark-950 border-2 border-red-500/50 rounded-2xl p-8 max-w-lg w-full shadow-2xl animate-scale-in">
        {/* Animated warning glow */}
        <div className="absolute inset-0 rounded-2xl bg-red-500/10 animate-pulse-slow pointer-events-none"></div>
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Icon */}
        <div className="relative mb-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-red-500/20 to-red-600/20 border-2 border-red-500/50 flex items-center justify-center animate-pulse-slow">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold text-white text-center mb-3">
          {t.title}
        </h2>

        {/* Message */}
        <p className="text-gray-300 text-center mb-6">
          {t.message}
        </p>

        {/* Ban details */}
        <div className="space-y-4 mb-6">
          {/* Reason */}
          <div className="bg-dark-800/50 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-400 mb-1">{t.reason}</p>
                <p className="text-white">{banInfo.reason || 'Non spécifiée / Not specified'}</p>
              </div>
            </div>
          </div>

          {/* Expiration */}
          <div className="bg-dark-800/50 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                {banInfo.expiresAt ? (
                  <Clock className="w-4 h-4 text-red-400" />
                ) : (
                  <Calendar className="w-4 h-4 text-red-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-400 mb-1">
                  {banInfo.expiresAt ? t.expiresAt : t.permanent}
                </p>
                {banInfo.expiresAt ? (
                  <p className="text-white">{formatDate(banInfo.expiresAt)}</p>
                ) : (
                  <p className="text-gray-400">Ce bannissement est permanent jusqu'à révocation manuelle par un administrateur.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full py-4 px-6 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg"
        >
          {t.close}
        </button>
      </div>
    </div>
  );
};

export default BanDialog;

