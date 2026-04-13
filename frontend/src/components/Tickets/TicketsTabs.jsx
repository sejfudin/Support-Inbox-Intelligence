import { STATUS_TABS } from "@/helpers/ticketStatus";

export default function TicketsTabs({ activeTab, onChange, rightSlot, bottomSlot }) {
  return (
    <div className="app-page-content pt-4">
      <div className="app-panel-soft overflow-hidden rounded-[1.35rem] px-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-6 overflow-x-auto">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => onChange(tab.key)}
                    className={`flex flex-shrink-0 items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? "border-primary text-primary"
                        : "border-transparent text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {rightSlot ? (
              <div className="hidden shrink-0 md:flex md:items-center md:justify-end">
                {rightSlot}
              </div>
            ) : null}
          </div>

          {rightSlot ? <div className="pb-1 md:hidden">{rightSlot}</div> : null}
          {bottomSlot ? <div className="pb-3">{bottomSlot}</div> : null}
        </div>
      </div>
    </div>
  );
}
