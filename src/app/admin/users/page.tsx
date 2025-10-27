import UserManagementPanel from "@/components/UserManagementPanel";

export default function AdminUsersPage() {
  return (
    <div className="container mx-auto px-6 flex flex-col items-center justify-center py-16 md:py-24">
      <UserManagementPanel />
    </div>
  );
}
