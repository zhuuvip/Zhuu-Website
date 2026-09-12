import { useState, useRef, useEffect, useCallback } from "react";
import { useListSongs } from "@workspace/api-client-react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Music,
  ChevronUp,
  ChevronDown,
  List,
  X,
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
    if (!songs.length) return;
    playSong((currentIndex + 1) % songs.length);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    audio.currentTime = pct * audio.duration;
    setProgress(pct);
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";

    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);

    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const prevSong = () => {
    if (!songs.length) return;
    playSong((currentIndex - 1 + songs.length) % songs.length);
  };

  const nextSong = () => {
    if (!songs.length) return;
    playSong((currentIndex + 1) % songs.length);
  };

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
        className="fixed right-4 bottom-5 sm:right-6 sm:bottom-6 z-40 pointer-events-none"
      >
        <div className="relative flex flex-col items-end gap-2">
          {/* Playlist */}
          {showPlaylist && !isCollapsed && (
            <div className="pointer-events-auto w-[min(19rem,calc(100vw-2rem))] max-h-[45vh] overflow-y-auto rounded-2xl border border-cyan-300/10 bg-slate-950/85 p-2 shadow-2xl shadow-cyan-950/40 backdrop-blur-2xl">
              <div className="flex items-center justify-between px-2 py-2">
                <div className="flex items-center gap-2">
                  <Music size={13} className="text-cyan-400" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/80">
                    Playlist
                  </span>
                </div>

                <button
                  onClick={() => setShowPlaylist(false)}
                  className="rounded-lg p-1 text-blue-200/40 transition hover:bg-white/5 hover:text-cyan-300"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-1">
                {songs.map((song, i) => (
                  <button
                    key={song.id}
                    data-testid={`playlist-song-${song.id}`}
                    onClick={() => {
                      playSong(i);
                      setShowPlaylist(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-all ${
                      i === currentIndex
                        ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                        : "text-blue-100/65 hover:bg-white/5 hover:text-blue-100"
                    }`}
                  >
                    <Music
                      size={12}
                      className={
                        i === currentIndex && isPlaying
                          ? "animate-pulse text-cyan-400"
                          : "text-blue-400/40"
                      }
                    />

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">
                        {song.title}
                      </div>
                      <div className="truncate text-[10px] text-blue-300/45">
                        {song.artist}
                      </div>
                    </div>

                    {i === currentIndex && isPlaying && (
                      <div className="flex items-end gap-0.5">
                        <span className="h-2 w-0.5 animate-pulse rounded-full bg-cyan-400" />
                        <span className="h-3 w-0.5 animate-pulse rounded-full bg-cyan-400 [animation-delay:120ms]" />
                        <span className="h-1.5 w-0.5 animate-pulse rounded-full bg-cyan-400 [animation-delay:240ms]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Expanded player */}
          {!isCollapsed && (
            <div className="pointer-events-auto w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-cyan-300/10 bg-slate-950/90 shadow-2xl shadow-cyan-950/40 backdrop-blur-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 ring-1 ring-cyan-400/10">
                    <Music
                      size={14}
                      className="text-cyan-400"
                    />
                  </div>

                  <div className="min-w-0">
                    <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-300/50">
                      Now Playing
                    </span>
                    <span className="block truncate text-xs font-semibold text-blue-50">
                      {currentSong?.title ?? "—"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setShowPlaylist(!showPlaylist)}
                    data-testid="btn-toggle-playlist"
                    className={`rounded-lg p-2 transition ${
                      showPlaylist
                        ? "bg-cyan-400/10 text-cyan-300"
                        : "text-blue-200/40 hover:bg-white/5 hover:text-cyan-300"
                    }`}
                    aria-label="Playlist"
                  >
                    <List size={14} />
                  </button>

                  <button
                    onClick={() => setIsCollapsed(true)}
                    data-testid="btn-collapse-player"
                    className="rounded-lg p-2 text-blue-200/40 transition hover:bg-white/5 hover:text-cyan-300"
                    aria-label="Minimize music player"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>

              <div className="px-3.5 pb-3.5 pt-3">
                {/* Song */}
                <div className="mb-3">
                  <div
                    className="truncate text-sm font-semibold text-blue-50"
                    data-testid="text-song-title"
                  >
                    {currentSong?.title ?? "—"}
                  </div>

                  <div
                    className="truncate text-xs text-blue-300/50"
                    data-testid="text-song-artist"
                  >
                    {currentSong?.artist ?? "—"}
                  </div>
                </div>

                {/* Progress */}
                <div
                  className="group mb-1.5 h-1.5 cursor-pointer overflow-visible rounded-full bg-white/10"
                  onClick={handleSeek}
                  data-testid="progress-bar"
                >
                  <div
                    className="relative h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-[width]"
                    style={{ width: `${progress * 100}%` }}
                  >
                    <div className="absolute -right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100" />
                  </div>
                </div>

                <div className="mb-3 flex justify-between text-[9px] text-blue-300/35">
                  <span>{formatTime(progress * duration)}</span>
                  <span>{formatTime(duration)}</span>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={prevSong}
                    data-testid="btn-prev-song"
                    className="rounded-full p-2 text-blue-200/50 transition hover:bg-cyan-400/10 hover:text-cyan-300"
                    aria-label="Previous song"
                  >
                    <SkipBack size={16} />
                  </button>

                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    data-testid="btn-play-pause"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 text-white shadow-lg shadow-cyan-950/30 transition hover:scale-105 hover:shadow-cyan-400/20"
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <Pause size={17} />
                    ) : (
                      <Play size={17} className="ml-0.5" />
                    )}
                  </button>

                  <button
                    onClick={nextSong}
                    data-testid="btn-next-song"
                    className="rounded-full p-2 text-blue-200/50 transition hover:bg-cyan-400/10 hover:text-cyan-300"
                    aria-label="Next song"
                  >
                    <SkipForward size={16} />
                  </button>
                </div>

                {/* Volume */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    data-testid="btn-mute"
                    className="text-blue-200/40 transition hover:text-cyan-300"
                    aria-label={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? (
                      <VolumeX size={14} />
                    ) : (
                      <Volume2 size={14} />
                    )}
                  </button>

                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(Number(e.target.value));
                      setIsMuted(false);
                    }}
                    data-testid="volume-slider"
                    className="h-1 flex-1 cursor-pointer accent-cyan-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Compact music button */}
          {isCollapsed && (
            <button
              onClick={() => setIsCollapsed(false)}
              data-testid="btn-collapse-player"
              aria-label="Open music player"
              className="pointer-events-auto group relative flex h-11 w-11 items-center justify-center rounded-full border border-cyan-300/15 bg-slate-950/80 text-cyan-300 shadow-xl shadow-cyan-950/30 backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:border-cyan-300/30 hover:bg-slate-900"
            >
              {isPlaying && (
                <span className="absolute inset-0 rounded-full border border-cyan-400/20 animate-ping" />
              )}

              <Music
                size={17}
                className={isPlaying ? "animate-pulse" : ""}
              />

              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-cyan-400" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
