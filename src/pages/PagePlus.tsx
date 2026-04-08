import pageplusLogo from "@/assets/pageplus-logo.png";
import { CarrierPage } from "@/components/CarrierPage";

const staticPlans = [
  { price: "$80", highlight: "Prepaid Refill" },
  { price: "$55", highlight: "Prepaid Refill" },
  { price: "$39.95", highlight: "Prepaid Refill" },
  { price: "$29.95", highlight: "Prepaid Refill" },
  { price: "$12", highlight: "Prepaid Refill" },
  { price: "$10", highlight: "Prepaid Refill" },
];

const PagePlus = () => (
  <CarrierPage
    apiSlug="pageplus"
    name="Page Plus"
    logo={pageplusLogo}
    brandColor="hsl(0,70%,50%)"
    staticPlans={staticPlans}
    trademark="Page Plus® is a registered trademark. All carrier names and trademarks are property of their respective owners."
  />
);

export default PagePlus;
