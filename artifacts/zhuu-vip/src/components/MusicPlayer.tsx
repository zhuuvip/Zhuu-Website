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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentSong = songs[currentIndex];

  const playSong = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
    setProgress(0);
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

      <div
        data-testid="music-player"
        className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2"
      >
        {/* Playlist panel */}
        {showPlaylist && !isCollapsed && (
          <div className="glass-card rounded-2xl p-3 w-72 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">Playlist</span>
              <button onClick={() => setShowPlaylist(false)} className="text-blue-300/50 hover:text-blue-300">
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
                      ? "bg-cyan-400/15 border border-cyan-400/30 text-cyan-300"
                      : "text-blue-200/70 hover:bg-white/5 hover:text-blue-200"
                  }`}
                >
                  <Music size={12} className={i === currentIndex && isPlaying ? "animate-pulse text-cyan-400" : "text-blue-400/50"} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{song.title}</div>
                    <div className="text-[10px] text-blue-300/50 truncate">{song.artist}</div>
                  </div>
                  {i === currentIndex && isPlaying && (
                    <div className="flex gap-0.5 items-end h-4">
                      {[...Array(3)].map((_, j) => (
                        <div
                          key={j}
                          className="w-1 bg-cyan-400 rounded-full"
                          style={{
                            height: `${Math.random() * 12 + 4}px`,
                            animation: `glow-pulse ${0.5 + j * 0.2}s ease-in-out infinite`
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
        <div className="glass-card rounded-2xl overflow-hidden w-72">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-cyan-400/10">
            <div className="flex items-center gap-2">
              <Music size={14} className="text-cyan-400 animate-glow-pulse" />
              <span className="text-xs font-semibold text-cyan-300">Now Playing</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowPlaylist(!showPlaylist)}
                data-testid="btn-toggle-playlist"
                className={`p-1.5 rounded-lg transition-all ${showPlaylist ? "text-cyan-400 bg-cyan-400/10" : "text-blue-300/50 hover:text-cyan-300"}`}
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                data-testid="btn-collapse-player"
                className="p-1.5 rounded-lg text-blue-300/50 hover:text-cyan-300 transition-all"
              >
                {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>

          {!isCollapsed && (
            <div className="px-4 py-3">
              {/* Song info */}
              <div className="mb-3">
                <div className="text-sm font-semibold text-blue-100 truncate" data-testid="text-song-title">
                  {currentSong?.title ?? "—"}
                </div>
                <div className="text-xs text-blue-300/60 truncate" data-testid="text-song-artist">
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
                  className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full relative transition-all"
                  style={{ width: `${progress * 100}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-blue-300/40 mb-3">
                <span>{formatTime(progress * duration)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <button
                  onClick={prevSong}
                  data-testid="btn-prev-song"
                  className="p-2 rounded-lg text-blue-300/60 hover:text-cyan-300 hover:bg-cyan-400/10 transition-all"
                >
                  <SkipBack size={16} />
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  data-testid="btn-play-pause"
                  className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 flex items-center justify-center text-white shadow-lg hover:shadow-cyan-400/30 transition-all hover:scale-105"
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                </button>

                <button
                  onClick={nextSong}
                  data-testid="btn-next-song"
                  className="p-2 rounded-lg text-blue-300/60 hover:text-cyan-300 hover:bg-cyan-400/10 transition-all"
                >
                  <SkipForward size={16} />
                </button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  data-testid="btn-mute"
                  className="text-blue-300/50 hover:text-cyan-300 transition-colors"
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
                  className="flex-1 h-1 rounded-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
