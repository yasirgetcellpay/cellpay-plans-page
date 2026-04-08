import cricketLogo from "@/assets/cricket-logo.webp";
import { CarrierPage } from "@/components/CarrierPage";

const staticPlans = [
  { price: "$60", highlight: "Prepaid Refill" },
  { price: "$55", highlight: "Prepaid Refill" },
  { price: "$50", highlight: "Prepaid Refill" },
  { price: "$40", highlight: "Prepaid Refill" },
  { price: "$30", highlight: "Prepaid Refill" },
];

const Cricket = () => (
  <CarrierPage
    apiSlug="topup-crc"
    name="Cricket Wireless"
    logo={cricketLogo}
    brandColor="hsl(82,60%,42%)"
    staticPlans={staticPlans}
    termsUrl="https://www.cricketwireless.com/terms"
    trademark="Cricket Wireless® is a registered trademark of Cricket Communications, Inc. All carrier names and trademarks are property of their respective owners."
  />
);

export default Cricket;
