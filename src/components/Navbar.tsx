export const Navbar = () => {
  const navLinks = [
    { label: "Shop", href: "#", active: false },
    { label: "Why", href: "#", active: false },
    { label: "Activate", href: "#", active: false },
    { label: "Help", href: "#", active: false },
    { label: "Plans", href: "#", active: true },
    { label: "Multi-Line", href: "#", active: false },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-card border-b-4 border-cellpay-green shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="hidden md:flex space-x-8 font-bold text-sm uppercase tracking-wider">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={link.active ? "text-cellpay-green" : "text-foreground hover:text-cellpay-green"}
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center space-x-6">
            <a href="#" className="font-bold text-sm text-foreground hover:underline">
              Log In
            </a>
            <a
              href="#"
              className="bg-cellpay-green text-primary-foreground px-6 py-2.5 rounded font-extrabold text-sm uppercase hover:bg-cellpay-green-hover transition-colors"
            >
              Recharge Now
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
};
