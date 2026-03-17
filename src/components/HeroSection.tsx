export const HeroSection = () => {
  return (
    <section className="bg-gradient-to-r from-plan-tier1 to-plan-tier2 text-primary-foreground overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 flex flex-col md:flex-row items-center">
        <div className="md:w-1/2 mb-10 md:mb-0">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 leading-tight">Service Plans</h1>
          <p className="text-lg md:text-xl opacity-90 max-w-lg leading-relaxed">
            No contracts. No annual commitments. Unlimited plans starting at $25 on a powerful nationwide network.
          </p>
        </div>
        <div className="md:w-1/2 flex justify-end">
          <img
            src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&auto=format&fit=crop&q=80"
            alt="People using phones"
            className="rounded-2xl shadow-2xl w-full max-w-md object-cover h-64 md:h-80"
          />
        </div>
      </div>
    </section>
  );
};
