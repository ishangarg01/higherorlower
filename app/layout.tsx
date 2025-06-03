import type React from "react"
import type { Metadata } from "next"
import { Inter, Barriecito } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

const barriecito = Barriecito({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-barriecito",
})

export const metadata: Metadata = {
  title: "Startup Valuation Game",
  description: "Test your knowledge of startup valuations",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${barriecito.variable}`}>{children}</body>
    </html>
  )
}
