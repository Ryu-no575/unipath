import ExploreTabsClient from "@/app/components/explore/ExploreTabsClient";

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <ExploreTabsClient />
      {children}
    </div>
  );
}
