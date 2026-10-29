import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmailPrototype } from "@/features/email/prototype/components/EmailPrototype";
import { NativeMailPrototype } from "@/features/email/prototype/components/NativeMailPrototype";

export default function Page({ searchParams }: { searchParams: { native?: string } }) {
  if (process.env.NODE_ENV === "production") notFound();
  if (searchParams.native === "1") return <NativeMailPrototype />;
  return <Suspense fallback={null}><EmailPrototype /></Suspense>;
}
