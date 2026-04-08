import ultraLogo from "@/assets/ultra-mobile-logo.png";
import { CarrierPage } from "@/components/CarrierPage";

const staticPlans = [
  { price: "$49", highlight: "Prepaid Refill" },
  { price: "$39", highlight: "Prepaid Refill" },
  { price: "$29", highlight: "Prepaid Refill" },
  { price: "$19", highlight: "Prepaid Refill" },
];

const UltraMobile = () => (
  <CarrierPage
    apiSlug="ultra-mobile"
    name="Ultra Mobile"
    logo={ultraLogo}
    brandColor="hsl(270,50%,40%)"
    staticPlans={staticPlans}
    trademark="Ultra Mobile® is a registered trademark. All carrier names and trademarks are property of their respective owners."
  />
);

export default UltraMobile;
