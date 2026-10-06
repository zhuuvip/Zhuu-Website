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
    if (audio) audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress(audio.currentTime / audio.duration);
    setDuration(audio.duration);
  };

  const handleEnded = () => {
    if (songs.length) playSong((currentIndex + 1) % songs.length);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio?.duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );

    audio.currentTime = pct * audio.duration;
    setProgress(pct);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || Number.isNaN(seconds)) return "0:00";
    return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0")}`;
  };

  const prevSong = () => {
    if (songs.length) playSong((currentIndex - 1 + songs.length) % songs.length);
  };

  const nextSong = () => {
    if (songs.length) playSong((currentIndex + 1) % songs.length);
  };

  if (!currentSong) return null;

  return (
    <div className="relative flex min-w-0 flex-1 items-center justify-center">
      <audio
        ref={audioRef}
        key={currentSong.url}
        src={currentSong.url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={handleEnded}
      />

      <div className="flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-2 py-1.5 backdrop-blur-xl">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          aria-label={isPlaying ? "Pause music" : "Play music"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 sm:h-8 sm:w-8"
        >
          {isPlaying ? <Pause size={13} /> : <Play size={13} />}
        </button>

        <button
          onClick={() => setShowPlaylist(!showPlaylist)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/40 transition hover:bg-white/[0.06] hover:text-white sm:h-8 sm:w-8"
          aria-label="Open playlist"
        >
          <List size={14} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Music size={13} className="shrink-0 text-white/30" />
              <span className="truncate text-[11px] font-medium text-white/65">
                {currentSong.title}
              </span>
            </div>

            <span className="shrink-0 text-[9px] text-white/25">
              {formatTime(progress * duration)}
            </span>
          </div>

          <div
            onClick={handleSeek}
            className="mt-1.5 h-1 cursor-pointer overflow-hidden rounded-full bg-white/[0.08] touch-manipulation"
          >
            <div
              className="h-full rounded-full bg-white/55 transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        <div className="hidden items-center gap-1 sm:flex">
          <button
            onClick={prevSong}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white/30 transition hover:bg-white/[0.06] hover:text-white"
          >
            <SkipBack size={13} />
          </button>

          <button
            onClick={nextSong}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white/30 transition hover:bg-white/[0.06] hover:text-white"
          >
            <SkipForward size={13} />
          </button>

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white/30 transition hover:bg-white/[0.06] hover:text-white"
          >
            {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
        </div>
      </div>

      {showPlaylist && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[60] max-h-[min(15rem,50dvh)] overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.08] bg-[#0b0f15]/98 p-1.5 shadow-2xl backdrop-blur-xl">
          {songs.map((song, index) => (
            <button
              key={song.id}
              onClick={() => {
                playSong(index);
                setShowPlaylist(false);
              }}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] transition ${
                index === currentIndex
                  ? "bg-white/[0.08] text-white"
                  : "text-white/50 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <Music size={12} className="shrink-0" />
              <span className="truncate">{song.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
