import tmobileLogo from "@/assets/tmobile-logo.svg";
import { CarrierPage } from "@/components/CarrierPage";

const staticPlans = [
  { price: "$100", highlight: "Prepaid Refill" },
  { price: "$75", highlight: "Prepaid Refill" },
  { price: "$60", highlight: "Prepaid Refill" },
  { price: "$50", highlight: "Prepaid Refill" },
  { price: "$40", highlight: "Prepaid Refill" },
  { price: "$30", highlight: "Prepaid Refill" },
  { price: "$25", highlight: "Prepaid Refill" },
  { price: "$15", highlight: "Prepaid Refill" },
  { price: "$10", highlight: "Prepaid Refill" },
];

const TMobile = () => (
  <CarrierPage
    apiSlug="tmobile"
    name="T-Mobile"
    logo={tmobileLogo}
    brandColor="hsl(330,100%,45%)"
    staticPlans={staticPlans}
    termsUrl="https://www.t-mobile.com/responsibility/legal/terms-and-conditions"
    trademark="T-Mobile® is a registered trademark of T-Mobile USA, Inc. All carrier names and trademarks are property of their respective owners."
  />
);

export default TMobile;
