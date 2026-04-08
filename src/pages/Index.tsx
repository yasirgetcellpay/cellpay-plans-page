import simpleMobileLogo from "@/assets/simple-mobile-logo.png";
import { CarrierPage } from "@/components/CarrierPage";

const staticPlans = [
  { price: "$50", highlight: "Prepaid Refill" },
  { price: "$40", highlight: "Prepaid Refill" },
  { price: "$30", highlight: "Prepaid Refill" },
  { price: "$25", highlight: "Prepaid Refill" },
];

const Index = () => (
  <CarrierPage
    apiSlug="s1"
    name="Simple Mobile"
    logo={simpleMobileLogo}
    brandColor="hsl(101,67%,44%)"
    staticPlans={staticPlans}
    trademark="Simple Mobile® is a registered trademark of TracFone Wireless, Inc. All carrier names and trademarks are property of their respective owners."
  />
);

export default Index;
