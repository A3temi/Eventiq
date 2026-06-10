'use client';

import { DollarSign } from 'lucide-react';

interface BudgetSectionProps {
  budget: {
    total?: number;
    committed?: number;
    items?: Array<{ name: string; amount: number; status: string }>;
  };
}

export function BudgetSection({ budget }: BudgetSectionProps) {
  const total = budget.total || 0;
  const committed = budget.committed || 0;
  const remaining = total - committed;
  const percent = total > 0 ? Math.round((committed / total) * 100) : 0;

  return (
    <div className="rounded-xl border-2 border-green-200 bg-green-50/30 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="w-4 h-4 text-green-600" />
        <span className="text-sm font-medium text-foreground">Budget</span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Total</span>
          <span className="font-medium text-foreground">${total.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Committed</span>
          <span className="font-medium text-foreground">${committed.toLocaleString()} ({percent}%)</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Remaining</span>
          <span className="font-medium text-foreground">${remaining.toLocaleString()}</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 rounded-full bg-gray-200 mt-2">
          <div
            className={`h-2 rounded-full transition-all ${percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>

        {/* Budget items */}
        {budget.items && budget.items.length > 0 && (
          <div className="mt-3 space-y-1 pt-2 border-t border-green-100">
            {budget.items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-medium">${item.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
