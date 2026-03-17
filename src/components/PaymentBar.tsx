export const PaymentBar = () => (
  <div className="bg-card py-8 border-t border-border">
    <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-8">
      <span className="font-bold text-muted-foreground uppercase tracking-widest text-sm">We Accept:</span>
      <div className="flex space-x-6 grayscale opacity-60">
        <svg className="h-8" viewBox="0 0 50 30"><rect width="50" height="30" rx="4" fill="#1A1F71" /></svg>
        <svg className="h-8" viewBox="0 0 50 30"><rect width="50" height="30" rx="4" fill="#EB001B" /></svg>
        <svg className="h-8" viewBox="0 0 50 30"><rect width="50" height="30" rx="4" fill="#0070CD" /></svg>
        <svg className="h-8" viewBox="0 0 50 30"><rect width="50" height="30" rx="4" fill="#FF6000" /></svg>
        <svg className="h-8" viewBox="0 0 50 30"><rect width="50" height="30" rx="4" fill="#003087" /></svg>
      </div>
    </div>
  </div>
);
