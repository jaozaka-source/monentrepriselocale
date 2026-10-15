import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, Send, ArrowLeft, Image as ImageIcon, Download } from 'lucide-react';
import pb from '@/lib/pocketbase-client';
import type { RecordModel } from 'pocketbase';
import { useAuth } from '@/hooks/use-auth';

const CATEGORY_LABELS: Record<string, string> = {
  site_inaccessible: 'Site inaccessible',
  display_error: 'Erreur d’affichage',
  content_modification: 'Modification de contenu',
  question: 'Question',
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  blocking: { label: 'Bloquant', color: 'var(--logo-red)' },
  annoying: { label: 'Gênant', color: '#b8860b' },
  minor: { label: 'Mineur', color: 'var(--ink-muted)' },
};

const STATUS_OPTIONS = [
  { value: 'open', label: 'Ouvert' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'resolved', label: 'Résolu' },
  { value: 'closed', label: 'Fermé' },
];

const STATUS_LABELS: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]));

function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function TicketThread({ ticketId, isAdmin }: { ticketId: string; isAdmin: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<RecordModel | null>(null);
  const [messages, setMessages] = useState<RecordModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    try {
      const t = await pb.collection('tickets').getOne(ticketId, { requestKey: null });
      setTicket(t);
      const msgs = await pb.collection('ticket_messages').getFullList({
        filter: `ticket = "${ticketId}"`,
        sort: 'created',
        requestKey: null,
      });
      setMessages(msgs);
    } catch {
      setError('Ticket introuvable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [ticketId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !user) return;
    setSending(true);
    setError('');
    try {
      const rec = await pb.collection('ticket_messages').create({
        ticket: ticketId,
        owner: user.id,
        author_role: isAdmin ? 'admin' : 'client',
        message: reply.trim(),
      });
      setMessages((prev) => [...prev, rec]);
      setReply('');
    } catch {
      setError("L’envoi du message a échoué.");
    }
    setSending(false);
  };

  const changeStatus = async (status: string) => {
    if (!ticket || ticket.status === status) return;
    setStatusBusy(true);
    setError('');
    try {
      const rec = await pb.collection('tickets').update(ticketId, { status });
      setTicket(rec);
    } catch {
      setError("Le changement de statut a échoué.");
    }
    setStatusBusy(false);
  };

  const openScreenshot = async () => {
    if (!ticket?.screenshot) return;
    try {
      const token = await pb.files.getToken();
      const url = pb.files.getURL(ticket, String(ticket.screenshot), { token });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Le lien de la capture n’a pas pu être généré.');
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" style={{ color: 'var(--blue)' }} /></div>;
  }

  if (!ticket) {
    return (
      <div className="espace-alert espace-alert-error">
        {error || 'Ticket introuvable.'}{' '}
        <button type="button" className="espace-btn espace-btn-ghost" style={{ marginLeft: 12 }} onClick={() => navigate(isAdmin ? '/espace/admin/tickets' : '/espace/tickets')}>
          Retour
        </button>
      </div>
    );
  }

  const isClosed = ticket.status === 'closed';

  return (
    <>
      <button type="button" onClick={() => navigate(isAdmin ? '/espace/admin/tickets' : '/espace/tickets')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-muted)', fontWeight: 600, marginBottom: 16, background: 'none', border: 0 }}>
        <ArrowLeft size={15} /> Retour aux tickets
      </button>

      <div className="espace-card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 12 }}>{ticket.subject}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <span className="espace-alert espace-alert-info" style={{ padding: '4px 10px', fontSize: 11 }}>{CATEGORY_LABELS[String(ticket.category)] || ticket.category}</span>
          <span style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, color: (PRIORITY_LABELS[String(ticket.priority)] || { color: 'var(--ink-muted)' }).color }}>
            {(PRIORITY_LABELS[String(ticket.priority)] || { label: ticket.priority }).label}
          </span>
          <span className="espace-alert espace-alert-success" style={{ padding: '4px 10px', fontSize: 11 }}>{STATUS_LABELS[String(ticket.status)] || ticket.status}</span>
        </div>
        <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.7, margin: 0 }}>{ticket.message}</p>
        {ticket.screenshot ? (
          <button type="button" onClick={openScreenshot} className="espace-btn espace-btn-secondary" style={{ marginTop: 14 }}>
            <ImageIcon size={15} /> Voir la capture d’écran <Download size={14} />
          </button>
        ) : null}

        {isAdmin ? (
          <div className="espace-field" style={{ marginTop: 18, maxWidth: 240 }}>
            <label>Changer le statut</label>
            <select className="espace-select" value={String(ticket.status)} onChange={(e) => changeStatus(e.target.value)} disabled={statusBusy}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        ) : null}
      </div>

      <div className="espace-card">
        <h2>Conversation ({messages.length})</h2>
        {messages.length === 0 ? (
          <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>Aucun message pour l’instant. {isAdmin ? 'Répondez au client ci-dessous.' : 'Notre équipe vous répondra ici.'}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            {messages.map((m) => {
              const mine = isAdmin ? m.author_role === 'admin' : m.author_role === 'client';
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '75%', background: mine ? 'var(--blue)' : '#eef4fa', color: mine ? '#fff' : 'var(--navy)', padding: '12px 16px', borderRadius: 12, borderBottomRightRadius: mine ? 3 : 12, borderBottomLeftRadius: mine ? 12 : 3 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4, opacity: 0.85 }}>
                      {m.author_role === 'admin' ? 'Support' : 'Vous'}
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{String(m.message)}</div>
                    <div style={{ fontSize: 10, marginTop: 6, opacity: 0.7 }}>{formatDateTime(String(m.created))}</div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {error ? <div className="espace-alert espace-alert-error" style={{ marginBottom: 14 }}>{error}</div> : null}

        {isClosed && !isAdmin ? (
          <div className="espace-alert espace-alert-info">Ce ticket est fermé. Si le problème persiste, créez un nouveau ticket.</div>
        ) : (
          <form onSubmit={sendReply} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div className="espace-field" style={{ flex: 1 }}>
              <textarea className="espace-textarea" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Votre message…" style={{ minHeight: 60 }} />
            </div>
            <button type="submit" className="espace-btn" disabled={sending || !reply.trim()} style={{ flex: 'none' }}>
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Envoyer
            </button>
          </form>
        )}
      </div>
    </>
  );
}
