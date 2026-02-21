import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

const SoundContext = createContext()

// Base64 encoded short UI sounds (to avoid external files)
const SOUNDS = {
  click: 'data:audio/wav;base64,UklGRl4AAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToAAABkZGRkZmhoaGpsbGxucHBwcnR0dHZ4eHh6fHx8fn5+foB+fnx6eHZ0cnBuamhkYFxYVFBMSERAOjYyLiomIh4aFhIOCgYCAP7',
  hover: 'data:audio/wav;base64,UklGRkQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YSAAAABQYHCAkKCwwNDg8AAQICAgICAgEBAADw8ODg0MCwoJCAcGBQQDAgEA',
  success: 'data:audio/wav;base64,UklGRoAAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YVwAAABAPFhkcHyIlKCstLzE0NTg5OTk5OTs8PDw8O/v7u7t7ezs6+vq6uno5+bl5OPi4eDf3t3c29rZ2NfW1dTT0tHQz87NzMvKycjHxsXEw8LBwL++vby7urm4t7a1tLOysbA=',
  error: 'data:audio/wav;base64,UklGRl4AAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToAAACA/4D/gP+A/4D+f/5//X/9f/x//H/7f/t/+n/6f/l/+X/4f/h/93/3f/Z/9n/1f/V/9H/0f/N/838=',
  navigate: 'data:audio/wav;base64,UklGRlIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YS4AAABAUGBwgJCgsLDA0ODw//Dw4NDAsKCQgHBgUEAwIBAAECAwQFBgcICQoLDA0ODw',
  select: 'data:audio/wav;base64,UklGRmYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YUIAAABgcICQoLDA0ODw+P//+PDw4NDAsKCQgHBgUEAwIBAAECAwQFBgcICQoLDA0ODw+P8A+PDw4NDAsKCQgHBgUA==',
  toggle: 'data:audio/wav;base64,UklGRkgAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YSQAAAB4iJiovMjU4Ozw9Pj4+Pj08PDo4NjMwLSomJSIeHBkWExAODAkGA=='
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
      gainNode.gain.value = volume
      
      source.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)
      
      source.start(0)
    } catch (e) {
      console.warn('Failed to play sound:', soundName)
    }
  }, [soundEnabled, volume])

  // Convenience methods
  const playClick = useCallback(() => playSound('click'), [playSound])
  const playHover = useCallback(() => playSound('hover', 100), [playSound])
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
