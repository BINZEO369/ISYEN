import Image from "next/image";
import Link from "next/link";
import styles from "./home.module.css";

export const metadata = {
  title: "ISYEN Smart Home | Your Home, One Dashboard",
  description:
    "View and manage your gateways, devices, and sensors in one place with the ISYEN Smart Home dashboard.",
};

const features = [
  {
    kind: "gateway",
    title: "Gateways and Nodes",
    text: "View and manage gateways and connected Sub Nodes from one place.",
  },
  {
    kind: "device",
    title: "Simple Device Control",
    text: "Turn supported devices on or off from the dashboard.",
  },
  {
    kind: "sensor",
    title: "Sensor Reading",
    text: "See the latest sensor readings at a glance.",
  },
  {
    kind: "account",
    title: "Your Dashboard",
    text: "Sign in to your account to manage your smart home.",
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
              Your home,
              <br />
              <span>all in one dashboard.</span>
            </h1>
            <p className={styles.heroText}>
              Manage your smart-home gateways, devices, and sensors, and
              view everything together in one simple place.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/signin">
                Sign in <span aria-hidden="true">→</span>
              </Link>
              <Link className={styles.secondaryButton} href="/dashboard">
                Open Dashboard
              </Link>
            </div>
            <div className={styles.heroNote}>
              New here? <Link href="/signup">Create an account</Link>
            </div>
            <div className={styles.quickTags} aria-label="Platform features">
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
                alt="A comfortable modern living room with warm lighting"
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
                  <strong>Your home, under your control</strong>
                  <small>View and manage everything in one place</small>
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
              <p className={styles.eyebrow}>Simple, all in one place</p>
              <h2>Everything you need for a smart home</h2>
            </div>
            <p>
              Skip the app switching—see your connected devices and sensors in one
              clear dashboard.
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
              alt="A smart-home sensor and switch installed on a wall"
              fill
              sizes="(max-width: 760px) 100vw, 43vw"
            />
            <span className={styles.detailImageTag}>AT A GLANCE</span>
          </div>
          <div className={styles.detailCopy}>
            <p className={styles.eyebrow}>Connected to your home</p>
            <h2>Find what you need, easily</h2>
            <p>
              Sign in to manage your gateways and devices, and
              view the latest readings from connected sensors.
            </p>
            <ul className={styles.detailList}>
              <li><span>✓</span> Gateways and Sub Nodes in one place</li>
              <li><span>✓</span> On/off control for supported devices</li>
              <li><span>✓</span> Latest sensor readings</li>
            </ul>
            <Link className={styles.inlineLink} href="/signup">
              Create an account to get started <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.container + " " + styles.finalCtaInner}>
          <div>
            <p className={styles.eyebrow}>ISYEN SMART HOME</p>
            <h2>Start your smart home here.</h2>
            <p>Sign in or create an account to start using your dashboard.</p>
          </div>
          <div className={styles.finalActions}>
            <Link className={styles.finalPrimary} href="/signin">Sign in</Link>
            <Link className={styles.finalSecondary} href="/signup">Create account</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
