import { ChevronRight, LifeBuoy, MessageSquare, Plus, Send, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { logTechnicalError, userError } from '../lib/userErrors'
import './seller-support.css'

function formatDate(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  } catch {
    return ''
  }
}

function statusLabel(value) {
  return {
    open: 'Ouvert',
    in_progress: 'En cours',
    waiting_customer: 'Votre réponse est attendue',
    escalated: 'Escaladé',
    resolved: 'Résolu',
    closed: 'Fermé',
  }[value] || value || 'Ouvert'
}

export default function SellerSupportPanel({ store }) {
  const { user, profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const requestedTicket = params.get('ticket') || ''
  const [tickets, setTickets] = useState([])
  const [activeId, setActiveId] = useState(requestedTicket)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  const loadTickets = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setFeedback('')
    try {
      const result = await supabase
        .from('support_tickets')
        .select('id,ticket_number,category,subject,message,status,priority,source,target_user_id,store_id,product_id,created_at,updated_at')
        .order('updated_at', { ascending: false })
        .limit(100)
      if (result.error) throw result.error
      const rows = (result.data || []).filter(ticket => !store?.id || !ticket.store_id || ticket.store_id === store.id)
      setTickets(rows)
      setActiveId(current => {
        if (requestedTicket && rows.some(ticket => ticket.id === requestedTicket)) return requestedTicket
        if (current && rows.some(ticket => ticket.id === current)) return current
        return rows[0]?.id || ''
      })
    } catch (error) {
      logTechnicalError('seller-support-list', error)
      setFeedback(userError(error, 'support'))
    } finally {
      setLoading(false)
    }
  }, [user?.id, store?.id, requestedTicket])

  useEffect(() => { loadTickets() }, [loadTickets])

  const active = useMemo(() => tickets.find(ticket => ticket.id === activeId) || null, [tickets, activeId])

  useEffect(() => {
    if (!activeId || !user?.id) {
      setMessages([])
      return
    }
    let alive = true
    setThreadLoading(true)
    supabase
      .from('support_ticket_messages')
      .select('id,ticket_id,author_id,message,is_internal,created_at')
      .eq('ticket_id', activeId)
      .eq('is_internal', false)
      .order('created_at')
      .then(({ data, error }) => {
        if (!alive) return
        if (error) {
          logTechnicalError('seller-support-thread', error)
          setFeedback(userError(error, 'support'))
          return
        }
        setMessages(data || [])
      })
      .finally(() => { if (alive) setThreadLoading(false) })
    return () => { alive = false }
  }, [activeId, user?.id])

  function openTicket(ticket) {
    setActiveId(ticket.id)
    const next = new URLSearchParams(params)
    next.set('tab', 'support')
    next.set('ticket', ticket.id)
    setParams(next)
    setFeedback('')
  }

  async function sendReply() {
    const body = reply.trim()
    if (!active || body.length < 2 || saving) return
    setSaving(true)
    setFeedback('')
    try {
      const result = await supabase
        .from('support_ticket_messages')
        .insert({ ticket_id: active.id, author_id: user.id, message: body, is_internal: false })
        .select('id,ticket_id,author_id,message,is_internal,created_at')
        .single()
      if (result.error) throw result.error
      setMessages(current => [...current, result.data])
      setReply('')
      setTickets(current => current.map(ticket => ticket.id === active.id ? { ...ticket, updated_at: new Date().toISOString() } : ticket))
      setFeedback('Votre réponse a été envoyée à l’équipe One Market.')
    } catch (error) {
      logTechnicalError('seller-support-reply', error)
      setFeedback(userError(error, 'support'))
    } finally {
      setSaving(false)
    }
  }

  async function createTicket(event) {
    event.preventDefault()
    const cleanSubject = subject.trim()
    const cleanMessage = message.trim()
    const phone = String(profile?.phone || store?.phone || '').trim()
    if (cleanSubject.length < 3 || cleanMessage.length < 10 || saving) return
    if (phone.length < 7) {
      setFeedback('Ajoutez d’abord un numéro de téléphone valide dans votre profil ou votre boutique.')
      return
    }
    setSaving(true)
    setFeedback('')
    try {
      const result = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          category: 'store',
          subject: cleanSubject.slice(0, 140),
          message: cleanMessage,
          status: 'open',
          priority: 'normal',
          source: 'seller_workspace',
          target_type: 'store',
          store_id: store?.id || null,
          assigned_department: 'MODERATION',
          reporter_phone: phone,
        })
        .select('id,ticket_number,category,subject,message,status,priority,source,target_user_id,store_id,product_id,created_at,updated_at')
        .single()
      if (result.error) throw result.error
      setTickets(current => [result.data, ...current])
      setSubject('')
      setMessage('')
      setNewOpen(false)
      openTicket(result.data)
      setFeedback('Ticket envoyé. Un modérateur One Market pourra vous répondre ici.')
    } catch (error) {
      logTechnicalError('seller-support-create', error)
      setFeedback(userError(error, 'support'))
    } finally {
      setSaving(false)
    }
  }

  const unreadLike = tickets.filter(ticket => ['open', 'waiting_customer', 'in_progress', 'escalated'].includes(ticket.status)).length

  return <section className="seller-support-panel">
    <div className="seller-panel-head seller-support-head">
      <div><h2>Assistance & modération</h2><p>Messages de la modération, corrections demandées et tickets avec One Market.</p></div>
      <button className="button primary" type="button" onClick={() => setNewOpen(true)}><Plus size={16}/> Nouveau ticket</button>
    </div>

    {feedback && <div className="seller-feedback" role="status">{feedback}</div>}

    <div className="seller-support-layout">
      <aside className="seller-support-list">
        <div className="seller-support-list-title"><LifeBuoy size={18}/><span>Tickets</span><b>{unreadLike}</b></div>
        {loading ? <div className="seller-support-empty">Chargement…</div> : tickets.length ? tickets.map(ticket => (
          <button key={ticket.id} type="button" className={ticket.id === activeId ? 'active' : ''} onClick={() => openTicket(ticket)}>
            <span className={ticket.source === 'moderation' ? 'moderation-dot' : 'support-dot'}/>
            <div><strong>{ticket.source === 'moderation' ? 'Modération · ' : ''}{ticket.subject}</strong><small>{ticket.ticket_number || ticket.id.slice(0,8)} · {statusLabel(ticket.status)}</small><em>{formatDate(ticket.updated_at || ticket.created_at)}</em></div>
            <ChevronRight size={17}/>
          </button>
        )) : <div className="seller-support-empty"><MessageSquare size={24}/><strong>Aucun ticket</strong><span>Les messages de One Market apparaîtront ici.</span></div>}
      </aside>

      <section className="seller-support-thread">
        {active ? <>
          <header><div><span>{active.source === 'moderation' ? 'Message de modération' : 'Ticket vendeur'}</span><h3>{active.subject}</h3><small>{active.ticket_number || active.id.slice(0,8)} · {statusLabel(active.status)}</small></div><span className={'seller-support-status ' + active.status}>{statusLabel(active.status)}</span></header>
          <div className="seller-support-origin"><strong>{active.source === 'moderation' ? 'One Market' : 'Votre demande'}</strong><p>{active.message}</p><small>{formatDate(active.created_at)}</small></div>
          <div className="seller-support-messages">
            {threadLoading ? <div className="seller-support-empty">Chargement de la discussion…</div> : messages.map(item => {
              const mine = item.author_id === user.id
              return <article key={item.id} className={mine ? 'mine' : 'team'}><strong>{mine ? 'Vous' : 'One Market'}</strong><p>{item.message}</p><small>{formatDate(item.created_at)}</small></article>
            })}
          </div>
          {active.status !== 'closed' && <div className="seller-support-reply"><textarea rows={4} value={reply} onChange={event => setReply(event.target.value)} placeholder="Répondre à One Market…"/><button className="button primary" type="button" disabled={saving || reply.trim().length < 2} onClick={sendReply}><Send size={16}/>{saving ? 'Envoi…' : 'Envoyer'}</button></div>}
        </> : <div className="seller-support-empty seller-support-empty--thread"><LifeBuoy size={30}/><strong>Sélectionnez un ticket</strong><span>Vous pourrez lire les remarques de la modération et répondre directement.</span></div>}
      </section>
    </div>

    {newOpen && <div className="seller-support-modal-backdrop">
      <form className="seller-support-modal" onSubmit={createTicket}>
        <div className="seller-support-modal-head"><div><span>Assistance vendeur</span><h3>Nouveau ticket</h3><p>Votre demande sera transmise à l’équipe One Market.</p></div><button type="button" onClick={() => setNewOpen(false)}><X size={18}/></button></div>
        <label>Sujet<input required minLength={3} maxLength={140} value={subject} onChange={event => setSubject(event.target.value)} placeholder="Ex. Question sur une demande de modération"/></label>
        <label>Message<textarea required minLength={10} maxLength={3000} rows={6} value={message} onChange={event => setMessage(event.target.value)} placeholder="Expliquez votre demande…"/></label>
        <div className="seller-support-modal-actions"><button className="button secondary" type="button" onClick={() => setNewOpen(false)}>Annuler</button><button className="button primary" disabled={saving || subject.trim().length < 3 || message.trim().length < 10}>{saving ? 'Envoi…' : 'Ouvrir le ticket'}</button></div>
      </form>
    </div>}
  </section>
}
