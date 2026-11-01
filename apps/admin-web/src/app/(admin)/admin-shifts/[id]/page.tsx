"use client";;
import { use } from "react";
import { useRouter } from "next/navigation";
import { AdminShiftDetailView } from "@/features/admin-shifts/components/AdminShiftDetailView";
export default function AdminShiftPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  return <AdminShiftDetailView isOpen adminShiftId={params.id} onClose={() => router.push("/classes?view=calendar&show_admin_shifts=1")} onAdminShiftUpdated={() => {}} />;
}
