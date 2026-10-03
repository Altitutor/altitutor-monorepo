"use client";
import { useRouter } from "next/navigation";
import { AdminShiftDetailView } from "@/features/admin-shifts/components/AdminShiftDetailView";
export default function AdminShiftPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  return <AdminShiftDetailView isOpen adminShiftId={params.id} onClose={() => router.push("/admin-shifts")} onAdminShiftUpdated={() => {}} />;
}
