import verizonLogo from "@/assets/verizon-logo.png";
import { CarrierPage } from "@/components/CarrierPage";

const staticPlans = [
  { price: "$100", highlight: "Prepaid Refill" },
  { price: "$80", highlight: "Prepaid Refill" },
  { price: "$70", highlight: "Prepaid Refill" },
  { price: "$60", highlight: "Prepaid Refill" },
  { price: "$50", highlight: "Prepaid Refill" },
  { price: "$40", highlight: "Prepaid Refill" },
  { price: "$35", highlight: "Prepaid Refill" },
  { price: "$30", highlight: "Prepaid Refill" },
  { price: "$20", highlight: "Prepaid Refill" },
  { price: "$15", highlight: "Prepaid Refill" },
];

const Verizon = () => (
  <CarrierPage
    apiSlug="verizon"
    name="Verizon Prepaid"
    logo={verizonLogo}
    brandColor="hsl(0,100%,45%)"
    staticPlans={staticPlans}
    termsUrl="https://www.verizon.com/support/prepaid-account-terms/"
    trademark="Verizon® is a registered trademark of Verizon Communications Inc. All carrier names and trademarks are property of their respective owners."
  />
);

export default Verizon;
