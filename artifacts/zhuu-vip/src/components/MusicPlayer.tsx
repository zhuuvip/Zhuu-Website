import { useState, useRef, useEffect, useCallback } from "react";
import { useListSongs } from "@workspace/api-client-react";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Music, ChevronUp, ChevronDown, List, X
} from "lucide-react";

export default function MusicPlayer() {
  const { data: songs = [] } = useListSongs();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const welcomeAudioRef = useRef<HTMLAudioElement>(null);
  const welcomeStartedRef = useRef(false);

  const currentSong = songs[currentIndex];

  const playSong = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
    setProgress(0);
  }, []);

  useEffect(() => {
    const welcome = welcomeAudioRef.current;
    if (!welcome || welcomeStartedRef.current) return;

    welcomeStartedRef.current = true;
    welcome.volume = 0.28;

    const startWelcome = () => {
      welcome.currentTime = 0;

      welcome.play()
        .then(() => {
          setTimeout(() => setShowWelcome(false), 1800);
        })
        .catch(() => {
          setShowWelcome(false);
        });
    };

    startWelcome();

    const unlock = () => {
      welcome.play()
        .then(() => {
          setShowWelcome(false);
        })
        .catch(() => {});

      setIsPlaying(true);
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const hideTimer = window.setTimeout(() => {
      setShowWelcome(false);
    }, 1800);

    return () => {
      window.clearTimeout(hideTimer);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying, currentIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress(audio.currentTime / audio.duration);
    setDuration(audio.duration);
  };

  const handleEnded = () => {
    const next = (currentIndex + 1) % songs.length;
    playSong(next);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
    setProgress(pct);
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const prevSong = () => playSong((currentIndex - 1 + songs.length) % songs.length);
  const nextSong = () => playSong((currentIndex + 1) % songs.length);

  if (songs.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes welcomeSimple {
          0% {
            opacity: 0;
            transform: scale(0.96);
          }
          25% {
            opacity: 1;
            transform: scale(1);
          }
          75% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(1.02);
          }
        }
      `}</style>
      {currentSong && (
        <audio
          ref={audioRef}
          key={currentSong.url}
          src={currentSong.url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onEnded={handleEnded}
          data-testid="audio-element"
        />
      )}

      <audio
        ref={welcomeAudioRef}
        src="https://files.catbox.moe/xw6708.mp3"
        preload="auto"
      />

      {showWelcome && (
        <div
          className="fixed inset-0 z-[55] pointer-events-none flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="text-center animate-[welcomeSimple_1800ms_ease-out_forwards]">
            <div className="text-[10px] uppercase tracking-[0.45em] text-white/45">
              Welcome to
            </div>
            <div className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[0.16em] text-white/90">
              ZHUUSITE
            </div>
          </div>
        </div>
      )}

      <div
        data-testid="music-player"
        className="fixed top-[calc(4.5rem+var(--announcement-height,0px))] left-1/2 -translate-x-1/2 sm:top-[calc(5rem+var(--announcement-height,0px))] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40 flex flex-col items-end gap-2 max-w-[calc(100vw-1rem)] pointer-events-none"
      >
        {/* Playlist panel */}
        {showPlaylist && !isCollapsed && (
          <div className="pointer-events-auto glass-card rounded-2xl p-2 w-[min(18rem,calc(100vw-1rem))] max-h-[50vh] overflow-y-auto shadow-2xl shadow-black/30 border border-white/10 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Playlist</span>
              <button onClick={() => setShowPlaylist(false)} className="text-white/60/50 hover:text-white/60">
                <X size={14} />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {songs.map((song, i) => (
                <button
                  key={song.id}
                  data-testid={`playlist-song-${song.id}`}
                  onClick={() => { playSong(i); setShowPlaylist(false); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all w-full ${
                    i === currentIndex
                      ? "bg-white/[0.08] border border-white/15 text-white/80"
                      : "text-white/70/70 hover:bg-white/5 hover:text-white/70"
                  }`}
                >
                  <Music size={12} className={i === currentIndex && isPlaying ? "animate-pulse text-white/70" : "text-white/35"} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{song.title}</div>
                    <div className="text-[10px] text-white/60/50 truncate">{song.artist}</div>
                  </div>
                  {i === currentIndex && isPlaying && (
                    <div className="flex gap-0.5 items-end h-4">
                      {[...Array(3)].map((_, j) => (
                        <div
                          key={j}
                          className="w-1 bg-white/70 rounded-full"
                          style={{
                            height: `${Math.random() * 12 + 4}px`
                          }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main player */}
        <div className="pointer-events-auto glass-card rounded-2xl overflow-hidden w-[min(18rem,calc(100vw-1rem))] shadow-2xl shadow-black/30 border border-white/10 backdrop-blur-xl transition-all duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-2.5 py-2 border-b border-white/10 bg-white/[0.025]">
            <div className="flex items-center gap-2 min-w-0">
              <Music size={14} className="shrink-0 text-white/70" />
              <div className="min-w-0">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-white/80/70">
                  Now Playing
                </span>
                <span className="block max-w-[10rem] truncate text-xs font-semibold text-white/90">
                  {currentSong?.title ?? "—"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowPlaylist(!showPlaylist)}
                data-testid="btn-toggle-playlist"
                className={`p-1.5 rounded-lg transition-all ${showPlaylist ? "text-white/70 bg-white/[0.06]" : "text-white/60/50 hover:text-white/80"}`}
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                data-testid="btn-collapse-player"
                className="p-1.5 rounded-lg text-white/60/50 hover:text-white/80 transition-all"
              >
                {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>

          {!isCollapsed && (
            <div className="px-3 py-2.5">
              {/* Song info */}
              <div className="mb-2.5">
                <div className="text-sm font-semibold text-white/90 truncate" data-testid="text-song-title">
                  {currentSong?.title ?? "—"}
                </div>
                <div className="text-xs text-white/60/60 truncate" data-testid="text-song-artist">
                  {currentSong?.artist ?? "—"}
                </div>
              </div>

              {/* Progress bar */}
              <div
                className="h-1.5 bg-white/10 rounded-full mb-2 cursor-pointer group"
                onClick={handleSeek}
                data-testid="progress-bar"
              >
                <div
                  className="h-full bg-white/80 rounded-full relative transition-all"
                  style={{ width: `${progress * 100}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-white/60/40 mb-3">
                <span>{formatTime(progress * duration)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <button
                  onClick={prevSong}
                  data-testid="btn-prev-song"
                  className="p-2.5 rounded-xl text-white/60/60 hover:text-white/80 hover:bg-white/[0.06] transition-all"
                >
                  <SkipBack size={16} />
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  data-testid="btn-play-pause"
                  className="w-11 h-11 rounded-full bg-white/80 flex items-center justify-center text-white shadow-lg hover:shadow-black/30 transition-all hover:scale-105"
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                </button>

                <button
                  onClick={nextSong}
                  data-testid="btn-next-song"
                  className="p-2.5 rounded-xl text-white/60/60 hover:text-white/80 hover:bg-white/[0.06] transition-all"
                >
                  <SkipForward size={16} />
                </button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  data-testid="btn-mute"
                  className="text-white/60/50 hover:text-white/80 transition-colors"
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => { setVolume(Number(e.target.value)); setIsMuted(false); }}
                  data-testid="volume-slider"
                  className="flex-1 h-1 rounded-full accent-white cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
