'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Shuffle, Check, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OptionCard as OptionCardType } from '@/types/chat';

interface OptionCardCarouselProps {
  options: OptionCardType[];
  onSelect: (option: OptionCardType) => void;
  onShuffle?: () => void;
}

export function OptionCardCarousel({ options, onSelect, onShuffle }: OptionCardCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const goNext = useCallback(() => {
    if (currentIndex < options.length - 1) {
      setDirection(1);
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, options.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  if (options.length === 0) return null;

  const current = options[currentIndex];

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 200 : -200,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -200 : 200,
      opacity: 0,
    }),
  };

  return (
    <div className="mt-3 w-full max-w-sm">
      <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="p-4"
          >
            {/* Type badge */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                {current.type || 'option'}
              </span>
              {current.score && (
                <span className="text-xs text-muted-foreground">
                  Score: {current.score}/10
                </span>
              )}
            </div>

            {/* Name */}
            <h4 className="font-semibold text-sm leading-tight">{current.name}</h4>

            {/* Price */}
            {current.price && (
              <p className="text-sm font-medium text-primary mt-1">{current.price}</p>
            )}

            {/* Description */}
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
              {current.description}
            </p>

            {/* URL */}
            {current.url && (
              <a
                href={current.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary/80 hover:text-primary mt-2 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                View source
              </a>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Dot indicators */}
        {options.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 pb-3">
            {options.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setDirection(idx > currentIndex ? 1 : -1);
                  setCurrentIndex(idx);
                }}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-all',
                  idx === currentIndex ? 'bg-primary w-3' : 'bg-muted-foreground/30'
                )}
                aria-label={`Option ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="p-1.5 rounded-md border hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous option"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
          {currentIndex + 1}/{options.length}
        </span>

        <button
          onClick={goNext}
          disabled={currentIndex === options.length - 1}
          className="p-1.5 rounded-md border hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next option"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="flex-1" />

        {onShuffle && (
          <button
            onClick={onShuffle}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border hover:bg-accent transition-colors"
          >
            <Shuffle className="w-3 h-3" />
            Shuffle
          </button>
        )}

        <button
          onClick={() => onSelect(current)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
        >
          <Check className="w-3 h-3" />
          Select
        </button>
      </div>
    </div>
  );
}
