import { Suspense } from "react";
import { SubsidiesTable } from "@/features/subsidies/components/SubsidiesTable";

export default function SubsidiesPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Subsidies</h1>
      <Suspense fallback={null}>
        <SubsidiesTable />
      </Suspense>
    </div>
  );
}
