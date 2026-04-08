import metroLogo from "@/assets/metro-logo.svg";
import { CarrierPage } from "@/components/CarrierPage";

const staticPlans = [
  { price: "$60", highlight: "Prepaid Refill" },
  { price: "$50", highlight: "Prepaid Refill" },
  { price: "$40", highlight: "Prepaid Refill" },
  { price: "$30", highlight: "Prepaid Refill" },
  { price: "$25", highlight: "Prepaid Refill" },
  { price: "$15", highlight: "Prepaid Refill" },
];

const Metro = () => (
  <CarrierPage
    apiSlug="metropcs"
    name="Metro by T-Mobile"
    logo={metroLogo}
    brandColor="hsl(270,60%,32%)"
    staticPlans={staticPlans}
    termsUrl="https://www.metrobyt-mobile.com/terms-conditions"
    trademark="Metro by T-Mobile® is a registered trademark of T-Mobile USA, Inc. All carrier names and trademarks are property of their respective owners."
  />
);

export default Metro;
