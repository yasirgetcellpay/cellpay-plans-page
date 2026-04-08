import boostLogo from "@/assets/boost-logo.png";
import { CarrierPage } from "@/components/CarrierPage";

const staticPlans = [
  { price: "$50", highlight: "Prepaid Refill" },
  { price: "$40", highlight: "Prepaid Refill" },
  { price: "$35", highlight: "Prepaid Refill" },
  { price: "$30", highlight: "Prepaid Refill" },
  { price: "$25", highlight: "Prepaid Refill" },
  { price: "$20", highlight: "Prepaid Refill" },
  { price: "$15", highlight: "Prepaid Refill" },
  { price: "$10", highlight: "Prepaid Refill" },
];

const Boost = () => (
  <CarrierPage
    apiSlug="boost"
    name="Boost Mobile"
    logo={boostLogo}
    brandColor="hsl(27,100%,50%)"
    staticPlans={staticPlans}
    defaultRange={{ min: 5, max: 250 }}
    termsUrl="https://www.boostmobile.com/about/legal/terms-conditions"
    trademark="Boost Mobile® is a registered trademark of DISH Wireless L.L.C. All carrier names and trademarks are property of their respective owners."
  />
);

export default Boost;
