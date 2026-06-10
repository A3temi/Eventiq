import { CreditCard, Receipt, Wallet } from "lucide-react";

export function BillingPage() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <h2 className="text-xl font-bold tracking-tight">Billing & Account</h2>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-primary">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">Current Plan</div>
            <div className="text-xs text-muted-foreground">Pro — billed monthly</div>
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">$29</span>
          <span className="text-sm text-muted-foreground">/ month</span>
        </div>
        <button className="text-sm font-medium text-primary hover:underline">
          Change plan
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-primary">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="text-sm font-semibold">Payment Method</div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Visa ending in 4242</span>
          <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
            Active
          </span>
        </div>
        <button className="text-sm font-medium text-primary hover:underline">
          Update card
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-primary">
            <Receipt className="h-5 w-5" />
          </div>
          <div className="text-sm font-semibold">Recent Invoices</div>
        </div>
        <div className="space-y-2">
          {[
            { date: "Jun 1, 2026", amount: "$29.00", status: "Paid" },
            { date: "May 1, 2026", amount: "$29.00", status: "Paid" },
            { date: "Apr 1, 2026", amount: "$29.00", status: "Paid" },
          ].map((inv) => (
            <div
              key={inv.date}
              className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0"
            >
              <span className="text-muted-foreground">{inv.date}</span>
              <div className="flex items-center gap-3">
                <span className="font-medium">{inv.amount}</span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  {inv.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
