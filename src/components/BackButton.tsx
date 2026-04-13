import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const BackButton = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate("/")}
      className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 rounded-full hover:bg-muted transition-colors text-foreground"
      aria-label="Go back"
    >
      <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
    </button>
  );
};
