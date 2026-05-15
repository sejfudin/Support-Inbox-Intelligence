export const isTicketTrackingTime = (ticket, statusTracksTime) => {
  if (typeof statusTracksTime === 'function') {
    return statusTracksTime(ticket?.status);
  }
  return ticket?.status?.toLowerCase() === 'in progress';
};

export const getTicketTimeSpentSeconds = (ticket, statusTracksTime) => {
  let seconds = Number(ticket?.totalTimeSpent) || 0;

  if (isTicketTrackingTime(ticket, statusTracksTime) && ticket?.inProgressAt) {
    const inProgressAt = new Date(ticket.inProgressAt).getTime();
    if (!Number.isNaN(inProgressAt)) {
      seconds += Math.max(0, Math.floor((Date.now() - inProgressAt) / 1000));
    }
  }

  return seconds;
};
