import { json, apiError, withApi, readJsonBody } from '@/lib/api.server';
import pocketbaseAdmin from '@/lib/pocketbase-client.server';
import logger from '@/lib/logger.server';

type VerifyStart = {
	intent: 'start';
	channel: 'email' | 'sms';
	contact: string;
	payload: Record<string, unknown>;
};

type VerifyConfirm = {
	intent: 'confirm';
	id: string;
	code: string;
};

type VerifyBody = VerifyStart | VerifyConfirm;

const CODE_VALIDITY_MS = 10 * 60 * 1000;

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendSms = async (to: string, message: string) => {
	const url = process.env.SMS_GATEWAY_URL;
	const token = process.env.SMS_GATEWAY_TOKEN;
	const sender = process.env.SMS_GATEWAY_SENDER || 'MonEntreprise';

	if (!url || !token) {
		throw apiError(
			503,
			"L'envoi par SMS n'est pas encore disponible. Choisissez la vérification par e-mail.",
		);
	}

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ to, sender, message }),
	});

	if (!response.ok) {
		const detail = await response.text().catch(() => '');
		logger.error(`SMS gateway returned ${response.status}`, detail);
		throw new Error(`SMS gateway returned ${response.status} ${response.statusText}`);
	}
};

export const action = withApi(async ({ request }) => {
	const body = await readJsonBody<VerifyBody>(request);

	if (body.intent === 'start') {
		const { channel, contact, payload } = body;

		if (channel !== 'email' && channel !== 'sms') {
			return apiError(422, 'Canal de vérification invalide.');
		}
		if (!contact || contact.length > 200) {
			return apiError(422, 'Un destinataire valide est requis pour la vérification.');
		}
		if (!payload || typeof payload !== 'object') {
			return apiError(422, 'Les données du formulaire sont manquantes.');
		}

		const code = generateCode();
		const expires = new Date(Date.now() + CODE_VALIDITY_MS).toISOString();

		// SMS delivery happens before we confirm to the client, so a gateway
		// failure surfaces as an error the visitor can act on. Email delivery
		// is handled by the PocketBase hook that fires on this create.
		if (channel === 'sms') {
			try {
				await sendSms(contact, `Votre code de vérification Mon Entreprise Locale : ${code}`);
			} catch (error) {
				if (error instanceof Response) {
					return error;
				}
				return apiError(503, "L'envoi du SMS a échoué. Choisissez la vérification par e-mail.");
			}
		}

		const record = await pocketbaseAdmin.createRecord<{ id: string }>('verifications', {
			channel,
			contact,
			payload,
			code,
			expires,
			verified: false,
		});

		return json({ id: record.id, channel, contact });
	}

	if (body.intent === 'confirm') {
		const { id, code } = body;

		if (!id || !code) {
			return apiError(422, 'Identifiant de vérification et code sont requis.');
		}

		const verification = await pocketbaseAdmin.getRecord<{
			code: string;
			expires: string;
			verified: boolean;
			payload: Record<string, unknown>;
		}>('verifications', id);

		if (verification.verified) {
			return apiError(400, 'Ce code a déjà été utilisé.');
		}

		if (Date.now() > new Date(verification.expires).getTime()) {
			return apiError(400, 'Ce code a expiré. Demandez un nouveau code.');
		}

		if (String(verification.code) !== String(code).trim()) {
			return apiError(400, 'Code incorrect. Vérifiez le code saisi.');
		}

		// Code is valid: create the real inquiry. The existing
		// inquiry-notification hook then emails contact@monentrepriselocale.fr.
		await pocketbaseAdmin.createRecord('inquiries', verification.payload);
		await pocketbaseAdmin.updateRecord('verifications', id, { verified: true });

		return json({ ok: true });
	}

	return apiError(400, 'Intent de vérification inconnu.');
});
