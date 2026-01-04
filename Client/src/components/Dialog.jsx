import React from 'react';
import { X } from 'lucide-react';

const Dialog = ({ isOpen, onClose, title, children, type = 'info' }) => {
  if (!isOpen) return null;

  const typeColors = {
    info: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400' },
    success: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400' },
    error: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400' },
    warning: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400' }
  };

  const colors = typeColors[type] || typeColors.info;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className={`bg-dark-900 border ${colors.border} rounded-2xl p-6 max-w-md w-full shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h3 className={`text-lg font-bold ${colors.text}`}>{title}</h3>
          )}
          <button 
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="text-white">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Dialog;




























