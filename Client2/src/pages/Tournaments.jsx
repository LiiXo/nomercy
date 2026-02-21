import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import Button from '../components/Button'
import { useLanguage } from '../contexts/LanguageContext'

const Tournaments = () => {
  const { t } = useLanguage()
  const [selectedType, setSelectedType] = useState('upcoming')

  // Placeholder tournament data
  const placeholderTournaments = [
    { id: 1, name: 'Weekly Championship', status: 'upcoming', date: 'Coming Soon', prize: '---', players: '0/32' },
    { id: 2, name: 'Monthly Masters', status: 'upcoming', date: 'Coming Soon', prize: '---', players: '0/64' },
    { id: 3, name: 'Pro League Qualifier', status: 'upcoming', date: 'Coming Soon', prize: '---', players: '0/16' },
  ]

  return (
    <div className="min-h-screen pt-16 md:pt-20 pb-24 md:pb-20 px-4 md:px-8 lg:px-16">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 bg-accent-primary" />
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Competitive Events</span>
        </div>
        <h1 className="text-xl md:text-2xl font-mono font-bold uppercase tracking-wide text-white">
          {t('tournamentsTitle')}
        </h1>
      </motion.div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSelectedType('upcoming')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all ${
            selectedType === 'upcoming'
              ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/50'
              : 'bg-dark-800/50 text-gray-500 border border-white/10 hover:text-gray-300 hover:border-white/20'
          }`}
        >
          <span>◈</span>
          <span>{t('upcoming')}</span>
        </button>
        
        <button
          onClick={() => setSelectedType('ongoing')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all ${
            selectedType === 'ongoing'
              ? 'bg-green-500/20 text-green-400 border border-green-500/50'
              : 'bg-dark-800/50 text-gray-500 border border-white/10 hover:text-gray-300 hover:border-white/20'
          }`}
        >
          <span>●</span>
          <span>{t('ongoing')}</span>
        </button>

        <button
          onClick={() => setSelectedType('completed')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all ${
            selectedType === 'completed'
              ? 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
              : 'bg-dark-800/50 text-gray-500 border border-white/10 hover:text-gray-300 hover:border-white/20'
          }`}
        >
          <span>✓</span>
          <span>{t('completed')}</span>
        </button>
      </div>

      {/* Tournaments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {placeholderTournaments.map((tournament, index) => (
          <motion.div
            key={tournament.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="group relative bg-dark-800/30 border border-white/10 hover:border-accent-primary/30 transition-all p-5"
          >
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-accent-primary/30" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-accent-primary/30" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-accent-primary/30" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-accent-primary/30" />

            {/* Status badge */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-mono text-accent-primary uppercase tracking-wider">
                Tournament
              </span>
              <span className="text-[10px] font-mono text-yellow-500/70 uppercase tracking-wider px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20">
                {t('comingSoon')}
              </span>
            </div>

            {/* Tournament name */}
            <h3 className="text-lg font-mono font-bold text-white mb-4 group-hover:text-accent-primary transition-colors">
              {tournament.name}
            </h3>

            {/* Stats */}
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between text-gray-500">
                <span>{t('date')}</span>
                <span className="text-gray-400">{tournament.date}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>{t('prize')}</span>
                <span className="text-accent-primary">{tournament.prize}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>{t('players')}</span>
                <span className="text-gray-400">{tournament.players}</span>
              </div>
            </div>

            {/* Disabled button */}
            <button 
              disabled
              className="w-full mt-4 py-2 text-xs font-mono uppercase tracking-wider bg-white/5 text-gray-600 border border-white/10 cursor-not-allowed"
            >
              [ {t('comingSoon')} ]
            </button>
          </motion.div>
        ))}
      </div>

      {/* Info Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="relative bg-dark-800/20 border border-white/10 p-6"
      >
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-accent-primary/20" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-accent-primary/20" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-accent-primary/20" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-accent-primary/20" />

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">◈</span>
          </div>
          <div>
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider mb-2">
              {t('tournamentSystemTitle')}
            </h3>
            <p className="text-xs font-mono text-gray-500 leading-relaxed">
              {t('tournamentComingSoon')}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5">
          <Link to="/">
            <button className="px-4 py-2 text-xs font-mono uppercase tracking-wider bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary border border-accent-primary/30 hover:border-accent-primary/50 transition-all">
              [ {t('backToLobby')} ]
            </button>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

export default Tournaments
