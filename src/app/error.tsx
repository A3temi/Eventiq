'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen grid place-items-center bg-background px-6">
      <div className="text-center max-w-md">
        <img src="/logo-icon.svg" alt="Eventiq" className="w-12 h-12 mx-auto mb-4 opacity-60" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Something went wrong</h2>
        <p className="text-sm text-muted-foreground mb-6">
          The app encountered an unexpected error. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
