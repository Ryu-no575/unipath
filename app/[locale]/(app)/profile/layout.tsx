import ProfileTabsClient from "@/app/components/profile/ProfileTabsClient";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <ProfileTabsClient />
      {children}
    </div>
  );
}
