import Image from "next/image";
import Link from "next/link";
import styles from "./home.module.css";

export const metadata = {
  title: "ISYEN Smart Home | আপনার ঘর, এক ড্যাশবোর্ডে",
  description:
    "Gateway, device ও sensor—ISYEN Smart Home dashboard থেকে এক জায়গায় দেখুন ও পরিচালনা করুন।",
};

const features = [
  {
    kind: "gateway",
    title: "Gateway ও Node",
    text: "Gateway এবং connected Sub Node-গুলো একটি জায়গা থেকে দেখুন ও পরিচালনা করুন।",
  },
  {
    kind: "device",
    title: "সহজ Device Control",
    text: "সমর্থিত device ড্যাশবোর্ড থেকেই চালু বা বন্ধ করুন।",
  },
  {
    kind: "sensor",
    title: "Sensor Reading",
    text: "সেন্সর থেকে পাওয়া সর্বশেষ reading সহজে এক নজরে দেখুন।",
  },
  {
    kind: "account",
    title: "নিজস্ব Dashboard",
    text: "নিজের account-এ sign in করে আপনার smart-home dashboard ব্যবহার করুন।",
  },
];

function FeatureIcon({ kind }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "gateway" && (
        <>
          <rect x="4" y="8" width="16" height="11" rx="2" />
          <path d="M8 8V5m8 3V5M9 13h.01M12 13h.01M15 13h.01M9 16h6" />
        </>
      )}
      {kind === "device" && (
        <>
          <rect x="5" y="3" width="14" height="18" rx="3" />
          <path d="M9 7h6m-5 9 2-3 2 3m-4 2h4" />
        </>
      )}
      {kind === "sensor" && (
        <>
          <path d="M12 20v-7m0 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M5.6 6.6a9 9 0 0 0 0 10.8m12.8 0a9 9 0 0 0 0-10.8M8.4 9.4a5 5 0 0 0 0 5.2m7.2 0a5 5 0 0 0 0-5.2" />
        </>
      )}
      {kind === "account" && (
        <>
          <path d="M12 3 19 6v5c0 4.5-3 7.8-7 10-4-2.2-7-5.5-7-10V6l7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </>
      )}
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.container + " " + styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowDot} /> ISYEN SMART HOME
            </p>
            <h1>
              আপনার ঘর,
              <br />
              <span>এক ড্যাশবোর্ডে।</span>
            </h1>
            <p className={styles.heroText}>
              Gateway, device আর sensor—ঘরের প্রয়োজনীয় smart-home নিয়ন্ত্রণ ও
              তথ্য রাখুন এক সহজ জায়গায়।
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/signin">
                সাইন ইন করুন <span aria-hidden="true">→</span>
              </Link>
              <Link className={styles.secondaryButton} href="/dashboard">
                ড্যাশবোর্ডে যান
              </Link>
            </div>
            <div className={styles.heroNote}>
              নতুন এখানে? <Link href="/signup">অ্যাকাউন্ট তৈরি করুন</Link>
            </div>
            <div className={styles.quickTags} aria-label="প্ল্যাটফর্মের অংশ">
              <span>Gateway</span>
              <span>Devices</span>
              <span>Sensors</span>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.heroImageFrame}>
              <Image
                className={styles.heroImage}
                src="/images/isyen-home-hero-optimized.jpg"
                alt="উষ্ণ আলোয় সাজানো একটি আরামদায়ক আধুনিক বসার ঘর"
                fill
                priority
                sizes="(max-width: 760px) 100vw, 52vw"
              />
              <div className={styles.imageShade} />
              <div className={styles.imageCaption}>
                <span className={styles.captionIcon} aria-hidden="true">
                  <FeatureIcon kind="gateway" />
                </span>
                <span>
                  <strong>আপনার ঘর, আপনার নিয়ন্ত্রণে</strong>
                  <small>এক জায়গা থেকে দেখুন ও পরিচালনা করুন</small>
                </span>
              </div>
              <span className={styles.imageLabel}>CONNECTED LIVING</span>
            </div>
            <div className={styles.visualAccent} aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className={styles.featuresSection} id="features">
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>সহজ, এক জায়গায়</p>
              <h2>স্মার্ট হোমের দরকারি সবকিছু</h2>
            </div>
            <p>
              আলাদা আলাদা screen নয়—ঘরের সংযুক্ত device ও sensor দেখুন একটি
              পরিষ্কার dashboard-এ।
            </p>
          </div>
          <div className={styles.featureGrid}>
            {features.map((feature, index) => (
              <article className={styles.featureCard} key={feature.kind}>
                <div className={styles.featureTop}>
                  <span className={styles.featureIcon}>
                    <FeatureIcon kind={feature.kind} />
                  </span>
                  <span className={styles.featureNumber}>
                    0{index + 1}
                  </span>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.detailSection} id="how-it-works">
        <div className={styles.container + " " + styles.detailGrid}>
          <div className={styles.detailImageFrame}>
            <Image
              className={styles.detailImage}
              src="/images/isyen-home-sensor-optimized.jpg"
              alt="ঘরের দেয়ালে স্থাপিত একটি সাধারণ smart-home sensor ও switch"
              fill
              sizes="(max-width: 760px) 100vw, 43vw"
            />
            <span className={styles.detailImageTag}>AT A GLANCE</span>
          </div>
          <div className={styles.detailCopy}>
            <p className={styles.eyebrow}>ঘরের সঙ্গে সংযুক্ত</p>
            <h2>যা দরকার, তা খুঁজে নিন সহজে</h2>
            <p>
              নিজের account-এ প্রবেশ করে gateway ও device পরিচালনা করুন, আর
              connected sensor-এর সর্বশেষ reading দেখুন।
            </p>
            <ul className={styles.detailList}>
              <li><span>✓</span> Gateway ও Sub Node একসাথে</li>
              <li><span>✓</span> সমর্থিত device-এর on/off control</li>
              <li><span>✓</span> সর্বশেষ sensor reading</li>
            </ul>
            <Link className={styles.inlineLink} href="/signup">
              শুরু করতে অ্যাকাউন্ট তৈরি করুন <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.container + " " + styles.finalCtaInner}>
          <div>
            <p className={styles.eyebrow}>ISYEN SMART HOME</p>
            <h2>আপনার smart home শুরু হোক এখান থেকে।</h2>
            <p>সাইন ইন করুন, অথবা নতুন account খুলে dashboard ব্যবহার শুরু করুন।</p>
          </div>
          <div className={styles.finalActions}>
            <Link className={styles.finalPrimary} href="/signin">সাইন ইন</Link>
            <Link className={styles.finalSecondary} href="/signup">অ্যাকাউন্ট তৈরি</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
