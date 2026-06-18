export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden bg-white">
      {children}
    </div>
  );
}
