import { apiError, json, readJsonBody, withApi } from '@/lib/api.server';
import { pocketbaseAdmin } from '@/lib/pocketbase-client.server';
import logger from '@/lib/logger.server';

const pocketbaseUrl = () => process.env.POCKETBASE_URL || 'http://localhost:8090';

type CalendlyUser = { id: string; email: string; role: string };

/** Validates the caller's PocketBase token by refreshing it server-side. */
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
	email?: string;
	reschedule_url?: string;
	cancel_url?: string;
	uri?: string;
};

/** GETs a Calendly v2 API resource with the server-side token. */
async function calendlyGet(uri: string, token: string): Promise<CalendlyResource> {
	const res = await fetch(uri, {
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
	});
	if (!res.ok) {
		throw new Error(`calendly ${uri} ${res.status} ${res.statusText}`);
	}
	const body = (await res.json()) as { resource?: CalendlyResource; collection?: CalendlyResource[] };
	return body.resource ?? {};
}

/** GETs a Calendly collection endpoint (e.g. invitees list). */
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

/**
 * Resolves the invitee for a Calendly event. The embed widget's
 * `calendly.event_scheduled` postMessage only carries the event URI (not the
 * invitee URI), so when `inviteeUri` is missing we list the event's invitees
 * and pick the one matching the caller's email (falling back to the first).
 */
async function resolveInvitee(
	eventUri: string,
	inviteeUri: string | undefined,
	callerEmail: string,
	token: string,
): Promise<{ uri: string; email: string; rescheduleUrl: string; cancelUrl: string }> {
	let invitee: CalendlyResource | undefined;

	if (inviteeUri) {
		invitee = await calendlyGet(inviteeUri, token);
	} else {
		const invitees = await calendlyList(`${eventUri}/invitees`, token);
		const wanted = callerEmail.toLowerCase().trim();
		invitee =
			invitees.find((i) => (i.email || '').toLowerCase().trim() === wanted) ||
			invitees[0];
	}

	return {
		uri: invitee?.uri || inviteeUri || '',
		email: invitee?.email || '',
		rescheduleUrl: invitee?.reschedule_url || '',
		cancelUrl: invitee?.cancel_url || '',
	};
}

/**
 * POST /api/calendly/booked — records a Calendly appointment the signed-in
 * client just booked. The client forwards the event URI from the Calendly
 * `calendly.event_scheduled` window message (the invitee URI is optional — the
 * embed payload often omits it). The server fetches the event + invitee with
 * the server-side CALENDLY_TOKEN, verifies the invitee email matches the
 * caller, and stores the rendezvous on the client profile.
 *
 * If CALENDLY_TOKEN is absent or the Calendly API fails, the booking is still
 * acknowledged to the client (with a fallback message) and the admin is
 * notified so they can enter the date manually. The step is NOT advanced.
 */
export const action = withApi(async ({ request }) => {
	const header = request.headers.get('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
	if (!token) return apiError(401, 'Non authentifié');

	const caller = await resolveCaller(token);

	const body = await readJsonBody<{ event_uri?: string; invitee_uri?: string }>(request).catch(() => ({ event_uri: undefined, invitee_uri: undefined }));
	const eventUri = (body.event_uri || '').trim();
	const inviteeUri = (body.invitee_uri || '').trim();
	if (!eventUri) return apiError(422, 'URI Calendly manquante.');
	if (!eventUri.startsWith('https://api.calendly.com/')) {
		return apiError(422, 'URI Calendly invalide.');
	}
	if (inviteeUri && !inviteeUri.startsWith('https://api.calendly.com/')) {
		return apiError(422, 'URI Calendly invalide.');
	}

	const result = await pocketbaseAdmin.listRecords('client_profiles', { filter: `owner = "${caller.id}"` });
	const profile = result.items[0] as { id: string; company_name?: string; rdv_event_uri?: string; rdv_debut?: string } | undefined;
	if (!profile) return apiError(404, 'Profil client introuvable.');

	const calendlyToken = process.env.CALENDLY_TOKEN;

	// Fallback: no token — tell the client it's booked, notify the admin.
	if (!calendlyToken) {
		logger.warn('CALENDLY_TOKEN absent — rendez-vous enregistré sans détails Calendly');
		await pocketbaseAdmin.createRecord('calendly_notifications', {
			action: 'manual',
			client_email: caller.email,
			company_name: profile.company_name || '',
			profile_id: profile.id,
			rdv_debut: '',
			rdv_lieu: '',
			admin_note: 'CALENDLY_TOKEN absent — saisir la date du rendez-vous manuellement.',
		});
		return json({
			ok: true,
			fallback: true,
			message: 'Votre rendez-vous est bien réservé, vous avez reçu la confirmation par email.',
		});
	}

	try {
		const eventRes = await calendlyGet(eventUri, calendlyToken);
		const invitee = await resolveInvitee(eventUri, inviteeUri || undefined, caller.email, calendlyToken);

		// If we resolved an invitee email, it must match the caller.
		if (invitee.email && invitee.email.toLowerCase().trim() !== caller.email.toLowerCase().trim()) {
			return apiError(403, "L’email de l’invité ne correspond pas au client connecté.");
		}

		const startTime = eventRes.start_time || '';
		const endTime = eventRes.end_time || '';
		const status = eventRes.status === 'canceled' ? 'canceled' : 'active';
		const lieu = locationToString(eventRes.location);

		// Detect reschedule vs new booking (same event URI, changed start time).
		let actionLabel: 'booked' | 'rescheduled' = 'booked';
		if (profile.rdv_event_uri === eventUri && profile.rdv_debut && profile.rdv_debut !== startTime) {
			actionLabel = 'rescheduled';
		}

		await pocketbaseAdmin.updateRecord('client_profiles', profile.id, {
			rdv_debut: startTime,
			rdv_fin: endTime,
			rdv_statut: status,
			rdv_lieu: lieu,
			rdv_lien_modifier: invitee.rescheduleUrl,
			rdv_lien_annuler: invitee.cancelUrl,
			rdv_event_uri: eventUri,
			rdv_invitee_uri: invitee.uri,
		});

		await pocketbaseAdmin.createRecord('calendly_notifications', {
			action: actionLabel,
			client_email: caller.email,
			company_name: profile.company_name || '',
			profile_id: profile.id,
			rdv_debut: startTime,
			rdv_lieu: lieu,
			admin_note: '',
		});

		return json({ ok: true, refreshed: true });
	} catch (err) {
		logger.error('calendly booked failed', String(err));
		await pocketbaseAdmin.createRecord('calendly_notifications', {
			action: 'manual',
			client_email: caller.email,
			company_name: profile.company_name || '',
			profile_id: profile.id,
			rdv_debut: '',
			rdv_lieu: '',
			admin_note: 'Échec de l’API Calendly — saisir la date du rendez-vous manuellement.',
		});
		return json({
			ok: true,
			fallback: true,
			message: 'Votre rendez-vous est bien réservé, vous avez reçu la confirmation par email.',
		});
	}
});
