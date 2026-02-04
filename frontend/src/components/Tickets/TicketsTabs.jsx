import { STATUS_TABS } from "@/helpers/ticketStatus";

export default function TicketsTabs({ activeTab, onChange }) {
  return (
    <div className="border-b bg-white">
      <div className="flex items-center gap-6 overflow-x-auto px-4 sm:px-6 md:px-8">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex flex-shrink-0 items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
