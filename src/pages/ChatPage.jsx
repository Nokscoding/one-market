import { Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import StoreTrustBadge from '../components/StoreTrustBadge'
import { useAuth } from '../context/AuthContext'
import { dateTime, money } from '../lib/format'
import { supabase } from '../lib/supabase'

export default function ChatPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [conversation, setConversation] = useState(null)
  const [suborder, setSuborder] = useState(null)
  const [store, setStore] = useState(null)
  const [items, setItems] = useState([])
  const [messages, setMessages] = useState([])
  const [selectedItem, setSelectedItem] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)

  async function loadMessages() {
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', id).order('created_at')
    setMessages(data || [])
  }

  useEffect(() => {
    let active = true
    async function load() {
      const { data: c } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle()
      if (!active) return
      setConversation(c || null)
      if (c) {
        const { data: so } = await supabase.from('seller_orders').select('*').eq('id', c.seller_order_id).maybeSingle()
        if (!active) return
        setSuborder(so || null)
        if (so) {
          const [{ data: s }, { data: oi }] = await Promise.all([
            supabase.from('stores').select('*').eq('id', so.store_id).maybeSingle(),
            supabase.from('order_items').select('*').eq('seller_order_id', so.id),
          ])
          if (!active) return
          setStore(s || null)
          setItems(oi || [])
        }
        await loadMessages()
      }
      if (active) setLoading(false)
    }
    load().catch(() => { if (active) setLoading(false) })
    const channel = supabase.channel(`chat-${id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, payload => setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new])).subscribe()
    return () => { active = false; supabase.removeChannel(channel) }
  }, [id])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  async function send(e) {
    e.preventDefault()
    const content = text.trim()
    if (!content) return
    setSending(true)
    setError('')
    const { error: sendError } = await supabase.from('messages').insert({ conversation_id: id, order_item_id: selectedItem || null, content })
    if (sendError) setError(sendError.message)
    else setText('')
    setSending(false)
  }

  if (loading) return <Loader fullscreen />
  if (!conversation) return <main className="section-shell page-space"><EmptyState title="Conversation introuvable"/></main>
  const itemMap = Object.fromEntries(items.map(i => [i.id, i]))

  return <main className="chat-page section-shell"><div className="chat-shell">
    <header className="chat-head"><div>{store?.logo_url ? <img src={store.logo_url} alt=""/> : <div className="chat-avatar">{store?.name?.slice(0,2).toUpperCase() || 'OM'}</div>}<div><span>Boutique One Market</span><div className="chat-store-name"><h1>{store?.name || 'Vendeur'}</h1><StoreTrustBadge store={store} compact/></div></div></div><div><span>Commande boutique</span><strong>{suborder?.seller_order_number}</strong></div></header>
    <div className="chat-items">{items.map(item => <button key={item.id} className={selectedItem === item.id ? 'active' : ''} onClick={() => setSelectedItem(selectedItem === item.id ? '' : item.id)}>{item.product_image_url ? <img src={item.product_image_url} alt=""/> : <span className="chat-item-placeholder">OM</span>}<span>{item.product_name}</span><strong>{money(item.line_total, suborder?.currency)}</strong></button>)}</div>
    <div className="chat-notice">Pour votre sécurité, le paiement à la livraison se fait directement auprès du livreur au moment de la réception.</div>
    <div className="messages">{messages.length ? messages.map(m => { const linked = m.order_item_id ? itemMap[m.order_item_id] : null; return <div className={`message ${m.sender_id === user.id ? 'mine' : ''}`} key={m.id}>{linked && <span className="message-product">À propos de : {linked.product_name}</span>}<p>{m.content}</p><time>{dateTime(m.created_at)}</time></div> }) : <div className="chat-empty"><strong>La conversation commence ici.</strong><span>Écrivez à la boutique au sujet de votre commande.</span></div>}<div ref={endRef}/></div>
    <form className="chat-compose" onSubmit={send}><div className="compose-context">{selectedItem ? `Article : ${itemMap[selectedItem]?.product_name}` : 'Message général à la boutique'}</div><div><textarea rows="1" value={text} onChange={e => setText(e.target.value)} placeholder="Écrire un message…"/><button className="send-button" disabled={sending || !text.trim()}><Send size={18}/></button></div>{error && <span className="form-error">{error}</span>}</form>
  </div></main>
}
