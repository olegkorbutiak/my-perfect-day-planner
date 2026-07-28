import { Suspense } from "react";
import { NavigationScreen } from "@/components/navigation-screen";

export default function NavigationPage() {
  return (
    <Suspense fallback={null}>
      <NavigationScreen />
    </Suspense>
  );
}
