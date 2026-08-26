import PlanTabs from "@/app/components/plan/PlanTabs";

export default function PassportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <PlanTabs active="passport" />
      {children}
    </div>
  );
}
