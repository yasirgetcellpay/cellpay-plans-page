import simpleMobileLogo from "@/assets/simple-mobile-logo.png";

export const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 bg-card border-b-4 border-cellpay-green shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center h-14 sm:h-20 items-center">
          <img
            src={simpleMobileLogo}
            alt="Simple Mobile"
            className="w-[100px] sm:w-[140px]"
          />
        </div>
      </div>
    </nav>
  );
};
