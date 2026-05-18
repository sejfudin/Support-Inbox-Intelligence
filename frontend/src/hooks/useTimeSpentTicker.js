import { useEffect, useState } from 'react';
import { isTicketTrackingTime } from '@/helpers/ticketTimeSpent';

export const useTimeSpentTicker = (tickets = [], statusTracksTime, intervalMs = 30000) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const hasActiveTimer = tickets.some((ticket) => isTicketTrackingTime(ticket, statusTracksTime));

    if (!hasActiveTimer) return undefined;

    const id = setInterval(() => {
      setTick((value) => value + 1);
    }, intervalMs);

    return () => clearInterval(id);
  }, [tickets, statusTracksTime, intervalMs]);

  return tick;
};
