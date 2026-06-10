'use client';

import type { EventModel } from '@/lib/eventiq/types';
import { Check } from 'lucide-react';

const steps = [
  { key: 'planning', label: 'Planning' },
  { key: 'venue', label: 'Venues' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'payments', label: 'Paid' },
  { key: 'ready', label: 'Ready' },
] as const;

export function DeliveryTracker({ event }: { event: EventModel }) {
  const venueConfirmed = !!event.venue?.confirmed;
  const vendorsBooked =
    event.vendors.length > 0 &&
    event.vendors.every((v) => v.status === 'booked' || v.status === 'deposit_paid' || v.status === 'delivered');
  // Requires real committed money AND items actually marked paid (adapter
  // derives `spent` from paid budget items) — never auto-completes at 0 >= 0.
  const paymentsDone = event.budget
    ? event.budget.committed > 0 && event.budget.spent >= event.budget.committed * 0.9
    : false;
  const ready = event.status === 'completed';

  const completed = [true, venueConfirmed, vendorsBooked, paymentsDone, ready];
  const currentIdx = completed.findIndex((c) => !c);
  const lastDone = currentIdx === -1 ? steps.length - 1 : currentIdx - 1;

  return (
    <div className="animate-card-in w-full">
      <div className="flex items-center w-full">
        {steps.map((step, i) => {
          const done = completed[i];
          const current = i === currentIdx;
          return (
            <div key={step.key} className="flex-1 flex items-center last:flex-none">
              <div className="flex flex-col items-center text-center w-full">
                <div
                  className={`h-6 w-6 sm:h-7 sm:w-7 rounded-full grid place-items-center text-[10px] sm:text-xs font-semibold transition-colors ${
                    done
                      ? 'bg-primary text-primary-foreground'
                      : current
                        ? 'bg-card border-2 border-primary text-primary pulse-ring'
                        : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {done ? <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : i + 1}
                </div>
                <div
                  className={`mt-1.5 text-[10px] sm:text-xs leading-tight ${done || current ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
                >
                  {step.label}
                </div>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-px mx-1 sm:mx-3 ${i < lastDone ? 'bg-primary' : 'bg-border'}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
