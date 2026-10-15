import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, Video, Clock, CheckCircle2, Loader2, MapPin, ExternalLink, XCircle, RefreshCw } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import { useClientData } from '@/components/espace/client-data-context';
import type { ClientProfile } from '@/lib/client-steps';
import { getRdvInfo, formatRdvDateFr, formatRdvDateFrManual } from '@/lib/rdv';

const CALENDLY_URL = 'https://calendly.com/monentrepriselocale/30min';
const CALENDLY_SCRIPT = 'https://assets.calendly.com/assets/external/widget.js';

/** Builds the Calendly URL with the client's name/email prefilled + utm tags. */
function buildCalendlyUrl(): string {
	const record = pb.authStore.record;
	const params = new URLSearchParams();
	if (record?.name) params.set('name', record.name);
	if (record?.email) params.set('email', record.email);
	params.set('utm_source', 'espace-client');
	params.set('utm_content', record?.id || '');
	return `${CALENDLY_URL}?${params.toString()}`;
}

type BookedPayload = {
	event?: { uri?: string };
	invitee?: { uri?: string };
};

export function Rencontre({ profile }: { profile: ClientProfile }) {
	const { refresh } = useClientData();
	const widgetRef = useRef<HTMLDivElement>(null);
	const [syncing, setSyncing] = useState(false);
	const [bookingState, setBookingState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
	const [fallbackMsg, setFallbackMsg] = useState('');

	const rdv = getRdvInfo(profile);
	const hasActiveRdv = Boolean(rdv);
	const calendlyUrl = buildCalendlyUrl();

	// Load the Calendly widget script and (re)initialise the inline widget
	// whenever the widget is visible. Calendly.initInlineWidget guarantees the
	// widget renders on every page open rather than relying on a static div.
	useEffect(() => {
		if (hasActiveRdv) return;

		let existing = document.querySelector<HTMLScriptElement>(`script[src="${CALENDLY_SCRIPT}"]`);
		if (!existing) {
			existing = document.createElement('script');
			existing.src = CALENDLY_SCRIPT;
			existing.async = true;
			document.body.appendChild(existing);
		}

		const init = () => {
			if (window.Calendly?.initInlineWidget && widgetRef.current) {
				widgetRef.current.innerHTML = '';
				window.Calendly.initInlineWidget({
					url: calendlyUrl,
					parentElement: widgetRef.current,
				});
			}
		};

		if (window.Calendly) {
			init();
		} else {
			existing.addEventListener('load', init);
		}

		return () => {
			if (existing) existing.removeEventListener('load', init);
		};
	}, [hasActiveRdv, calendlyUrl]);

	// Re-read the rendezvous status from Calendly so a cancellation or
	// reschedule done outside the app (via the Calendly modify/cancel links,
	// which open in a new tab) is reflected. Only when a Calendly appointment
	// exists. Runs on mount and whenever the user returns to this tab.
	const syncStatus = useCallback(() => {
		if (!profile.rdv_event_uri) return;
		setSyncing(true);
		fetch('/api/calendly/status', {
			method: 'POST',
			headers: { Authorization: `Bearer ${pb.authStore.token}` },
		})
			.then(async (res) => {
				if (!res.ok) return;
				const data = (await res.json()) as { refreshed?: boolean };
				if (data.refreshed) void refresh();
			})
			.catch(() => {})
			.finally(() => setSyncing(false));
	}, [profile.rdv_event_uri, refresh]);

	useEffect(() => {
		syncStatus();
		// Re-sync when the user comes back to this tab after using the
		// Calendly reschedule/cancel link (opened in another tab).
		const onFocus = () => syncStatus();
		const onVisibility = () => {
			if (document.visibilityState === 'visible') syncStatus();
		};
		window.addEventListener('focus', onFocus);
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			window.removeEventListener('focus', onFocus);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}, [syncStatus]);

	// Listen for the Calendly booking event (origin calendly.com only) and
	// forward the event URI to the server. The embed payload only carries the
	// event URI; the invitee URI is optional and usually absent — the server
	// resolves the invitee from the event's invitees list when it is missing.
	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			if (event.origin !== 'https://calendly.com') return;
			const data = event.data as { event?: string; payload?: BookedPayload } | null;
			if (!data || data.event !== 'calendly.event_scheduled') return;

			const payload = data.payload || {};
			const eventUri = payload.event?.uri;
			const inviteeUri = payload.invitee?.uri;
			if (!eventUri) return;

			setBookingState('saving');
			fetch('/api/calendly/booked', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${pb.authStore.token}`,
				},
				body: JSON.stringify({ event_uri: eventUri, invitee_uri: inviteeUri || undefined }),
			})
				.then(async (res) => {
					const body = (await res.json().catch(() => ({}))) as { ok?: boolean; fallback?: boolean; message?: string };
					if (!res.ok || !body.ok) throw new Error('fail');
					if (body.fallback) {
						setFallbackMsg(body.message || 'Votre rendez-vous est bien réservé, vous avez reçu la confirmation par email.');
						setBookingState('done');
					} else {
						setFallbackMsg('');
						setBookingState('done');
						void refresh();
					}
				})
				.catch(() => setBookingState('error'));
		};

		window.addEventListener('message', onMessage);
		return () => window.removeEventListener('message', onMessage);
	}, [refresh]);

	const dateLabel = rdv
		? rdv.source === 'manual'
			? formatRdvDateFrManual(rdv.debut)
			: formatRdvDateFr(rdv.debut)
		: '';

	return (
		<div className="espace-card" style={{ marginBottom: 20 }}>
			<h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
				<Video size={20} style={{ color: 'var(--blue)' }} /> Rencontre avec notre équipe
				{syncing ? (
					<Loader2 size={15} className="animate-spin" style={{ color: 'var(--ink-muted)', marginLeft: 'auto' }} />
				) : null}
			</h2>
			<p style={{ fontSize: 15, color: 'var(--ink-muted)', lineHeight: 1.7, margin: '0 0 8px' }}>
				Un échange de 30 minutes en visioconférence pour comprendre votre activité, vos attentes et
				vos contraintes. Nous y abordons le style visuel souhaité, les pages de votre site et les
				contenus à fournir.
			</p>

			{hasActiveRdv && rdv ? (
				<div className="espace-alert espace-alert-success" style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
					<div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
						<CheckCircle2 size={22} style={{ flex: 'none', marginTop: 1 }} />
						<div>
							<strong>Votre rendez-vous aura lieu le {dateLabel}</strong>
							{rdv.lieu ? (
								<div style={{ fontSize: 13, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
									<MapPin size={14} style={{ flex: 'none' }} />
									{/^https?:\/\//.test(rdv.lieu) ? (
										<a href={rdv.lieu} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
											{rdv.lieu} <ExternalLink size={12} />
										</a>
									) : (
										<span>{rdv.lieu}</span>
									)}
								</div>
							) : null}
							{rdv.source === 'manual' ? (
								<div style={{ fontSize: 12, marginTop: 6, color: 'var(--ink-muted)' }}>
									Rendez-vous fixé par notre équipe. Le lien de connexion vous sera communiqué par e-mail.
								</div>
							) : null}
						</div>
					</div>
					{rdv.source === 'calendly' && (rdv.lienModifier || rdv.lienAnnuler) ? (
						<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingLeft: 34 }}>
							{rdv.lienModifier ? (
								<a href={rdv.lienModifier} target="_blank" rel="noreferrer" className="espace-btn espace-btn-ghost" style={{ fontSize: 13, padding: '9px 16px' }}>
									<RefreshCw size={14} /> Modifier le créneau
								</a>
							) : null}
							{rdv.lienAnnuler ? (
								<a href={rdv.lienAnnuler} target="_blank" rel="noreferrer" className="espace-btn espace-btn-secondary" style={{ fontSize: 13, padding: '9px 16px' }}>
									<XCircle size={14} /> Annuler
								</a>
							) : null}
						</div>
					) : null}
				</div>
			) : (
				<>
					<p style={{ fontSize: 15, color: 'var(--ink-muted)', lineHeight: 1.7, margin: '8px 0 0' }}>
						Choisissez un créneau de 30 minutes pour parler de votre projet. Vous recevrez une
						confirmation par e-mail avec le lien de connexion.
					</p>

					{bookingState === 'saving' ? (
						<div className="espace-alert espace-alert-info" style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
							<Loader2 size={16} className="animate-spin" /> Enregistrement de votre rendez-vous…
						</div>
					) : null}
					{bookingState === 'done' && fallbackMsg ? (
						<div className="espace-alert espace-alert-success" style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
							<CheckCircle2 size={16} /> {fallbackMsg}
						</div>
					) : null}
					{bookingState === 'error' ? (
						<div className="espace-alert espace-alert-error" style={{ marginTop: 16 }}>
							Votre rendez-vous a été pris, mais son enregistrement a échoué. Notre équipe le confirmera prochainement.
						</div>
					) : null}

					<div style={{ marginTop: 22 }}>
						<div
							ref={widgetRef}
							className="calendly-inline-widget"
							data-url={CALENDLY_URL}
							style={{ minWidth: 320, height: 700, borderRadius: 10, overflow: 'hidden' }}
						/>
					</div>

					<p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
						<Calendar size={13} /> Besoin de modifier ou d’annuler votre créneau ? Utilisez le lien reçu par e-mail.
					</p>
				</>
			)}
		</div>
	);
}

declare global {
	interface Window {
		Calendly?: {
			initInlineWidget: (opts: { url: string; parentElement: HTMLElement }) => void;
		};
	}
}
