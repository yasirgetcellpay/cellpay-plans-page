import h2oLogo from "@/assets/h2o-logo.png";
import { CarrierPage } from "@/components/CarrierPage";

const staticPlans = [
  { price: "$50", highlight: "Prepaid Refill" },
  { price: "$40", highlight: "Prepaid Refill" },
  { price: "$30", highlight: "Prepaid Refill" },
  { price: "$20", highlight: "Prepaid Refill" },
  { price: "$10", highlight: "Prepaid Refill" },
];

const H2O = () => (
  <CarrierPage
    apiSlug="h2o"
    name="H2O Wireless"
    logo={h2oLogo}
    brandColor="hsl(195,85%,50%)"
    staticPlans={staticPlans}
    trademark="H2O Wireless® is a registered trademark. All carrier names and trademarks are property of their respective owners."
  />
);

export default H2O;
