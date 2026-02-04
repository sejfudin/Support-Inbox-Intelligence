import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useStore, TicketStatus } from '@/app/store';
import { KanbanColumn } from '@/app/components/KanbanColumn';

export const KanbanBoardPage = () => {
  const { tickets } = useStore();

  const columns = [
    { status: 'open', title: 'Open', color: 'bg-blue-50' },
    { status: 'pending', title: 'Pending', color: 'bg-amber-50' },
    { status: 'closed', title: 'Closed', color: 'bg-green-50' },
  ];

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-3 gap-6 h-full">
            {columns.map((column) => (
              <KanbanColumn
                key={column.status}
                status={column.status}
                title={column.title}
                color={column.color}
                tickets={tickets.filter(t => t.status === column.status)}
              />
            ))}
          </div>
        </div>
      </div>
    </DndProvider>
  );
};
