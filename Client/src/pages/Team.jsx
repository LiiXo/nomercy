import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { useMode } from '../ModeContext';
import { Heart, Users, Shield, Gavel, Loader2, Crown, Star } from 'lucide-react';
import { getAvatarUrl } from '../utils/avatar';

const API_URL = import.meta.env.VITE_API_URL || 'https://api-nomercy.ggsecure.io/api';

// Member Node Component
const MemberNode = ({ member, size = 'normal', getCategoryColor, getMemberAvatar }) => {
  const colors = getCategoryColor(member.category);
  const avatarUrl = getMemberAvatar(member);
  const isLarge = size === 'large';
  const [imgError, setImgError] = useState(false);
  
  return (
    <div className="flex flex-col items-center">
      {/* Avatar with glow */}
      <div className={`relative ${isLarge ? 'mb-4' : 'mb-3'}`}>
        <div className={`absolute inset-0 ${colors.bg} rounded-full blur-xl opacity-40`} />
        <div className={`relative ${isLarge ? 'w-28 h-28' : 'w-20 h-20'} rounded-full ${colors.border} border-3 overflow-hidden bg-dark-800 shadow-lg ${colors.glow}`}>
          {avatarUrl && !imgError ? (
            <img
              src={avatarUrl}
              alt={member.name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className={`w-full h-full ${colors.bg} flex items-center justify-center`}>
              <span className={`${isLarge ? 'text-3xl' : 'text-2xl'} font-bold text-white`}>
                {member.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Name */}
      <h3 className={`font-bold text-white ${isLarge ? 'text-lg' : 'text-base'} text-center`}>
        {member.name}
      </h3>
      
      {/* Role */}
      <p className={`${colors.text} ${isLarge ? 'text-sm' : 'text-xs'} font-medium text-center mt-1`}>
        {member.role}
      </p>
      
      {/* Discord */}
      {member.discordUsername && (
        <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
          {member.discordUsername}
        </p>
      )}
    </div>
  );
};

const Team = () => {
  const { language } = useLanguage();
  const { selectedMode } = useMode();
  const isHardcore = selectedMode === 'hardcore';
  
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    try {
      const response = await fetch(`${API_URL}/team`);
      const data = await response.json();
      if (data.success) {
        setTeam(data.team);
      }
    } catch (err) {
      console.error('Error fetching team:', err);
    }
    setLoading(false);
  };

  const getCategoryLabel = (category) => {
    const labels = {
      direction: { fr: 'Direction', en: 'Leadership' },
      staff: { fr: 'Staff', en: 'Staff' },
      arbitre: { fr: 'Arbitres', en: 'Referees' },
      moderator: { fr: 'Modérateurs', en: 'Moderators' },
      other: { fr: 'Autres', en: 'Others' }
    };
    return labels[category]?.[language === 'fr' ? 'fr' : 'en'] || category;
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'direction': return { bg: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-500', glow: 'shadow-amber-500/50' };
      case 'staff': return { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-500', glow: 'shadow-purple-500/50' };
      case 'arbitre': return { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500', glow: 'shadow-orange-500/50' };
      case 'moderator': return { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500', glow: 'shadow-blue-500/50' };
      default: return { bg: 'bg-gray-500', border: 'border-gray-500', text: 'text-gray-500', glow: 'shadow-gray-500/50' };
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'direction': return Crown;
      case 'staff': return Star;
      case 'arbitre': return Gavel;
      case 'moderator': return Shield;
      default: return Users;
    }
  };

  // Get proper avatar URL
  const getMemberAvatar = (member) => {
    if (member.avatar) {
      // If it's a Discord CDN URL, use it directly
      if (member.avatar.startsWith('http')) {
        return member.avatar;
      }
      // Otherwise use the avatar utility
      return getAvatarUrl(member.avatar);
    }
    return null;
  };

  const renderOrgLevel = (category, members, isTop = false) => {
    if (!members || members.length === 0) return null;
    
    const colors = getCategoryColor(category);
    const CategoryIcon = getCategoryIcon(category);
    
    return (
      <div className="relative">
        {/* Category Label */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`p-2 rounded-lg ${colors.bg}`}>
            <CategoryIcon className="w-4 h-4 text-white" />
          </div>
          <span className={`text-sm font-bold uppercase tracking-wider ${colors.text}`}>
            {getCategoryLabel(category)}
          </span>
        </div>
        
        {/* Members */}
        <div className={`flex flex-wrap justify-center ${isTop ? 'gap-12' : 'gap-8'}`}>
          {members.map(member => (
            <MemberNode 
              key={member._id}
              member={member} 
              size={isTop ? 'large' : 'normal'}
              getCategoryColor={getCategoryColor}
              getMemberAvatar={getMemberAvatar}
            />
          ))}
        </div>
        
        {/* Connector line to next level */}
        <div className="flex justify-center mt-8">
          <div className={`w-px h-12 ${colors.bg} opacity-30`} />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className={`w-8 h-8 animate-spin ${isHardcore ? 'text-neon-red' : 'text-accent-500'}`} />
      </div>
    );
  }

  const hasMembers = team && Object.values(team).some(arr => arr.length > 0);

  return (
    <div className="min-h-screen bg-dark-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-2xl ${isHardcore ? 'bg-neon-red/20' : 'bg-accent-500/20'}`}>
              <Heart className={`w-8 h-8 ${isHardcore ? 'text-neon-red' : 'text-accent-500'}`} />
            </div>
          </div>
          <h1 className={`text-4xl font-display font-bold mb-3 ${isHardcore ? 'text-gradient-fire' : 'text-gradient-ice'}`}>
            {language === 'fr' ? "L'Équipe NoMercy" : 'The NoMercy Team'}
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {language === 'fr' 
              ? "Découvrez les personnes passionnées qui font vivre NoMercy au quotidien."
              : "Meet the passionate people who make NoMercy happen every day."}
          </p>
        </div>

        {/* Org Chart */}
        {hasMembers ? (
          <div className="space-y-4">
            {/* Direction - Top Level */}
            {team.direction?.length > 0 && renderOrgLevel('direction', team.direction, true)}
            
            {/* Staff - Second Level */}
            {team.staff?.length > 0 && renderOrgLevel('staff', team.staff)}
            
            {/* Arbitres - Third Level */}
            {team.arbitre?.length > 0 && renderOrgLevel('arbitre', team.arbitre)}
            
            {/* Moderators - Fourth Level */}
            {team.moderator?.length > 0 && renderOrgLevel('moderator', team.moderator)}
            
            {/* Others - Bottom Level */}
            {team.other?.length > 0 && (
              <div className="relative">
                <div className="flex items-center justify-center gap-2 mb-8">
                  <div className="p-2 rounded-lg bg-gray-500">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-bold uppercase tracking-wider text-gray-500">
                    {getCategoryLabel('other')}
                  </span>
                </div>
                <div className="flex flex-wrap justify-center gap-8">
                  {team.other.map(member => (
                    <MemberNode 
                      key={member._id}
                      member={member} 
                      size="normal"
                      getCategoryColor={getCategoryColor}
                      getMemberAvatar={getMemberAvatar}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              {language === 'fr' 
                ? "L'équipe sera bientôt présentée ici."
                : "The team will be presented here soon."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Team;
