import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { CarrierFooter } from "@/components/CarrierFooter";
import { applySeoHead } from "@/lib/seo";

const DMCA = () => {
  useEffect(() => {
    applySeoHead({
      title: "DMCA Compliance — CellPay",
      description:
        "Digital Millennium Copyright Act (DMCA) compliance policy for CellPay, including how to submit a notice of alleged copyright infringement.",
      path: "/digital-millennium-copyright-act-dmca-compliance.html",
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-extrabold text-foreground mb-6">
          Digital Millennium Copyright Act (DMCA) Compliance
        </h1>
        <div className="space-y-5 text-muted-foreground leading-relaxed text-sm">
          <p>
            Zulie Venture INC. abides by the federal Digital Millennium Copyright Act (DMCA) by responding to notices of
            alleged infringement that comply with the DMCA and other applicable laws. As part of our response, we may
            remove or disable access to material residing on a site that is controlled or operated by Zulie Venture INC.
            (such as CellPay) that is claimed to be infringing, in which case we will make a good-faith attempt to
            contact the person who submitted the affected material so that they may make a counter notification, also in
            accordance with the DMCA.
          </p>
          <p>
            Zulie Venture INC. does not control content hosted on third party websites, and cannot remove content from
            sites it does not own or control. If you are the copyright owner of content hosted on a third-party site, and
            you have not authorized the use of your content, please contact the administrator of that website directly
            to have the content removed.
          </p>

          <h2 className="text-lg font-bold text-foreground pt-3">Notice to Copyright Owners</h2>
          <p>
            If you believe material posted on or linked to or from this site is infringing, please provide a written,
            signed notice of infringement (a &ldquo;DMCA Notice&rdquo;) to the designated agent at Zulie Venture INC. by
            mail or email, at the address provided on our contact page. Such DMCA Notice should be in the form set forth
            below, which is consistent with the form suggested by the United States Digital Millennium Copyright Act
            (the &ldquo;DMCA&rdquo;).
          </p>
          <p>
            Pursuant to federal law you may be held liable for damages and attorneys&rsquo; fees if you make any material
            misrepresentations in a Notification. Thus, if you are not sure whether content located on or accessible via
            a link from the Website infringes your copyright, you should contact an attorney.
          </p>

          <h2 className="text-lg font-bold text-foreground pt-3">Required Elements of a DMCA Notice</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>A physical or electronic signature of the copyright owner (or person authorized to act on their behalf).</li>
            <li>Identification of the copyrighted work claimed to have been infringed.</li>
            <li>
              Identification of the material that is claimed to be infringing, including its location on the site, with
              enough detail that we may locate it.
            </li>
            <li>Your contact information, including address, telephone number, and email address.</li>
            <li>
              A statement that you have a good-faith belief that use of the material in the manner complained of is not
              authorized by the copyright owner, its agent, or the law.
            </li>
            <li>
              A statement, made under penalty of perjury, that the information in the notification is accurate and that
              you are the copyright owner or authorized to act on the copyright owner&rsquo;s behalf.
            </li>
          </ul>

          <h2 className="text-lg font-bold text-foreground pt-3">Designated Agent / Contact</h2>
          <p>
            Send DMCA notices to <strong>support@getcellpay.com</strong>, or via our{" "}
            <a href="/contact-us" className="text-foreground underline">contact page</a>.
          </p>
        </div>
      </main>
      <CarrierFooter brandColor="hsl(101,67%,44%)" carrierName="CellPay" />
    </div>
  );
};

export default DMCA;
