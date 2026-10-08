import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FaceGate — Admin",
  description: "Employee management and attendance reports",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
