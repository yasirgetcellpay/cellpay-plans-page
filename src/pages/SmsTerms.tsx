import { Fragment, useEffect } from "react"; // SMS-34332-1020
import { Navbar } from "@/components/Navbar"; // SMS-34332-1020
import { CarrierFooter } from "@/components/CarrierFooter"; // SMS-34332-1020
import { applySeoHead } from "@/lib/seo"; // SMS-34332-1020
import { SMS_TERMS, type SmsInline } from "@/content/smsTerms"; // SMS-34332-1020
const Inline = ({ x }: { x: SmsInline }) => typeof x === "string" ? <>{x}</> : <a href={x.href} className="underline">{x.text}</a>; // SMS-34332-1020
const SmsTerms = () => { // SMS-34332-1020
  useEffect(() => { applySeoHead({ title: SMS_TERMS.title, description: SMS_TERMS.description, path: SMS_TERMS.path }); }, []); // SMS-34332-1020
  return ( // SMS-34332-1020
    <div className="min-h-screen flex flex-col bg-background" lang="en">{/* // SMS-34332-1020 */}
      <Navbar />{/* // SMS-34332-1020 */}
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">{/* // SMS-34332-1020 */}
        <h1 className="text-3xl font-extrabold text-foreground mb-6">{SMS_TERMS.h1}</h1>{/* // SMS-34332-1020 */}
        <div className="space-y-5 text-muted-foreground leading-relaxed text-sm">{/* // SMS-34332-1020 */}
          {SMS_TERMS.sections.map((s) => ( // SMS-34332-1020
            <Fragment key={s.h}>{/* // SMS-34332-1020 */}
              <h2 className="text-lg font-bold text-foreground pt-3">{s.h}</h2>{/* // SMS-34332-1020 */}
              <p>{s.p.map((x, i) => <Inline key={i} x={x} />)}</p>{/* // SMS-34332-1020 */}
            </Fragment> // SMS-34332-1020
          ))}{/* // SMS-34332-1020 */}
        </div>{/* // SMS-34332-1020 */}
      </main>{/* // SMS-34332-1020 */}
      <CarrierFooter brandColor="hsl(101,67%,44%)" carrierName="CellPay" lang="en" />{/* // SMS-34332-1020 */}
    </div> // SMS-34332-1020
  ); // SMS-34332-1020
}; // SMS-34332-1020
export default SmsTerms; // SMS-34332-1020