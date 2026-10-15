import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ArrowUpRight, Check, Mail, RotateCcw } from 'lucide-react';
import { businessTypes, needs } from '@/data/site-content';

type FormState = {
	business_name: string;
	business_type: string;
	location: string;
	contact_name: string;
	email: string;
	phone: string;
	message: string;
};

const initialForm: FormState = {
	business_name: '',
	business_type: '',
	location: '',
	contact_name: '',
	email: '',
	phone: '',
	message: '',
};

type Phase = 'form' | 'success';

export function Contact() {
	const [form, setForm] = useState<FormState>(initialForm);
	const [selectedPacks, setSelectedPacks] = useState<string[]>([]);
	const [phase, setPhase] = useState<Phase>('form');
	const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');
	const [validation, setValidation] = useState('');
	const [apiError, setApiError] = useState('');

	const update = (field: keyof FormState, value: string) => {
		setForm(current => ({ ...current, [field]: value }));
		setValidation('');
		setApiError('');
	};
	const togglePack = (pack: string) => {
		setSelectedPacks(current => current.includes(pack) ? current.filter(p => p !== pack) : [...current, pack]);
		setValidation('');
	};

	const buildPayload = () => ({
		business_name: form.business_name,
		business_type: form.business_type,
		needs: selectedPacks.join(' | '),
		location: form.location,
		contact_name: form.contact_name,
		email: form.email,
		phone: form.phone,
		message: form.message,
	});

	async function submitForm(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!form.business_type || selectedPacks.length === 0) {
			setValidation('Choisissez votre activité et au moins une formule.');
			return;
		}
		if (!form.email) {
			setValidation('Une adresse e-mail est requise.');
			return;
		}
		setStatus('sending');
		setApiError('');
		try {
			const response = await fetch('/api/inquiry', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildPayload()),
			});
			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				setStatus('error');
				setApiError(data?.error || "L'envoi de votre demande a échoué. Veuillez réessayer.");
				return;
			}
			setPhase('success');
			setForm(initialForm);
			setSelectedPacks([]);
			setStatus('idle');
		} catch {
			setStatus('error');
			setApiError("L'envoi de votre demande a échoué. Veuillez réessayer.");
		}
	}

	return (
		<section className="contact-section section-pad" id="contact" aria-labelledby="contact-title">
			<div className="contact-layout">
				<div className="contact-intro">
					<span className="section-kicker">03 — ON EN PARLE ?</span>
					<h2 id="contact-title">Votre prochaine<br />belle adresse <em>en ligne.</em></h2>
					<p>Parlez-nous de votre commerce et de ce dont vous avez besoin. Un premier pas, sans engagement, vers un site qui vous ressemble.</p>
					<p>Nous vous recontactons sous 48&nbsp;h maximum, et la mise en place de votre site se fait en 5&nbsp;jours maximum.</p>
					<div className="contact-email">
						<span className="email-icon"><Mail size={22} strokeWidth={1.7} /></span>
						<div>
							<span>Vous préférez nous écrire ?</span>
							<a href="mailto:contact@monentrepriselocale.fr">contact@monentrepriselocale.fr <ArrowUpRight size={16} /></a>
						</div>
					</div>
					<div className="contact-account-cta">
						<p>Vous préférez commencer les démarches dès maintenant&nbsp;?</p>
						<Link to="/signup" className="button-primary">Créer mon espace client <ArrowUpRight size={18} /></Link>
					</div>
					<div className="contact-deco" aria-hidden="true">
						<span>ICI, VOTRE PROJET PREND FORME.</span>
						<ArrowRight size={80} strokeWidth={0.6} />
					</div>
				</div>

				<div className="form-panel">
					{phase === 'success' ? (
						<div className="success-state" role="status">
							<span className="success-icon"><Check size={30} /></span>
							<span className="form-overline">DEMANDE ENVOYÉE</span>
							<h3>Merci pour votre confiance !</h3>
							<p>Votre demande a été transmise. Nous reviendrons vers vous dès que possible pour parler de votre projet.</p>
							<p>Un e-mail de confirmation vient de vous être envoyé. <strong>Pensez à vérifier votre boîte de réception, et au cas où, vos courriers indésirables ou spams</strong> : il pourrait s'y trouver.</p>
							<button type="button" onClick={() => setPhase('form')} className="button-primary">Envoyer une autre demande <RotateCcw size={17} /></button>
						</div>
					) : (
						<form onSubmit={submitForm}>
							<div className="form-heading">
								<span className="form-overline">PARLONS DE VOTRE PROJET</span>
								<h3>Quelques détails, et c’est parti.</h3>
								<p>Les champs marqués d’un * sont obligatoires.</p>
							</div>
							<fieldset className="form-fieldset">
								<legend>Votre activité *</legend>
								<div className="choice-list">
									{businessTypes.map(type => (
										<button key={type} type="button" className={form.business_type === type ? 'choice active' : 'choice'} aria-pressed={form.business_type === type} onClick={() => update('business_type', type)}>{type}</button>
									))}
								</div>
							</fieldset>
							<fieldset className="form-fieldset">
								<legend>Votre projet * <span className="legend-hint">Plusieurs choix possibles</span></legend>
								<div className="choice-list">
									{needs.map(need => (
										<button key={need} type="button" className={selectedPacks.includes(need) ? 'choice active' : 'choice'} aria-pressed={selectedPacks.includes(need)} onClick={() => togglePack(need)}>{need}</button>
									))}
								</div>
							</fieldset>
							<div className="form-grid">
								<label>Nom du commerce *<input required maxLength={200} value={form.business_name} onChange={e => update('business_name', e.target.value)} placeholder="Ex. Le Salon de Camille" /></label>
								<label>Ville ou localisation *<input required maxLength={200} value={form.location} onChange={e => update('location', e.target.value)} placeholder="Ex. Bordeaux" /></label>
								<label>Votre nom *<input required maxLength={200} value={form.contact_name} onChange={e => update('contact_name', e.target.value)} placeholder="Votre prénom et nom" /></label>
								<label>Adresse e-mail *<input type="email" required value={form.email} onChange={e => update('email', e.target.value)} placeholder="vous@exemple.fr" /></label>
								<label>Téléphone *<input type="tel" required maxLength={50} value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="06 00 00 00 00" /></label>
								<label className="full-width">Un mot sur votre projet <span className="optional">(facultatif)</span><textarea maxLength={3000} rows={3} value={form.message} onChange={e => update('message', e.target.value)} placeholder="Parlez-nous de vos envies, de votre commerce…" /></label>
							</div>

							{validation && <p className="form-error" role="alert">{validation}</p>}
							{apiError && <p className="form-error" role="alert">{apiError}</p>}
							{status === 'error' && !apiError && <p className="form-error" role="alert">Une erreur est survenue. Veuillez réessayer ou nous écrire directement par e-mail.</p>}
							<div className="form-bottom">
								<p>Votre demande nous sera transmise directement, sans vérification par e-mail.</p>
								<button className="button-primary" type="submit" disabled={status === 'sending'}>
									{status === 'sending' ? 'Envoi en cours…' : 'Envoyer ma demande'} <ArrowUpRight size={18} />
								</button>
							</div>
						</form>
					)}
				</div>
			</div>
		</section>
	);
}
