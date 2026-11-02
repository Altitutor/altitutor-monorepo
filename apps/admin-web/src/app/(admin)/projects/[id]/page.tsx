"use client";;
import { use } from "react";
import { AccessoryRoute } from "@/shared/components/accessory-panel/AccessoryRoute";
export default function Page(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return <AccessoryRoute href={`/projects/${params.id}`} />;
}
