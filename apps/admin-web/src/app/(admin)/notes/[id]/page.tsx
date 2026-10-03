"use client";
import { AccessoryRoute } from "@/shared/components/accessory-panel/AccessoryRoute";
export default function Page({ params }: { params: { id: string } }) { return <AccessoryRoute href={`/notes/${params.id}`} />; }
