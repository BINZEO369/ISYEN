import "../styles/globals.css";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata = {
  title: "ISYEN Smart Home",
  description:
    "Manage your smart-home gateways, lighting, devices, and sensors from one place.",
  applicationName: "ISYEN Home",
};

export const viewport = {
  themeColor: "#f6f6f6",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
