import type { Metadata } from "next";
import { Dashboard } from "../../components/dashboard";

export const metadata: Metadata = {
  title: "আপনার ISYEN — Dashboard",
  description: "আপনার ISYEN প্রোফাইল ও স্মার্ট হোম account status।",
};

export default function DashboardPage() {
  return <Dashboard />;
}
