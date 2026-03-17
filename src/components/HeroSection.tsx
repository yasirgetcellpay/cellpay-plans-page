export const HeroSection = () => {
  return (
    <section className="bg-gradient-to-r from-plan-tier1 to-plan-tier2 text-primary-foreground overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 flex flex-col md:flex-row items-center">
        <div className="md:w-1/2 mb-6 md:mb-0">
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">Service Plans</h1>
        </div>
        <div className="md:w-1/2 flex justify-end">
          <img
            src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&auto=format&fit=crop&q=80"
            alt="People using phones"
            className="rounded-2xl shadow-2xl w-full max-w-sm object-cover h-[180px]"
          />
        </div>
      </div>
    </section>
  );
};
