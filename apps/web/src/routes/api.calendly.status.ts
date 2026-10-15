import { apiError, json, withApi } from '@/lib/api.server';
import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';
import logger from '@/lib/logger.server';

const pocketbaseUrl = () => process.env.POCKETBASE_URL || 'http://localhost:8090';

type CalendlyUser = { id: string; email: string; role: string };

async function resolveCaller(token: string): Promise<CalendlyUser> {
	const refresh = await fetch(`${pocketbaseUrl()}/api/collections/users/auth-refresh`, {
		method: 'POST',
		headers: { Authorization: token },
	});
	if (!refresh.ok) {
		throw apiError(401, 'Session invalide');
	}
	const record = (await refresh.json()).record;
	return { id: record.id, email: record.email || '', role: record.role || 'client' };
}

type CalendlyResource = {
	start_time?: string;
	end_time?: string;
	status?: string;
	location?: unknown;
	uri?: string;
	email?: string;
	reschedule_url?: string;
	cancel_url?: string;
};

async function calendlyGet(uri: string, token: string): Promise<CalendlyResource> {
	const res = await fetch(uri, {
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
	});
	if (!res.ok) {
		throw new Error(`calendly ${uri} ${res.status} ${res.statusText}`);
	}
	const body = (await res.json()) as { resource?: CalendlyResource };
	return body.resource ?? {};
}

async function calendlyList(uri: string, token: string): Promise<CalendlyResource[]> {
	const res = await fetch(uri, {
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
	});
	if (!res.ok) {
		throw new Error(`calendly ${uri} ${res.status} ${res.statusText}`);
	}
	const body = (await res.json()) as { collection?: CalendlyResource[] };
	return body.collection ?? [];
}

function locationToString(loc: unknown): string {
	if (!loc) return '';
	if (typeof loc === 'string') return loc;
	if (Array.isArray(loc)) return loc.filter(Boolean).join(' · ');
	if (typeof loc === 'object') {
		const obj = loc as Record<string, unknown>;
		return String(obj.location || obj.join_url || obj.uri || '').trim();
	}
	return '';
}

type RdvProfile = {
	id: string;
	company_name?: string;
	rdv_event_uri?: string;
	rdv_invitee_uri?: string;
	rdv_debut?: string;
	rdv_fin?: string;
	rdv_statut?: string;
	rdv_lieu?: string;
};

/**
 * POST /api/calendly/status — re-reads the rendezvous status from the Calendly
 * API on each visit to step 3.1. Handles three cases:
 *  - the stored event is still active but its start time changed → reschedule;
 *  - the stored event was canceled → look for a newer active event for the same
 *    invitee (a reschedule creates a new event and cancels the old one). If one
 *    is found, switch the profile to it; otherwise mark the RDV canceled so the
 *    booking widget reappears;
 *  - nothing changed → no-op.
 *
 * POST (not GET) because it identifies the caller from their token — a GET
 * would be edge-cached and leak the first caller's data to everyone.
 */
