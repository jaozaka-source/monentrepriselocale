import { type RouteConfig, index, route, layout } from '@react-router/dev/routes';

export default [
  layout('routes/marketing-layout.tsx', [
    index('routes/home.tsx'),
  ]),
  route('sitemap.xml', 'routes/sitemap.xml.ts'),
  route('robots.txt', 'routes/robots.txt.ts'),

  // Public legal pages
  route('mentions-legales', 'routes/mentions-legales.tsx'),
  route('conditions-utilisation', 'routes/conditions-utilisation.tsx'),
  route('politique-de-confidentialite', 'routes/politique-de-confidentialite.tsx'),
  route('formulaire-retractation', 'routes/formulaire-retractation.tsx'),

  // Auth pages
  route('login', 'routes/login.tsx'),
  route('signup', 'routes/signup.tsx'),
  route('forgot-password', 'routes/forgot-password.tsx'),

  // Client space (protected — layout guards with requireAuth)
  route('espace', 'routes/espace/layout.tsx', [
    index('routes/espace/dashboard.tsx'),
    route('etapes/:step', 'routes/espace/etape.tsx'),
    route('informations', 'routes/espace/informations.tsx'),
    route('documents', 'routes/espace/documents.tsx'),
    route('abonnement', 'routes/espace/abonnement.tsx'),
    route('tickets', 'routes/espace/tickets.tsx'),
    route('tickets/:id', 'routes/espace/ticket-detail.tsx'),
    route('admin', 'routes/espace/admin/layout.tsx', [
      index('routes/espace/admin/index.tsx'),
      route('clients', 'routes/espace/admin/clients.tsx'),
      route('clients/:id', 'routes/espace/admin/client.tsx'),
      route('tickets', 'routes/espace/admin/tickets.tsx'),
      route('tickets/:id', 'routes/espace/admin/ticket-detail.tsx'),
      route('stripe-events', 'routes/espace/admin/stripe-events.tsx'),
      route('settings', 'routes/espace/admin/settings.tsx'),
    ]),
  ]),

  // API routes
  route('api/health', 'routes/api.health.ts'),
  route('api/verify', 'routes/api.verify.ts'),
  route('api/inquiry', 'routes/api.inquiry.ts'),
  route('api/siren', 'routes/api.siren.ts'),
  route('api/auth/sync-role', 'routes/api.auth.sync-role.ts'),
  route('api/auth/google', 'routes/api.auth.google.ts'),
  route('api/auth/google/callback', 'routes/api.auth.google.callback.ts'),
  route('api/auth/google/health', 'routes/api.auth.google.health.ts'),
  route('api/steps/advance', 'routes/api.steps.advance.ts'),
  route('api/calendly/booked', 'routes/api.calendly.booked.ts'),
  route('api/calendly/status', 'routes/api.calendly.status.ts'),
  route('api/contract', 'routes/api.contract.ts'),
  route('api/stripe/checkout', 'routes/api.stripe.checkout.ts'),
  route('api/stripe/webhook', 'routes/api.stripe.webhook.ts'),
  route('api/stripe/portal', 'routes/api.stripe.portal.ts'),
  route('api/stripe/manage', 'routes/api.stripe.manage.ts'),
  route('api/stripe/status', 'routes/api.stripe.status.ts'),
  route('api/stripe/verify-payment', 'routes/api.stripe.verify-payment.ts'),
  route('api/stripe/resync', 'routes/api.stripe.resync.ts'),
  route('api/admin/stripe', 'routes/api.admin.stripe.ts'),
  route('api/ecommerce/subscriptions', 'routes/api.ecommerce.subscriptions.ts'),
  route('api/ecommerce/subscriptions/manage', 'routes/api.ecommerce.subscriptions.manage.ts'),
  route('api/*', 'routes/api.$.ts'),
] satisfies RouteConfig;
