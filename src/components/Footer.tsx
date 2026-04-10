interface FooterProps {
  onLogin?: () => void;
  onSignUp?: () => void;
}

export const Footer = ({ onLogin, onSignUp }: FooterProps) => (
  <footer className="bg-foreground text-background/60 py-8">
    <div className="max-w-5xl mx-auto px-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
        <div>
          <h4 className="text-background font-bold text-sm mb-3 uppercase tracking-wider">Company</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="https://www.cellpay.us/about-us/" className="hover:text-background transition-colors">About Us</a></li>
            <li><a href="https://www.cellpay.us/contact-us.html/" className="hover:text-background transition-colors">Contact Us</a></li>
            <li><a href="https://www.cellpay.us/faq" className="hover:text-background transition-colors">FAQ</a></li>
            <li><a href="https://www.cellpay.us/how-to-use/" className="hover:text-background transition-colors">How to Use</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-background font-bold text-sm mb-3 uppercase tracking-wider">My Account</h4>
          <ul className="space-y-2 text-sm">
            <li><button onClick={onLogin} className="hover:text-background transition-colors">Log In</button></li>
            <li><button onClick={onSignUp} className="hover:text-background transition-colors">Sign Up</button></li>
            <li><a href="#carriers" className="hover:text-background transition-colors">Recharge Now</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-background font-bold text-sm mb-3 uppercase tracking-wider">Legal</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="https://www.cellpay.us/privacy-policy.html/" className="hover:text-background transition-colors">Privacy Policy</a></li>
            <li><a href="https://www.cellpay.us/terms-and-conditions.html" className="hover:text-background transition-colors">Terms &amp; Conditions</a></li>
            <li><a href="#" className="hover:text-background transition-colors">Returns &amp; Refunds Policy</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-background/20 pt-6 text-center">
        <p className="text-xs text-background/40">© 2026 CellPay. All rights reserved.</p>
      </div>
    </div>
  </footer>
);
