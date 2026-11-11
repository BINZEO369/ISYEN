import type { Metadata } from "next";
import { SignInForm } from "../../components/sign-in-form";

export const metadata: Metadata = {
  title: "সাইন ইন — ISYEN",
  description: "আপনার ISYEN স্মার্ট হোম অ্যাকাউন্টে সাইন ইন করুন।",
};

export default function SignInPage() {
  return <SignInForm />;
}
