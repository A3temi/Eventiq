'use client';

import { ExternalLink, Check, MapPin, DollarSign, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OptionCard as OptionCardType } from '@/types/chat';

interface OptionCardCarouselProps {
  options: OptionCardType[];
  onSelect: (option: OptionCardType) => void;
  onShuffle?: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  venue: 'bg-blue-50 text-blue-700 border-blue-200',
  vendor: 'bg-purple-50 text-purple-700 border-purple-200',
  catering: 'bg-orange-50 text-orange-700 border-orange-200',
  food: 'bg-orange-50 text-orange-700 border-orange-200',
  result: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  option: 'bg-gray-50 text-gray-700 border-gray-200',
};

function getTypeColor(type: string): string {
  return TYPE_COLORS[type?.toLowerCase()] || TYPE_COLORS.option;
}

export function OptionCardCarousel({ options, onSelect, onShuffle }: OptionCardCarouselProps) {
  if (options.length === 0) return null;

  return (
    <div className="mt-3 space-y-2 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {options.length} option{options.length !== 1 ? 's' : ''} found
        </span>
        {onShuffle && (
          <button
            onClick={onShuffle}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            Search for more →
          </button>
        )}
      </div>

      {/* Cards grid */}
      <div className="grid gap-2">
        {options.map((option, idx) => (
          <div
            key={idx}
            className="group relative rounded-lg border bg-card p-3 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
            onClick={() => onSelect(option)}
          >
            <div className="flex items-start gap-3">
              {/* Number badge */}
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-medium">
                {idx + 1}
              </div>

              <div className="flex-1 min-w-0">
                {/* Top row: type badge + name */}
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded border capitalize',
                    getTypeColor(option.type)
                  )}>
                    {option.type || 'option'}
                  </span>
                  {option.score && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                      {option.score}
                    </span>
                  )}
                </div>

                {/* Name */}
                <h4 className="font-medium text-sm leading-tight truncate">
                  {option.name}
                </h4>

                {/* Description */}
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {option.description}
                </p>

                {/* Bottom row: price + url */}
                <div className="flex items-center gap-3 mt-1.5">
                  {option.price && (
                    <span className="flex items-center gap-0.5 text-xs font-medium text-green-700">
                      <DollarSign className="w-3 h-3" />
                      {option.price.replace(/^\$/, '')}
                    </span>
                  )}
                  {option.url && (
                    <a
                      href={option.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-0.5 text-[11px] text-primary/70 hover:text-primary transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Website
                    </a>
                  )}
                </div>
              </div>

              {/* Select button — visible on hover */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(option);
                }}
                className="shrink-0 opacity-0 group-hover:opacity-100 px-2 py-1 text-[11px] font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
