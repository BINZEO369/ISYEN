import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link href="/" className="brand-lockup"><span className="brand-icon" aria-hidden="true">ই</span><span className="brand-name">ISYEN<span>.</span></span></Link>
        <nav aria-label="প্রধান নেভিগেশন"><Link href="/sign-in">সাইন ইন</Link><Link className="nav-cta" href="/register">অ্যাকাউন্ট তৈরি করুন <span aria-hidden="true">↗</span></Link></nav>
      </header>
      <section className="landing-hero">
        <div className="landing-copy">
          <span className="section-eyebrow"><i className="eyebrow-dot" />আপনার স্মার্ট হোম, এক ছন্দে</span>
          <h1>ঘরের যত্নে<br /><em>আরও একটু</em> স্বস্তি।</h1>
          <p>আলো, আরাম ও নিরাপত্তা—আপনার ঘরের সবকিছু এক সহজ জায়গায়, আপনার নিজের নিয়ন্ত্রণে।</p>
          <div className="landing-actions"><Link className="primary-button landing-primary" href="/register">শুরু করুন <span aria-hidden="true">→</span></Link><Link className="secondary-link" href="/sign-in">আগে থেকেই অ্যাকাউন্ট আছে? <strong>সাইন ইন</strong></Link></div>
          <div className="landing-trust"><span className="trust-icon" aria-hidden="true">✓</span><span>সহজ সেটআপ</span><span className="trust-divider" /><span>ব্যক্তিগত ডেটা সুরক্ষিত</span></div>
        </div>
        <div className="landing-art" aria-hidden="true">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <div className="room-card">
            <div className="room-topline"><span>MY HOME</span><span className="room-live"><i /> LIVE</span></div>
            <div className="room-window"><div className="window-glow" /><div className="window-frame"><i /><i /><i /><i /></div><div className="room-hill hill-one" /><div className="room-hill hill-two" /></div>
            <div className="room-info"><div><span>আপনার বাড়ি</span><strong>শান্তির ঠিকানা</strong></div><span className="weather">২৬°<small>🌤</small></span></div>
            <div className="room-controls"><div className="control-tile"><span className="control-symbol light-symbol">✳</span><small>আলো</small><strong>চালু</strong><div className="control-track"><i /></div></div><div className="control-tile"><span className="control-symbol temp-symbol">◒</span><small>তাপমাত্রা</small><strong>২৪°</strong><div className="temperature-track"><i /></div></div><div className="control-tile"><span className="control-symbol lock-symbol">⌑</span><small>নিরাপত্তা</small><strong>সুরক্ষিত</strong><span className="safe-status">● সক্রিয়</span></div></div>
          </div>
          <div className="art-floating-note"><span className="floating-spark">✳</span><div><strong>সব ঠিক আছে</strong><small>আপনার ঘর নিরাপদ</small></div></div>
          <span className="art-plant plant-left"><i /><i /><i /><b /></span><span className="art-plant plant-right"><i /><i /><i /><b /></span>
        </div>
      </section>
      <footer className="landing-footer"><span>ISYEN · আপনার ঘরের ছন্দ</span><span>আরাম থেকে নিরাপত্তা—সব আপনার হাতে।</span></footer>
    </main>
  );
}
