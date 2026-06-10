'use client';

import { Lightbulb } from 'lucide-react';

interface TopicsSectionProps {
  topics: string[];
}

export function TopicsSection({ topics }: TopicsSectionProps) {
  return (
    <div className="rounded-xl border-2 border-green-200 bg-green-50/30 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-yellow-500" />
        <span className="text-sm font-medium text-foreground">Topics</span>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 ml-auto">
          {topics.length} topics
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {topics.map((topic, i) => (
          <span
            key={i}
            className="inline-block text-xs px-2.5 py-1 rounded-full bg-white border border-green-200 text-foreground"
          >
            {topic}
          </span>
        ))}
      </div>
    </div>
  );
}
