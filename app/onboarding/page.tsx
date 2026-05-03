import { OnboardingWizard } from "@/components/OnboardingWizard";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8 md:px-10">
      <OnboardingWizard />
    </main>
  );
}
