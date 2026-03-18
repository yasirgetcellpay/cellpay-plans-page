export const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 bg-card border-b-4 border-cellpay-green shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-end h-20 items-center">
          <a
            href="#"
            className="bg-cellpay-green text-primary-foreground px-6 py-2.5 rounded font-extrabold text-sm uppercase hover:bg-cellpay-green-hover transition-colors"
          >
            Recharge Now
          </a>
        </div>
      </div>
    </nav>
  );
};
