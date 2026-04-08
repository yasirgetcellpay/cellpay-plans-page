import straightTalkLogo from "@/assets/straight-talk-logo.svg";
import { CarrierPage } from "@/components/CarrierPage";

const staticPlans = [
  { price: "$55", highlight: "Prepaid Refill" },
  { price: "$45", highlight: "Prepaid Refill" },
  { price: "$35", highlight: "Prepaid Refill" },
  { price: "$30", highlight: "Prepaid Refill" },
];

const StraightTalk = () => (
  <CarrierPage
    apiSlug="straight-talk"
    name="Straight Talk"
    logo={straightTalkLogo}
    brandColor="hsl(72,74%,44%)"
    staticPlans={staticPlans}
    trademark="Straight Talk® is a registered trademark of TracFone Wireless, Inc. All carrier names and trademarks are property of their respective owners."
  />
);

export default StraightTalk;
