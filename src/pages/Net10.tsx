import net10Logo from "@/assets/net10-logo.png";
import { CarrierPage } from "@/components/CarrierPage";

const staticPlans = [
  { price: "$50", highlight: "Prepaid Refill" },
  { price: "$40", highlight: "Prepaid Refill" },
  { price: "$35", highlight: "Prepaid Refill" },
  { price: "$30", highlight: "Prepaid Refill" },
  { price: "$20", highlight: "Prepaid Refill" },
];

const Net10 = () => (
  <CarrierPage
    apiSlug="net10"
    name="NET10 Wireless"
    logo={net10Logo}
    brandColor="hsl(195,100%,50%)"
    staticPlans={staticPlans}
    trademark="NET10® is a registered trademark of TracFone Wireless, Inc. All carrier names and trademarks are property of their respective owners."
  />
);

export default Net10;
