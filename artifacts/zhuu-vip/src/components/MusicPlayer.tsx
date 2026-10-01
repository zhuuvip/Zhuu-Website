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
  List,
} from "lucide-react";

export default function MusicPlayer() {
  const { data: songs = [] } = useListSongs();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [hideOnHistory, setHideOnHistory] = useState(false);
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

  useEffect(() => {
    const history = document.getElementById("purchase-history");
    if (!history) return;

    const observer = new IntersectionObserver(
      ([entry]) => setHideOnHistory(entry.isIntersecting),
      { threshold: 0.08 },
    );

    observer.observe(history);

    return () => observer.disconnect();
  }, []);

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

  const formatTime = (seconds: number) => {
    if (!seconds || Number.isNaN(seconds)) return "0:00";

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${minutes}:${secs.toString().padStart(2, "0")}`;
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

      <div className={`fixed right-3 bottom-32 sm:right-5 sm:bottom-5 z-40 pointer-events-none transition-all duration-300 ${hideOnHistory ? "translate-y-4 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"}`}>
        <div className="flex flex-col items-end gap-2">

          {showPlaylist && (
            <div className="pointer-events-auto w-[min(17rem,calc(100vw-1.5rem))] max-h-60 overflow-y-auto rounded-xl border border-white/[0.08] bg-black/70 p-1.5 shadow-xl backdrop-blur-xl">
              {songs.map((song, index) => (
                <button
                  key={song.id}
                  data-testid={`playlist-song-${song.id}`}
                  onClick={() => {
                    playSong(index);
                    setShowPlaylist(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    index === currentIndex
                      ? "bg-white/[0.08] text-white"
                      : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
                  }`}
                >
                  <Music size={12} className="shrink-0" />
                  <span className="truncate text-[11px]">
                    {song.title}
                  </span>
                </button>
              ))}
            </div>
          )}

          {isExpanded && (
            <div className="pointer-events-auto w-[min(17rem,calc(100vw-1.5rem))] rounded-xl border border-white/[0.08] bg-black/65 p-3 shadow-xl backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div
                    data-testid="text-song-title"
                    className="truncate text-xs font-medium text-white/85"
                  >
                    {currentSong.title}
                  </div>
                  <div
                    data-testid="text-song-artist"
                    className="truncate text-[10px] text-white/35"
                  >
                    {currentSong.artist}
                  </div>
                </div>

                <span className="shrink-0 text-[9px] text-white/30">
                  {formatTime(progress * duration)}
                </span>
              </div>

              <div
                data-testid="progress-bar"
                onClick={handleSeek}
                className="h-1 cursor-pointer overflow-hidden rounded-full bg-white/[0.08]"
              >
                <div
                  className="h-full rounded-full bg-white/60 transition-all"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>

              <div className="mt-3 flex items-center justify-center gap-4">
                <button
                  onClick={prevSong}
                  data-testid="btn-prev-song"
                  className="text-white/35 transition hover:text-white/80"
                >
                  <SkipBack size={14} />
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:scale-105"
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>

                <button
                  onClick={nextSong}
                  data-testid="btn-next-song"
                  className="text-white/35 transition hover:text-white/80"
                >
                  <SkipForward size={14} />
                </button>

                <button
                  onClick={() => setIsMuted(!isMuted)}
                  data-testid="btn-mute"
                  className="text-white/35 transition hover:text-white/80"
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <Volume2 size={11} className="text-white/25" />

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(event) => {
                    setVolume(Number(event.target.value));
                    setIsMuted(false);
                  }}
                  data-testid="volume-slider"
                  className="h-1 flex-1 cursor-pointer accent-white"
                />
              </div>
            </div>
          )}

          <div className="pointer-events-auto flex items-center rounded-full border border-white/[0.08] bg-black/55 p-1 shadow-lg backdrop-blur-xl">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              data-testid="btn-play-pause"
              aria-label={isPlaying ? "Pause music" : "Play music"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/75 transition hover:bg-white/[0.14] hover:text-white"
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            </button>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              data-testid="btn-collapse-player"
              className="flex min-w-0 max-w-[9rem] items-center gap-1.5 px-2 text-left"
            >
              <Music size={12} className="shrink-0 text-white/30" />
              <span className="truncate text-[10px] font-medium text-white/60">
                {currentSong.title}
              </span>
            </button>

            <button
              onClick={() => setShowPlaylist(!showPlaylist)}
              data-testid="btn-toggle-playlist"
              aria-label="Open playlist"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/30 transition hover:bg-white/[0.06] hover:text-white/75"
            >
              <List size={13} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
