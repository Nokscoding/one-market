import { Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import StoreTrustBadge from '../components/StoreTrustBadge'
import { useAuth } from '../context/AuthContext'
import { dateTime, money } from '../lib/format'
import { supabase } from '../lib/supabase'
import { logTechnicalError, userError } from '../lib/userErrors'

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
  const [retryKey, setRetryKey] = useState(0)
  const endRef = useRef(null)

  async function loadMessages() {
    const result = await supabase.from('messages').select('*').eq('conversation_id', id).order('created_at')
    if (result.error) throw result.error
    setMessages(result.data || [])
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    async function load() {
      const conversationResult = await supabase.from('conversations').select('*').eq('id', id).maybeSingle()
      if (conversationResult.error) throw conversationResult.error
      if (!active) return

      const currentConversation = conversationResult.data || null
      setConversation(currentConversation)
      if (!currentConversation) return

      const suborderResult = await supabase.from('seller_orders').select('*').eq('id', currentConversation.seller_order_id).maybeSingle()
      if (suborderResult.error) throw suborderResult.error
      if (!active) return

      const currentSuborder = suborderResult.data || null
      setSuborder(currentSuborder)
      if (currentSuborder) {
        const [storeResult, itemResult] = await Promise.all([
          supabase.from('stores').select('id,name,slug,logo_url,is_verified,is_partner').eq('id', currentSuborder.store_id).maybeSingle(),
          supabase.from('order_items').select('id,order_item_number,product_id,product_name,product_image_url,line_total,order_id,seller_order_id,store_id').eq('seller_order_id', currentSuborder.id),
        ])
        if (storeResult.error) throw storeResult.error
        if (itemResult.error) throw itemResult.error
        if (!active) return
        setStore(storeResult.data || null)
        setItems(itemResult.data || [])
      }
      await loadMessages()
    }

    load()
      .catch(loadError => {
        if (!active) return
        logTechnicalError('chat-load', loadError)
        setError(userError(loadError, 'messages'))
      })
      .finally(() => { if (active) setLoading(false) })

    const channel = supabase.channel(`chat-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, payload => {
        setMessages(previous => previous.some(message => message.id === payload.new.id) ? previous : [...previous, payload.new])
      })
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [id, retryKey])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  async function send(event) {
    event.preventDefault()
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    setError('')
    try {
      const result = await supabase.from('messages').insert({ conversation_id: id, order_item_id: selectedItem || null, content })
      if (result.error) throw result.error
      setText('')
    } catch (sendError) {
      logTechnicalError('chat-send', sendError)
      setError(userError(sendError, 'messages'))
    } finally {
      setSending(false)
    }
  }

  if (loading) return <Loader fullscreen />
  if (error && !conversation) return <main className="section-shell page-space"><EmptyState title="Impossible de charger la conversation" text={error} action={<button className="button primary" type="button" onClick={() => setRetryKey(value => value + 1)}>Réessayer</button>}/></main>
  if (!conversation) return <main className="section-shell page-space"><EmptyState title="Conversation introuvable" text="Cette conversation n’est pas disponible ou vous n’y avez pas accès."/></main>

  const itemMap = Object.fromEntries(items.map(item => [item.id, item]))

  return <main className="chat-page section-shell"><div className="chat-shell">
    <header className="chat-head"><div>{store?.logo_url ? <img src={store.logo_url} alt={store?.name || 'Boutique'}/> : <div className="chat-avatar">{store?.name?.slice(0, 2).toUpperCase() || 'OM'}</div>}<div><span>Boutique One Market</span><div className="chat-store-name"><h1>{store?.name || 'Boutique'}</h1><StoreTrustBadge store={store} compact/></div></div></div><div><span>Commande boutique</span><strong>{suborder?.seller_order_number || 'Commande'}</strong></div></header>
    <div className="chat-items">{items.map(item => <button key={item.id} type="button" className={selectedItem === item.id ? 'active' : ''} onClick={() => setSelectedItem(selectedItem === item.id ? '' : item.id)}>{item.product_image_url ? <img src={item.product_image_url} alt={item.product_name || ''}/> : <span className="chat-item-placeholder">OM</span>}<span>{item.product_name}</span><strong>{money(item.line_total, suborder?.currency)}</strong></button>)}</div>
    <div className="chat-notice">Pour votre sécurité, utilisez uniquement les moyens de paiement proposés par One Market au moment de la commande.</div>
    <div className="messages">{messages.length ? messages.map(message => { const linked = message.order_item_id ? itemMap[message.order_item_id] : null; return <div className={`message ${message.sender_id === user?.id ? 'mine' : ''}`} key={message.id}>{linked && <span className="message-product">À propos de : {linked.product_name}</span>}<p>{message.content}</p><time>{dateTime(message.created_at)}</time></div> }) : <div className="chat-empty"><strong>La conversation commence ici.</strong><span>Écrivez à la boutique au sujet de votre commande.</span></div>}<div ref={endRef}/></div>
    <form className="chat-compose" onSubmit={send}><div className="compose-context">{selectedItem ? `Article : ${itemMap[selectedItem]?.product_name || 'Produit'}` : 'Message général à la boutique'}</div><div><textarea rows="1" value={text} onChange={event => setText(event.target.value)} placeholder="Écrire un message…"/><button className="send-button" disabled={sending || !text.trim()} aria-label="Envoyer le message"><Send size={18}/></button></div>{error && <span className="form-error">{error}</span>}</form>
  </div></main>
}
