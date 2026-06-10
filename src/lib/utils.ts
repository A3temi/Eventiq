import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'SGD'): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-SG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Singapore',
  });
}

export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
