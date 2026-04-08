import tracfoneLogo from "@/assets/tracfone-logo.svg";
import { CarrierPage } from "@/components/CarrierPage";

const staticPlans = [
  { price: "$79.99", highlight: "Prepaid Refill" },
  { price: "$49.99", highlight: "Prepaid Refill" },
  { price: "$39.99", highlight: "Prepaid Refill" },
  { price: "$29.99", highlight: "Prepaid Refill" },
  { price: "$19.99", highlight: "Prepaid Refill" },
];

const Tracfone = () => (
  <CarrierPage
    apiSlug="tracfone"
    name="TracFone"
    logo={tracfoneLogo}
    brandColor="hsl(230,70%,30%)"
    staticPlans={staticPlans}
    trademark="TracFone® is a registered trademark of TracFone Wireless, Inc. All carrier names and trademarks are property of their respective owners."
  />
);

export default Tracfone;
