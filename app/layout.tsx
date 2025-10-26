export const metadata = { title: "Patio Quote – Demo", description: "Upload patio photos, get an instant pressure washing quote on-page." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui, Arial', background: '#0b1020', color: '#f2f5ff' }}>
        <div style={{ maxWidth: 880, margin: '40px auto', padding: 16 }}>
          {children}
        </div>
      </body>
    </html>
  );
}