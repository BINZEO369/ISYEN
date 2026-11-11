import type { Metadata } from "next";
import { AccountPage } from "../../components/account-page";

export const metadata: Metadata = {
  title: "অ্যাকাউন্ট — ISYEN",
  description: "আপনার ISYEN অ্যাকাউন্টের তথ্য, ঠিকানা, পছন্দ ও নোটিফিকেশন সেটিংস দেখুন।",
};

export default function AccountRoute() {
  return <AccountPage />;
}
