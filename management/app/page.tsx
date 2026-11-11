export default function HomePage() {
  return (
    <main className="shell min-h-screen flex flex-col items-center justify-center">
      <section className="placeholder" aria-labelledby="title">
        <span className="brand-mark" aria-hidden="true">I<span>.</span></span>
        <p className="eyebrow">ISYEN · MANAGEMENT</p>
        <h1 id="title">ম্যানেজমেন্ট প্যানেল</h1>
        <p className="description">নতুন অ্যাপ স্ক্যাফোল্ড প্রস্তুত। এই প্যাকেজে এখনো কোনো ড্যাশবোর্ড, অথেনটিকেশন বা API ইন্টিগ্রেশন যুক্ত করা হয়নি।</p>
        <span className="status-label"><span className="status-dot" />স্ক্যাফোল্ড প্রস্তুত</span>
      </section>
      <footer>Next.js 15 <span>·</span> React 19 <span>·</span> TypeScript <span>·</span> Tailwind CSS v3</footer>
    </main>
  );
}
