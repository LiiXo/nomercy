import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const AudioContextGlobal = createContext({ requestPlay: () => {} });

// Routes where background music should play
const MUSIC_ROUTES = ['/', '/play'];

export const AudioProvider = ({ children }) => {
  const audioRef = useRef(null);
  const fadeFrameRef = useRef(null);
  const fadeStartedRef = useRef(false);
  const location = useLocation();

  // Check if current route should have music
  const shouldPlayMusic = MUSIC_ROUTES.includes(location.pathname);

  const startFadeIn = useCallback(() => {
    const audioEl = audioRef.current;
    if (!audioEl || fadeStartedRef.current) return;
    fadeStartedRef.current = true;

    audioEl.volume = 0;
    audioEl.muted = false;

    const targetVolume = 0.5; // 50% max volume
    const duration = 2500;
    const step = (ts, startTs) => {
      const elapsed = ts - startTs;
      const progress = Math.min(elapsed / duration, 1);
      audioEl.volume = progress * targetVolume;
      if (progress < 1) {
        fadeFrameRef.current = requestAnimationFrame(nextTs => step(nextTs, startTs));
      }
    };

    fadeFrameRef.current = requestAnimationFrame(ts => step(ts, ts));
  }, []);

  const fadeOut = useCallback(() => {
    const audioEl = audioRef.current;
    if (!audioEl || audioEl.paused) return;

    // Cancel any ongoing fade-in
    if (fadeFrameRef.current) {
      cancelAnimationFrame(fadeFrameRef.current);
    }

    const startVol = audioEl.volume;
    const duration = 500;

    const step = (ts, startTs) => {
      const elapsed = ts - startTs;
      const progress = Math.min(elapsed / duration, 1);
      audioEl.volume = Math.max(0, startVol * (1 - progress));
      if (progress < 1) {
        fadeFrameRef.current = requestAnimationFrame(nextTs => step(nextTs, startTs));
      } else {
        audioEl.pause();
        audioEl.volume = 0;
        fadeStartedRef.current = false;
      }
    };

    fadeFrameRef.current = requestAnimationFrame(ts => step(ts, ts));
  }, []);

  const tryPlay = useCallback(async () => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    try {
      await audioEl.play();
      startFadeIn();
    } catch {
      // Autoplay blocked
    }
  }, [startFadeIn]);

  const requestPlay = useCallback(() => {
    if (shouldPlayMusic) {
      tryPlay();
    }
  }, [tryPlay, shouldPlayMusic]);

  // Handle route changes
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    if (shouldPlayMusic) {
      // On music routes: try to play
      if (audioEl.paused) {
        tryPlay();
      }
    } else {
      // On other routes: fade out and pause
      fadeOut();
    }
  }, [shouldPlayMusic, tryPlay, fadeOut]);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    // Only setup listeners if we should play music
    if (!shouldPlayMusic) return;

    // Try to play immediately
    tryPlay();

    // Unlock on user gesture
    const unlock = () => {
      if (shouldPlayMusic) {
        tryPlay();
      }
    };

    window.addEventListener('click', unlock);
    window.addEventListener('touchstart', unlock);
    window.addEventListener('keydown', unlock);

    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
      if (fadeFrameRef.current) {
        cancelAnimationFrame(fadeFrameRef.current);
      }
    };
  }, [tryPlay, shouldPlayMusic]);

  return (
    <AudioContextGlobal.Provider value={{ requestPlay }}>
      {children}
      <audio
        ref={audioRef}
        src="/sound.mp3#t=15"
        loop
        playsInline
        preload="auto"
        className="hidden"
        aria-hidden="true"
      />
    </AudioContextGlobal.Provider>
  );
};

export const useBackgroundAudio = () => useContext(AudioContextGlobal);
