export default function PageHeader({ children }) {
  return (
    <header className="shrink-0 border-b bg-white">
      <div>{children}</div>
    </header>
  );
}
