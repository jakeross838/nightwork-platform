/**
 * Ross Built Payment Schedule:
 * - Received by the 5th → paid the 15th
 * - Received by the 20th → paid the 30th
 * - Received after the 20th → paid the 15th of next month
 * - Weekend/holiday → next business day
 */

function nextBusinessDay(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2); // Saturday → Monday
  if (day === 0) d.setDate(d.getDate() + 1); // Sunday → Monday
  return d;
}

export function computePaymentDate(receivedDate: string): string {
  const received = new Date(receivedDate + "T00:00:00");
  const dayOfMonth = received.getDate();
  const year = received.getFullYear();
  const month = received.getMonth();

  let paymentDate: Date;

  if (dayOfMonth <= 5) {
    paymentDate = new Date(year, month, 15);
  } else if (dayOfMonth <= 20) {
    paymentDate = new Date(year, month, 30);
    // Handle months with fewer than 30 days
    if (paymentDate.getMonth() !== month) {
      paymentDate = new Date(year, month + 1, 0); // Last day of month
    }
  } else {
    // After the 20th → 15th of next month
    paymentDate = new Date(year, month + 1, 15);
  }

  paymentDate = nextBusinessDay(paymentDate);

  return paymentDate.toISOString().split("T")[0];
}
