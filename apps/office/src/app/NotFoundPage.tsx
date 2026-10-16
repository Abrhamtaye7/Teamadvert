import { SearchX } from "lucide-react";
import { ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/display";

export default function NotFoundPage() {
  return <EmptyState icon={SearchX} title="Page not found" description="That page doesn't exist or was moved." action={<ButtonLink to="/">Go to dashboard</ButtonLink>} />;
}
