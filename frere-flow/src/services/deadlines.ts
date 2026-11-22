import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import type { AppState, Credit, ID, PaymentMethod } from "@/types";
import { addCreditPayment, manualCredit, BusinessError, nextId } from "./ops";

const round = (n: number) => Math.round(n * 1000) / 1000;
export const dateKey = (date: Date) => format(date, "yyyy-MM-dd");
export function deadlineStatus(s: AppState, c: Credit, today: string) {
  if (
    c.deadlineCancelled ||
    s.creditStatuses.find((x) => x.id === c.creditStatusId)?.code === "CANCELLED"
  )
    return "CANCELLED";
  if (c.remainingAmount === 0) return "PAID";
  const days = differenceInCalendarDays(parseISO(c.dueDate), parseISO(today));
  return days < 0 ? "OVERDUE" : days <= 3 ? "SOON" : "UPCOMING";
}
export function deadlineSource(s: AppState, c: Credit) {
  const sale = s.sales.find((x) => x.id === c.saleId);
  const trip = s.marketTrips.find((x) => x.id === sale?.marketTripId);
  return {
    frigoIds: trip
      ? [...new Set(trip.loads.map((x) => x.frigoId))]
      : [sale?.frigoId ?? c.frigoId].filter((id): id is string => !!id),
    marketId: trip?.marketId ?? c.marketId,
  };
}
export function remindersToday(s: AppState, credits: Credit[], today: string) {
  return credits.filter((c) => {
    const status = deadlineStatus(s, c, today);
    const days = differenceInCalendarDays(parseISO(c.dueDate), parseISO(today));
    return (
      !["PAID", "CANCELLED"].includes(status) &&
      days <= (c.reminderDays ?? 3) &&
      !c.reminderHistory?.some((r) => r.date.slice(0, 10) === today && r.dueDate === c.dueDate)
    );
  });
}
function validDate(date: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !isValid(parseISO(date)) ||
    dateKey(parseISO(date)) !== date
  )
    throw new BusinessError("تاريخ الاستحقاق غير صالح");
}
function validLead(days: number) {
  if (!Number.isInteger(days) || days < 0 || days > 365)
    throw new BusinessError("مدة التذكير غير صالحة");
}
function audit(s: AppState, id: ID, userId: ID, date: string, action: string, details: string) {
  s.auditLogs.unshift({
    id: nextId(s, "log"),
    userId,
    date,
    entity: "دين",
    entityId: id,
    action,
    details,
  });
}
export interface DeadlineInput {
  clientId: ID;
  teamId: ID;
  frigoId?: ID;
  marketId?: ID;
  amount: number;
  dueDate: string;
  reminderDays: number;
  notes: string;
}
export function createDeadline(
  prev: AppState,
  inp: DeadlineInput,
  userId: ID,
  date: string,
): AppState {
  validDate(inp.dueDate);
  validLead(inp.reminderDays);
  const client = prev.clients.find((x) => x.id === inp.clientId && x.active);
  if (!client) throw new BusinessError("العميل غير موجود");
  if (!prev.teams.some((x) => x.id === inp.teamId && x.active))
    throw new BusinessError("فريق فيغو والمبلغ مطلوبان");
  if (!Number.isFinite(inp.amount) || round(inp.amount) <= 0)
    throw new BusinessError("المبلغ غير صالح");
  if (!!inp.frigoId === !!inp.marketId) throw new BusinessError("اختر غرفة تبريد أو سوقاً");
  if (inp.frigoId && !prev.frigos.some((x) => x.id === inp.frigoId && x.active))
    throw new BusinessError("اختر غرفة تبريد أو سوقاً");
  if (
    inp.marketId &&
    (!prev.markets.some((x) => x.id === inp.marketId && x.active) ||
      client.marketId !== inp.marketId)
  )
    throw new BusinessError("العميل غير تابع لهذا السوق");
  const s = manualCredit(prev, { ...inp, amount: round(inp.amount) }, userId, date);
  const c = s.credits[0];
  if (!c) throw new BusinessError("الدين غير موجود");
  Object.assign(c, {
    frigoId: inp.frigoId,
    marketId: inp.marketId,
    reminderDays: inp.reminderDays,
  });
  return s;
}
export function updateDeadline(
  prev: AppState,
  inp: {
    creditId: ID;
    dueDate: string;
    amount: number;
    reminderDays: number;
    notes: string;
    reason: string;
  },
  userId: ID,
  date: string,
): AppState {
  const s = structuredClone(prev);
  const c = s.credits.find((x) => x.id === inp.creditId);
  if (!c) throw new BusinessError("الدين غير موجود");
  if (deadlineStatus(s, c, date.slice(0, 10)) === "CANCELLED")
    throw new BusinessError("الاستحقاق ملغى");
  validDate(inp.dueDate);
  validLead(inp.reminderDays);
  if (c.dueDate !== inp.dueDate && !inp.reason.trim())
    throw new BusinessError("سبب تغيير التاريخ مطلوب");
  if (!Number.isFinite(inp.amount) || inp.amount <= 0 || round(inp.amount) < c.paidAmount)
    throw new BusinessError("المبلغ أقل من المدفوع");
  if (c.saleId && round(inp.amount) !== c.totalAmount)
    throw new BusinessError("مبلغ البيع ثابت، أضف دفعة");
  const before = `${c.dueDate} · ${c.totalAmount}`;
  c.dueDate = inp.dueDate;
  c.totalAmount = round(inp.amount);
  c.remainingAmount = round(c.totalAmount - c.paidAmount);
  c.reminderDays = inp.reminderDays;
  c.notes = inp.notes;
  const code = c.remainingAmount === 0 ? "PAID" : c.paidAmount > 0 ? "PARTIAL" : "ACTIVE";
  const status = s.creditStatuses.find((x) => x.code === code);
  if (status) c.creditStatusId = status.id;
  audit(
    s,
    c.id,
    userId,
    date,
    "تعديل الاستحقاق",
    `${before} → ${c.dueDate} · ${c.totalAmount} · ${inp.reason}`,
  );
  return s;
}
export function payDeadline(
  prev: AppState,
  inp: { creditId: ID; amount: number; method: PaymentMethod; notes: string },
  userId: ID,
  date: string,
): AppState {
  const c = prev.credits.find((x) => x.id === inp.creditId);
  if (!c || ["PAID", "CANCELLED"].includes(deadlineStatus(prev, c, date.slice(0, 10))))
    throw new BusinessError("الاستحقاق مسدد أو ملغى");
  if (!Number.isFinite(inp.amount)) throw new BusinessError("المبلغ غير صالح");
  return addCreditPayment(prev, inp, userId, date);
}
export function markReminder(prev: AppState, creditId: ID, userId: ID, date: string): AppState {
  const s = structuredClone(prev);
  const c = s.credits.find((x) => x.id === creditId);
  if (!c || ["PAID", "CANCELLED"].includes(deadlineStatus(s, c, date.slice(0, 10))))
    throw new BusinessError("الاستحقاق مسدد أو ملغى");
  c.reminderHistory ??= [];
  if (
    c.reminderHistory.some(
      (x) => x.date.slice(0, 10) === date.slice(0, 10) && x.dueDate === c.dueDate,
    )
  )
    return prev;
  c.reminderHistory.unshift({ date, userId, dueDate: c.dueDate });
  audit(s, c.id, userId, date, "تمت متابعة العميل", c.dueDate);
  return s;
}
export function cancelDeadline(
  prev: AppState,
  creditId: ID,
  reason: string,
  userId: ID,
  date: string,
): AppState {
  const s = structuredClone(prev);
  const c = s.credits.find((x) => x.id === creditId);
  if (!c) throw new BusinessError("الدين غير موجود");
  if (!reason.trim()) throw new BusinessError("سبب الإلغاء مطلوب");
  c.deadlineCancelled = true;
  audit(s, c.id, userId, date, "إلغاء الاستحقاق", reason);
  return s;
}
