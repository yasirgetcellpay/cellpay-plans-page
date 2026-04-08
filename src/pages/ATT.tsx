import attLogo from "@/assets/att-prepaid-logo.webp";
import { CarrierPage } from "@/components/CarrierPage";

const staticPlans = [
  { price: "$100", highlight: "Prepaid Refill" },
  { price: "$85", highlight: "Prepaid Refill" },
  { price: "$80", highlight: "Prepaid Refill" },
  { price: "$75", highlight: "Prepaid Refill" },
  { price: "$70", highlight: "Prepaid Refill" },
  { price: "$65", highlight: "Prepaid Refill" },
  { price: "$60", highlight: "Prepaid Refill" },
  { price: "$50", highlight: "Prepaid Refill" },
  { price: "$45", highlight: "Prepaid Refill" },
  { price: "$40", highlight: "Prepaid Refill" },
  { price: "$35", highlight: "Prepaid Refill" },
  { price: "$30", highlight: "Prepaid Refill" },
  { price: "$25", highlight: "Prepaid Refill" },
  { price: "$20", highlight: "Prepaid Refill" },
  { price: "$15", highlight: "Prepaid Refill" },
  { price: "$10", highlight: "Prepaid Refill" },
];

const ATT = () => (
  <CarrierPage
    apiSlug="topup-at"
    name="AT&T Prepaid"
    logo={attLogo}
    brandColor="hsl(196,100%,44%)"
    staticPlans={staticPlans}
    termsUrl="https://www.att.com/legal/terms.attWebsiteTermsOfUse.html"
    trademark="AT&T® is a registered trademark of AT&T Intellectual Property. All carrier names and trademarks are property of their respective owners."
  />
);

export default ATT;
