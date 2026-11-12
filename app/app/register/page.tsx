import type { Metadata } from "next";
import { RegisterForm } from "../../components/register-form";

export const metadata: Metadata = {
  title: "অ্যাকাউন্ট তৈরি — ISYEN",
  description: "ISYEN স্মার্ট হোম অ্যাকাউন্ট খুলুন এবং আপনার প্রোফাইল সেট করুন।",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
