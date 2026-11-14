import "../styles/globals.css";
import SiteChrome from "../components/SiteChrome";

export const metadata = {
  title: "ISYEN Smart Home",
  description:
    "Manage your smart-home gateways, lighting, devices, and sensors from one place.",
  applicationName: "ISYEN Home",
};

export const viewport = {
  themeColor: "#101d32",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
