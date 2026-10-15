import pb from '@/lib/pocketbase-client';
import type { RecordModel } from 'pocketbase';
import { STEPS, PHASES, stepIndex } from '@/data/steps';

export type AdminProfile = RecordModel & {
  owner: string;
  current_step: string;
  company_name?: string;
  siren?: string;
  hq_address?: string;
  pack?: string;
  pack_billing?: string;
  subscription_status?: string;
  stripe_customer_id?: string;
  payment_alert?: boolean;
  mockup_url?: string;
  live_site_url?: string;
  internal_notes?: string;
  meeting_date?: string;
  rdv_debut?: string;
  rdv_fin?: string;
  rdv_statut?: string;
  rdv_lieu?: string;
  rdv_lien_modifier?: string;
  rdv_lien_annuler?: string;
  rdv_event_uri?: string;
  statut_paiement?: string;
  last_payment_date?: string;
  last_payment_amount?: number;
  created?: string;
  expand?: { owner?: { email?: string; name?: string }; pack?: RecordModel };
};

export type AdminClient = AdminProfile & {
  city?: string;
  packName?: string;
  openTickets: number;
  stepEnteredAt: string;
  daysInStep: number;
};

const STALL_DAYS = 7;

function cityFromAddress(address?: string): string {
  if (!address) return '';
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] || parts[0] || '';
}

/** Loads all client profiles with their owner + pack expanded. */
export async function fetchAdminProfiles(): Promise<AdminProfile[]> {
  const records = await pb.collection('client_profiles').getFullList({
    expand: 'owner,pack',
    sort: '-created',
    requestKey: null,
  });
  return records as unknown as AdminProfile[];
}

/** Loads open ticket counts per owner. */
export async function fetchOpenTicketCounts(): Promise<Record<string, number>> {
  const tickets = await pb.collection('tickets').getFullList({
    filter: 'status = "open" || status = "in_progress"',
    requestKey: null,
  });
  const counts: Record<string, number> = {};
  for (const t of tickets) {
    const owner = String((t as RecordModel).owner || '');
    counts[owner] = (counts[owner] || 0) + 1;
  }
  return counts;
}

/** Loads the latest step_history entry per owner (entry date into current step). */
export async function fetchStepEntryDates(): Promise<Record<string, string>> {
  const history = await pb.collection('step_history').getFullList({
    sort: '-created',
    requestKey: null,
  });
  const latest: Record<string, string> = {};
  for (const h of history) {
    const owner = String((h as RecordModel).owner || '');
    if (!latest[owner]) {
      latest[owner] = String((h as RecordModel).created || '');
    }
  }
  return latest;
}

/** Builds the enriched client list for the portfolio + dashboard. */
export async function fetchAdminClients(): Promise<AdminClient[]> {
  const [profiles, ticketCounts, entryDates] = await Promise.all([
    fetchAdminProfiles(),
    fetchOpenTicketCounts().catch(() => ({} as Record<string, number>)),
    fetchStepEntryDates().catch(() => ({} as Record<string, string>)),
  ]);

  const now = Date.now();
  return profiles.map((p) => {
    const enteredAt = entryDates[p.owner] || p.created || '';
    const enteredMs = enteredAt ? new Date(enteredAt).getTime() : now;
    const daysInStep = Math.floor((now - enteredMs) / (24 * 60 * 60 * 1000));
    return {
      ...p,
      city: cityFromAddress(p.hq_address),
      packName: p.expand?.pack?.name || '',
      openTickets: ticketCounts[p.owner] || 0,
      stepEnteredAt: enteredAt,
      daysInStep: Number.isFinite(daysInStep) ? daysInStep : 0,
    };
  });
}

export function phaseNumberOfStep(step: string): number {
  const def = STEPS.find((s) => s.code === step);
  return def?.phase ?? 0;
}

export function phaseTitle(n: number): string {
  return PHASES.find((p) => p.n === n)?.title ?? '';
}

export function isStalled(client: AdminClient): boolean {
  return client.daysInStep >= STALL_DAYS;
}

export const STALL_THRESHOLD_DAYS = STALL_DAYS;

export function countByPhase(clients: AdminClient[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const c of clients) {
    const n = phaseNumberOfStep(c.current_step);
    counts[n] = (counts[n] || 0) + 1;
  }
  return counts;
}

export { stepIndex };
