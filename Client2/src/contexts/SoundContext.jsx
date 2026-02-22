import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

const SoundContext = createContext()

// CoD-style UI sounds - more tactical/military feel
const SOUNDS = {
  // Hover - subtle tick sound (CoD menu hover)
  hover: 'data:audio/wav;base64,UklGRnoAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVYAAACAgICAgICBgoOEhYaHiImKi4yNjo+QkZKTlJWVlZWVlJOSkZCPjo2Mi4qJiIeGhYSDgoGAgICAgICAgIB/f39/f39/f39/f39/f4CAgICAgICAgA==',
  // Click - satisfying tactical click (CoD menu select)
  click: 'data:audio/wav;base64,UklGRqoAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YYYAAACAf39/gIGChIaIio2PkpSXmZudn6GjpKWmp6eoqKmoqKempaSjoaCempmXlJKPjYqIhoSCgX9/f39/gIGChIWHiImLjI2Oj5CRkZGRkZCQj46NjIuJiIaFg4KBf39/f4CAgH9/f39/f39/f39/f39/f4CAgICAgICAgICAgICAgA==',
  // Select - confirmation beep (CoD selection confirm)
  select: 'data:audio/wav;base64,UklGRsYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YaIAAACAgICBgoOFh4mLjpCTlZibnqGjpqiqrK6wsrO1tre4ubq6u7u7u7q6ubm4t7a1s7KwrqyqqKajn52amJWTkI6LiYeFg4GAgICAgIGChIaIio2PkpSWmZueoKKkpqiprKytrq6urq6ura2sq6qopaOhoJ2bmJaUkY+NioeGhIKBgICAgICAgICAgICAgICAgICAgICAgA==',
  // Navigate - page transition swoosh
  navigate: 'data:audio/wav;base64,UklGRq4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YYoAAAB/f4CAgoOFh4mLjY+RkpSVl5iZmpucnZ2enp6enp6dnZycm5qZmJeWlZSTkZCOjYuKiIeGhIOCgYCAf39/f39/f39/gICAgYGCgoODhISFhYaGhoaGhoaGhYWFhISEg4OCgoGBgYCAgH9/f39/f39/f39/f4CAgICAgICAgA==',
  // Success - positive confirmation
  success: 'data:audio/wav;base64,UklGRuIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0Yb4AAACAf4CBg4WIi46RlJeaoKOmqayvsrW3ubu9v8DBwsPExcXFxcXFxMTDwsHAvr27ubazsa6rqKWin5yZlpORj42LiYeFg4KBgICAgIGChIaIi42QkpWXmp2foqSnqautr7GytLW2t7i4uLi4uLe3tra1tLOysbCvrq2sq6qpqKempaOioaCfnp2cm5qZmJeWlZSTkpGQj46NjIuKiYiHhoWEg4KBgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==',
  // Error - negative beep
  error: 'data:audio/wav;base64,UklGRqoAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YYYAAACAkICQgJCAkICQgJCAj4CQgI+Aj4CPgI+Aj4CPgI6AjoCOgI6AjoCOgI2AjYCNgI2AjYCNgIyAjICMgIyAjICMgIuAi4CLgIuAi4CLgIqAioCKgIqAioCKgImAiYCJgImAiYCJgIiAiICIgIiAiICIgIeAh4CHgIeAh4CHgA==',
  // Toggle - switch sound
  toggle: 'data:audio/wav;base64,UklGRoYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWIAAACAgIGDhYeJi42PkZOVl5manJ6goqSlp6iqq62ur7CxsbKysrKysbGwsK+uraylpKKgnpyamJaTkY+NioiFg4GAgICAgH+AgICAgICAgICAgICAgICAgICAgICAgICAgA=='
}

export const SoundProvider = ({ children }) => {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('nomercy-sounds')
    return saved !== null ? JSON.parse(saved) : true
  })
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('nomercy-volume')
    return saved !== null ? parseFloat(saved) : 0.3
  })
  
  const audioContextRef = useRef(null)
  const audioBuffersRef = useRef({})
  const lastPlayedRef = useRef({})

  // Initialize AudioContext
  useEffect(() => {
    const initAudio = async () => {
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
        
        // Pre-load all sounds
        for (const [name, dataUrl] of Object.entries(SOUNDS)) {
          try {
            const response = await fetch(dataUrl)
            const arrayBuffer = await response.arrayBuffer()
            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)
            audioBuffersRef.current[name] = audioBuffer
          } catch (e) {
            console.warn(`Failed to load sound: ${name}`)
          }
        }
      } catch (e) {
        console.warn('Web Audio API not supported')
      }
    }
    
    initAudio()
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('nomercy-sounds', JSON.stringify(soundEnabled))
  }, [soundEnabled])

  useEffect(() => {
    localStorage.setItem('nomercy-volume', volume.toString())
  }, [volume])

  // Play sound function with debouncing
  const playSound = useCallback((soundName, debounceMs = 50) => {
    if (!soundEnabled || !audioContextRef.current || !audioBuffersRef.current[soundName]) return
    
    // Debounce to prevent sound spam
    const now = Date.now()
    if (lastPlayedRef.current[soundName] && now - lastPlayedRef.current[soundName] < debounceMs) {
      return
    }
    lastPlayedRef.current[soundName] = now
    
    // Resume AudioContext if suspended (browser autoplay policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume()
    }
    
    try {
      const source = audioContextRef.current.createBufferSource()
      const gainNode = audioContextRef.current.createGain()
      
      source.buffer = audioBuffersRef.current[soundName]
      // Hover sounds should be quieter
      gainNode.gain.value = soundName === 'hover' ? volume * 0.5 : volume
      
      source.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)
      
      source.start(0)
    } catch (e) {
      console.warn('Failed to play sound:', soundName)
    }
  }, [soundEnabled, volume])

  // Convenience methods
  const playClick = useCallback(() => playSound('click'), [playSound])
  const playHover = useCallback(() => playSound('hover', 80), [playSound]) // 80ms debounce for hover
  const playSuccess = useCallback(() => playSound('success'), [playSound])
  const playError = useCallback(() => playSound('error'), [playSound])
  const playNavigate = useCallback(() => playSound('navigate'), [playSound])
  const playSelect = useCallback(() => playSound('select'), [playSound])
  const playToggle = useCallback(() => playSound('toggle'), [playSound])

  const value = {
    soundEnabled,
    setSoundEnabled,
    volume,
    setVolume,
    playSound,
    playClick,
    playHover,
    playSuccess,
    playError,
    playNavigate,
    playSelect,
    playToggle
  }

  return (
    <SoundContext.Provider value={value}>
      {children}
    </SoundContext.Provider>
  )
}

export const useSound = () => {
  const context = useContext(SoundContext)
  if (!context) {
    throw new Error('useSound must be used within a SoundProvider')
  }
  return context
}

export default SoundContext
