import React, { useState } from 'react';
import styles from './AlbumCard.module.css';

interface Album {
  id: string;
  name: string;
  coverUrl: string;
  artist?: string;
  songCount?: number;
}

interface AlbumCardProps {
  album: Album;
  onClick?: (album: Album) => void;
  size?: 'small' | 'medium' | 'large';
  showInfo?: boolean;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({
  album,
  onClick,
  size = 'medium',
  showInfo = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick(album);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const coverSize = {
    small: 80,
    medium: 160,
    large: 240,
  }[size];

  return (
    <div
      className={`${styles.albumCard} ${styles[size]}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      tabIndex={0}
      role="button"
      aria-label={`专辑: ${album.name}`}
    >
      {/* Cover image container */}
      <div
        className={styles.coverWrapper}
        style={{ width: coverSize, height: coverSize }}
      >
        {!imageLoaded && !imageError && (
          <div className={styles.imagePlaceholder}>
            <div className={styles.loadingSpinner} />
          </div>
        )}
        <img
          src={imageError ? '/default-album.png' : album.coverUrl}
          alt={album.name}
          className={`${styles.cover} ${imageLoaded ? styles.loaded : ''}`}
          style={{ width: coverSize, height: coverSize }}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          loading="lazy"
        />
        {isHovered && (
          <div className={styles.playOverlay}>
            <div className={styles.playButton}>▶</div>
          </div>
        )}
      </div>

      {/* Album info */}
      {showInfo && (
        <div className={styles.info}>
          <h3 className={styles.albumName} title={album.name}>
            {album.name}
          </h3>
          {album.artist && (
            <p className={styles.artistName} title={album.artist}>
              {album.artist}
            </p>
          )}
          {album.songCount !== undefined && (
            <p className={styles.songCount}>
              {album.songCount} 首歌曲
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// Grid layout component
interface AlbumGridProps {
  albums: Album[];
  columns?: number;
  onAlbumClick?: (album: Album) => void;
  gap?: number;
}

export const AlbumGrid: React.FC<AlbumGridProps> = ({
  albums,
  columns = 4,
  onAlbumClick,
  gap = 24,
}) => {
  return (
    <div
      className={styles.albumGrid}
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap}px`,
      }}
    >
      {albums.map(album => (
        <AlbumCard
          key={album.id}
          album={album}
          onClick={onAlbumClick}
        />
      ))}
    </div>
  );
};

export type { Album, AlbumCardProps, AlbumGridProps };
