import { json, apiError, withApi, readJsonBody } from '@/lib/api.server';
import pocketbaseAdmin from '@/lib/pocketbase-client.server';

type InquiryBody = {
	business_name?: string;
	business_type?: string;
	needs?: string;
	location?: string;
	contact_name?: string;
	email?: string;
	phone?: string;
	message?: string;
};

export const action = withApi(async ({ request }) => {
	const body = await readJsonBody<InquiryBody>(request);

	if (!body || typeof body !== 'object') {
		return apiError(422, 'Les données du formulaire sont manquantes.');
	}

	if (!body.business_type) {
		return apiError(422, "Veuillez choisir votre type d'activité.");
	}
	if (!body.needs) {
		return apiError(422, 'Veuillez choisir au moins une formule.');
	}
	if (!body.email || body.email.length > 200) {
		return apiError(422, 'Une adresse e-mail valide est requise.');
	}
	if (!body.phone || body.phone.length > 50) {
		return apiError(422, 'Un numéro de téléphone valide est requis.');
	}

	// Creates the inquiry directly. The existing inquiry-notification hook
	// then emails contact@monentrepriselocale.fr — no verification step.
	await pocketbaseAdmin.createRecord('inquiries', {
		business_name: body.business_name ?? '',
		business_type: body.business_type,
		needs: body.needs,
		location: body.location ?? '',
		contact_name: body.contact_name ?? '',
		email: body.email,
		phone: body.phone,
		message: body.message ?? '',
	});

	return json({ ok: true });
});
