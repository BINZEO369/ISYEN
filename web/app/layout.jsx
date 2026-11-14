import "../styles/globals.css";
import SiteChrome from "../components/SiteChrome";

export const metadata = {
  title: "নিবাস · ISYEN Smart Home",
  description:
    "আপনার স্মার্ট হোমের gateway, আলো, device ও sensor এক জায়গা থেকে পরিচালনা করুন।",
  applicationName: "ISYEN Home",
};

export const viewport = {
  themeColor: "#101d32",
};

export default function RootLayout({ children }) {
  return (
    <html lang="bn">
      <body>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
