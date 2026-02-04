export default function PageLayout({ title, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="flex-1 p-6 md:p-8">
        {title && <h1 className="text-2xl font-bold mb-6">{title}</h1>}
        {children}
      </div>
    </div>
  );
}
