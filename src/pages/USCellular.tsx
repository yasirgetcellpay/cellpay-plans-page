import uscellularLogo from "@/assets/uscellular-logo.png";
import { CarrierPage } from "@/components/CarrierPage";

const staticPlans = [
  { price: "$50", highlight: "Prepaid Refill" },
  { price: "$40", highlight: "Prepaid Refill" },
  { price: "$35", highlight: "Prepaid Refill" },
  { price: "$30", highlight: "Prepaid Refill" },
  { price: "$25", highlight: "Prepaid Refill" },
];

const USCellular = () => (
  <CarrierPage
    apiSlug="us-cellular"
    name="US Cellular"
    logo={uscellularLogo}
    brandColor="hsl(220,80%,35%)"
    staticPlans={staticPlans}
    trademark="US Cellular® is a registered trademark. All carrier names and trademarks are property of their respective owners."
  />
);

export default USCellular;
