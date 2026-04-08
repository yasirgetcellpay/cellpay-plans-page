import lycaLogo from "@/assets/lyca-logo.webp";
import { CarrierPage } from "@/components/CarrierPage";

const staticPlans = [
  { price: "$39", highlight: "Prepaid Refill" },
  { price: "$29", highlight: "Prepaid Refill" },
  { price: "$23", highlight: "Prepaid Refill" },
  { price: "$19", highlight: "Prepaid Refill" },
  { price: "$10", highlight: "Prepaid Refill" },
];

const Lyca = () => (
  <CarrierPage
    apiSlug="lyca"
    name="Lyca Mobile"
    logo={lycaLogo}
    brandColor="hsl(220,50%,22%)"
    staticPlans={staticPlans}
    trademark="Lyca Mobile® is a registered trademark. All carrier names and trademarks are property of their respective owners."
  />
);

export default Lyca;
