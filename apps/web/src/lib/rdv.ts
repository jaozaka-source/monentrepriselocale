// Helpers for the Calendly rendezvous (step 3.1). Pure functions, no JSX.

export type RdvInfo = {
	/** ISO start time (Calendly) or YYYY-MM-DD (admin manual entry). */
	debut: string;
	fin?: string;
	lieu?: string;
	lienModifier?: string;
	lienAnnuler?: string;
	statut?: string;
	/** 'calendly' = booked via the widget; 'manual' = admin-entered date. */
	source: 'calendly' | 'manual';
};

type RdvProfile = Record<string, any> & {
	rdv_statut?: string;
	rdv_debut?: string;
	rdv_fin?: string;
	rdv_lieu?: string;
	rdv_lien_modifier?: string;
	rdv_lien_annuler?: string;
	rdv_event_uri?: string;
	meeting_date?: string;
};

/**
 * Resolves the rendezvous to display to the client. Priority:
 *  1. An active (non-canceled) Calendly appointment.
 *  2. An admin-entered meeting_date (phone-booked appointment).
 *  3. null → show the booking widget.
 */
export function getRdvInfo(profile: RdvProfile): RdvInfo | null {
	if (profile.rdv_debut && profile.rdv_statut !== 'canceled') {
		return {
			debut: profile.rdv_debut,
			fin: profile.rdv_fin,
			lieu: profile.rdv_lieu,
			lienModifier: profile.rdv_lien_modifier,
			lienAnnuler: profile.rdv_lien_annuler,
			statut: profile.rdv_statut,
			source: 'calendly',
		};
	}
	if (profile.meeting_date) {
		return { debut: profile.meeting_date, source: 'manual' };
	}
	return null;
}

function capitalize(s: string): string {
	return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** "Jeudi 16 octobre 2026 à 14h30 (heure de Paris)" — for Calendly datetimes. */
export function formatRdvDateFr(iso: string): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const dateStr = new Intl.DateTimeFormat('fr-FR', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Europe/Paris',
	}).format(d);
	const timeStr = new Intl.DateTimeFormat('fr-FR', {
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Europe/Paris',
	}).format(d);
	return `${capitalize(dateStr)} à ${timeStr} (heure de Paris)`;
}

/** "Jeudi 16 octobre 2026" — for admin-entered dates (no time). */
export function formatRdvDateFrManual(iso: string): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const dateStr = new Intl.DateTimeFormat('fr-FR', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Europe/Paris',
	}).format(d);
	return capitalize(dateStr);
}

/** Short table-friendly date, e.g. "16/10/2026 14:30" or "16/10/2026". */
export function formatRdvShort(rdv: RdvInfo | null): string {
	if (!rdv) return '—';
	const d = new Date(rdv.debut);
	if (Number.isNaN(d.getTime())) return '—';
	if (rdv.source === 'manual') {
		return new Intl.DateTimeFormat('fr-FR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			timeZone: 'Europe/Paris',
		}).format(d);
	}
	return new Intl.DateTimeFormat('fr-FR', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Europe/Paris',
	}).format(d);
}