export const action = withApi(async ({ request }) => {
	const header = request.headers.get('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
	if (!token) return apiError(401, 'Non authentifié');

	const caller = await resolveCaller(token);

	const result = await pocketbaseAdmin.listRecords('client_profiles', { filter: `owner = "${caller.id}"` });
	const profile = result.items[0] as RdvProfile | undefined;
	if (!profile) return apiError(404, 'Profil client introuvable.');

	const eventUri = profile.rdv_event_uri;
	if (!eventUri) {
		return json({ hasAppointment: false });
	}

	const calendlyToken = process.env.CALENDLY_TOKEN;
	if (!calendlyToken) {
		return json({ hasAppointment: profile.rdv_statut === 'active', syncFailed: true });
	}

	try {
		const ev = await calendlyGet(eventUri, calendlyToken);
		const status = ev.status === 'canceled' ? 'canceled' : 'active';
		let refreshed = false;
		let actionLabel: 'canceled' | 'rescheduled' | '' = '';

		if (status === 'active') {
			// Same event, new start time → reschedule.
			if (profile.rdv_debut && ev.start_time && profile.rdv_debut !== ev.start_time) {
				await pocketbaseAdmin.updateRecord('client_profiles', profile.id, {
					rdv_debut: ev.start_time,
					rdv_fin: ev.end_time || '',
					rdv_statut: 'active',
					rdv_lieu: locationToString(ev.location),
				});
				actionLabel = 'rescheduled';
				refreshed = true;
			}
		} else {
			// Stored event was canceled. A reschedule creates a new event and
			// cancels the original — try to find the new active event for the
			// same invitee before concluding the RDV was truly canceled.
			const newEvent = await findActiveEventForInvitee(profile.rdv_invitee_uri, calendlyToken);
			if (newEvent) {
				await pocketbaseAdmin.updateRecord('client_profiles', profile.id, {
					rdv_event_uri: newEvent.eventUri,
					rdv_invitee_uri: newEvent.inviteeUri,
					rdv_debut: newEvent.startTime,
					rdv_fin: newEvent.endTime,
					rdv_statut: 'active',
					rdv_lieu: newEvent.lieu,
					rdv_lien_modifier: newEvent.rescheduleUrl,
					rdv_lien_annuler: newEvent.cancelUrl,
				});
				actionLabel = 'rescheduled';
				refreshed = true;
			} else {
				await pocketbaseAdmin.updateRecord('client_profiles', profile.id, { rdv_statut: 'canceled' });
				actionLabel = 'canceled';
				refreshed = true;
			}
		}

		if (actionLabel) {
			await pocketbaseAdmin.createRecord('calendly_notifications', {
				action: actionLabel,
				client_email: caller.email,
				company_name: profile.company_name || '',
				profile_id: profile.id,
				rdv_debut: ev.start_time || '',
				rdv_lieu: locationToString(ev.location),
				admin_note: '',
			});
		}

		const hasAppointment = actionLabel === 'rescheduled'
			? true
			: status === 'active';
		return json({ hasAppointment, refreshed, action: actionLabel });
	} catch (err) {
		logger.error('calendly status failed', String(err));
		return json({ hasAppointment: profile.rdv_statut === 'active', syncFailed: true });
	}
});

/**
 * Searches for an active scheduled event for the given invitee. Calendly's
 * `GET /scheduled_events?invitee={inviteeUri}&status=active` returns the
 * invitee's upcoming events; we pick the soonest and resolve its invitee
 * record for the reschedule/cancel links.
 */
async function findActiveEventForInvitee(
	inviteeUri: string | undefined,
	token: string,
): Promise<{
	eventUri: string;
	inviteeUri: string;
	startTime: string;
	endTime: string;
	lieu: string;
	rescheduleUrl: string;
	cancelUrl: string;
} | null> {
	if (!inviteeUri) return null;

	try {
		const events = await calendlyList(
			`https://api.calendly.com/scheduled_events?invitee=${encodeURIComponent(inviteeUri)}&status=active`,
			token,
		);
		if (events.length === 0) return null;

		// Soonest upcoming event first.
		events.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
		const ev = events[0];
		const eventUri = ev.uri || '';
		if (!eventUri) return null;

		// Resolve the invitee record for this new event to refresh the links.
		const invitees = await calendlyList(`${eventUri}/invitees`, token);
		const invitee = invitees[0];

		return {
			eventUri,
			inviteeUri: invitee?.uri || inviteeUri,
			startTime: ev.start_time || '',
			endTime: ev.end_time || '',
			lieu: locationToString(ev.location),
			rescheduleUrl: invitee?.reschedule_url || '',
			cancelUrl: invitee?.cancel_url || '',
		};
	} catch (err) {
		logger.error('calendly find active event failed', String(err));
		return null;
	}
}
