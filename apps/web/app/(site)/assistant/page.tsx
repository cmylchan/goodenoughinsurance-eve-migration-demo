import type { Metadata } from "next";
import { AssistantPage } from "@/app/_components/assistant-page";

export const metadata: Metadata = { title: "Claims Assistant · GoodEnough Insurance" };

export default function Page() {
  return <AssistantPage />;
}
