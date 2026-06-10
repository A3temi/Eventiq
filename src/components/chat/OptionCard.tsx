'use client';

import { useState } from 'react';
import { Check, Shuffle, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OptionCard as OptionCardType } from '@/types/chat';

interface OptionCardCarouselProps {
  options: OptionCardType[];
  onSelect: (option: OptionCardType) => void;
  onShuffle?: () => void;
}

const categoryIcons: Record<string, string> = {
  catering: '🍽️',
  venue: '📍',
  photography: '📸',
  music: '🎵',
  decoration: '🎨',
  entertainment: '🎭',
  transport: '🚗',
  florist: '💐',
  vendor: '🏪',
};

const categoryGradients: Record<string, string> = {
  catering: 'from-orange-200/60 to-amber-300/40',
  venue: 'from-blue-200/60 to-indigo-300/40',
  photography: 'from-purple-200/60 to-pink-300/40',
  music: 'from-green-200/60 to-teal-300/40',
  decoration: 'from-rose-200/60 to-fuchsia-300/40',
  entertainment: 'from-yellow-200/60 to-orange-300/40',
  transport: 'from-cyan-200/60 to-blue-300/40',
  florist: 'from-pink-200/60 to-rose-300/40',
  vendor: 'from-slate-200/60 to-gray-300/40',
};

function MapPopup({ location, onClose }: { location: string; onClose: () => void }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API || '';
  const query = encodeURIComponent(location + ' Singapore');
  const embedUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${query}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-lg overflow-hidden w-[90vw] max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b">
          <span className="text-sm font-medium truncate">📍 {location}</span>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-accent transition-colors"
            aria-label="Close map"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {apiKey ? (
          <iframe
            src={embedUrl}
            className="w-full h-64 border-0"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`Map of ${location}`}
          />
        ) : (
          <div className="w-full h-64 flex items-center justify-center text-sm text-muted-foreground">
            Map unavailable — API key not configured
          </div>
        )}
      </div>
    </div>
  );
}

function SingleOptionCard({
  option,
  onSelect,
}: {
  option: OptionCardType;
  onSelect: (option: OptionCardType) => void;
}) {
  const [showMap, setShowMap] = useState(false);
  const category = option.category || option.type || 'vendor';
  const icon = categoryIcons[category] || '📋';
  const gradient = categoryGradients[category] || 'from-primary/20 to-accent/30';

  return (
    <>
      <div className="rounded-xl border bg-card hover:shadow-md transition-shadow p-0 overflow-hidden flex flex-col">
        {/* Image area */}
        {option.imageUrl ? (
          <div className="h-24 overflow-hidden">
            <img
              src={option.imageUrl}
              alt={option.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className={cn('h-24 bg-gradient-to-br flex items-center justify-center text-2xl', gradient)}>
            {icon}
          </div>
        )}

        {/* Content */}
        <div className="p-3 flex flex-col flex-1">
          {/* Category badge */}
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary capitalize w-fit mb-1">
            {icon} {category}
          </span>

          {/* Name */}
          <h4 className="font-semibold text-sm leading-tight line-clamp-1">{option.name}</h4>

          {/* Price */}
          {option.price && (
            <p className="text-xs font-medium text-primary mt-0.5">💰 {option.price}</p>
          )}

          {/* Description */}
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 flex-1">
            {option.description}
          </p>

          {/* Location */}
          {option.location && (
            <button
              onClick={() => setShowMap(true)}
              className="text-[11px] text-primary/80 hover:text-primary underline mt-1 text-left truncate transition-colors"
            >
              📍 {option.location}
            </button>
          )}

          {/* URL */}
          {option.url && (
            <a
              href={option.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-primary mt-1 transition-colors"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              Source
            </a>
          )}

          {/* Select button */}
          <button
            onClick={() => onSelect(option)}
            className="flex items-center justify-center gap-1 w-full mt-2 px-2 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            <Check className="w-3 h-3" />
            Select
          </button>
        </div>
      </div>

      {showMap && option.location && (
        <MapPopup location={option.location} onClose={() => setShowMap(false)} />
      )}
    </>
  );
}

export function OptionCardCarousel({ options, onSelect, onShuffle }: OptionCardCarouselProps) {
  const [showAll, setShowAll] = useState(false);

  if (options.length === 0) return null;

  const maxVisible = 6;
  const visibleOptions = showAll ? options : options.slice(0, maxVisible);
  const hasMore = options.length > maxVisible;

  return (
    <div className="mt-3 w-full">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {visibleOptions.map((option, idx) => (
          <SingleOptionCard key={idx} option={option} onSelect={onSelect} />
        ))}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between mt-2">
        {hasMore && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Show more ({options.length - maxVisible} more)
          </button>
        )}
        {showAll && hasMore && (
          <button
            onClick={() => setShowAll(false)}
            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Show less
          </button>
        )}
        {!hasMore && <div />}

        {onShuffle && (
          <button
            onClick={onShuffle}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border hover:bg-accent transition-colors"
          >
            <Shuffle className="w-3 h-3" />
            More options
          </button>
        )}
      </div>
    </div>
  );
}
