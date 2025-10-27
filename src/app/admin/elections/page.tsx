import ElectionCreationPanel from "@/components/ElectionCreationPanel";

export default function AdminElectionsPage() {
  return (
    <div className="container mx-auto px-6 flex flex-col items-center justify-center py-16 md:py-24">
      <ElectionCreationPanel />
    </div>
  );
}
