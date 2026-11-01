import { Suspense } from "react";
import { SubsidiesTable } from "@/features/subsidies/components/SubsidiesTable";

export default function SubsidiesPage() {
  return (
    <div className="p-6">

      <Suspense fallback={null}>
        <SubsidiesTable />
      </Suspense>
    </div>
  );
}
