import { ArrowDown, ArrowUp, ImagePlus, Plus, Save, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import SmartImage from './SmartImage'
import { uploadOneMarketImage } from '../lib/cloudinary'
import { supabase } from '../lib/supabase'

function slugify(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function emptyVariant() {
  return { id: '', size: '', color: '', option: '', price: '', stock_qty: '0', is_active: true }
}

function variantRow(variant) {
  const attributes = variant?.attributes || {}
  return {
    id: variant?.id || '',
    size: attributes.size || '',
    color: attributes.color || '',
    option: attributes.option || attributes.label || '',
    price: variant?.price ?? '',
    stock_qty: String(variant?.stock_qty ?? 0),
    is_active: variant?.is_active !== false,
  }
}

export default function SellerProductEditor({ store, categories, product = null, images = [], variants = [], onCancel, onSaved }) {
  const editing = Boolean(product?.id)
  const [form, setForm] = useState({
    name: product?.name || '',
    category_id: product?.category_id || '',
    description: product?.description || '',
    price: product?.price ?? '',
    old_price: product?.old_price ?? '',
    stock_qty: String(product?.stock_qty ?? 1),
    is_active: product?.is_active !== false,
  })
  const [media, setMedia] = useState(images.map(image => ({ kind: 'existing', id: image.id, src: image.secure_url, alt: image.alt_text || product?.name || '' })))
  const [variantRows, setVariantRows] = useState(variants.map(variantRow))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const originalImageIds = useMemo(() => images.map(image => image.id), [images])
  const originalVariantIds = useMemo(() => variants.map(variant => variant.id), [variants])

  function addImages(event) {
    const files = Array.from(event.target.files || []).filter(file => file.type.startsWith('image/'))
    event.target.value = ''
    if (!files.length) return
    setMedia(current => [...current, ...files.slice(0, Math.max(0, 8 - current.length)).map(file => ({ kind: 'file', file, src: URL.createObjectURL(file), id: crypto.randomUUID() }))].slice(0, 8))
  }

  function moveMedia(index, delta) {
    setMedia(current => {
      const nextIndex = index + delta
      if (nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next
    })
  }

  function makePrimary(index) {
    setMedia(current => {
      const next = [...current]
      const [selected] = next.splice(index, 1)
      next.unshift(selected)
      return next
    })
  }

  function removeMedia(index) {
    setMedia(current => current.filter((_, i) => i !== index))
  }

  function updateVariant(index, patch) {
    setVariantRows(current => current.map((row, i) => i === index ? { ...row, ...patch } : row))
  }

  async function save(event) {
    event.preventDefault()
    if (saving || !store?.id) return
    setMessage('')

    const name = form.name.trim()
    const price = Number(form.price)
    const activeVariants = variantRows.filter(row => row.is_active)
    const hasVariants = activeVariants.length > 0
    const baseStock = Math.max(0, Math.trunc(Number(form.stock_qty) || 0))

    if (!name) return setMessage('Indique le nom du produit.')
    if (!Number.isFinite(price) || price < 0) return setMessage('Le prix du produit est invalide.')
    if (media.length === 0) return setMessage('Ajoute au moins une image du produit.')

    for (const row of activeVariants) {
      const stock = Number(row.stock_qty)
      const variantPrice = row.price === '' ? null : Number(row.price)
      if (!row.size.trim() && !row.color.trim() && !row.option.trim()) return setMessage('Chaque variante doit avoir au moins une taille, une couleur ou une option.')
      if (!Number.isInteger(stock) || stock < 0) return setMessage('Vérifie le stock des variantes.')
      if (variantPrice !== null && (!Number.isFinite(variantPrice) || variantPrice < 0)) return setMessage('Vérifie le prix des variantes.')
    }

    const totalVariantStock = activeVariants.reduce((sum, row) => sum + Math.max(0, Number(row.stock_qty) || 0), 0)
    setSaving(true)

    try {
      const payload = {
        store_id: store.id,
        category_id: form.category_id || null,
        name,
        description: form.description.trim() || null,
        price,
        old_price: form.old_price === '' ? null : Math.max(0, Number(form.old_price) || 0),
        currency: 'USD',
        stock_qty: hasVariants ? totalVariantStock : baseStock,
        has_variants: hasVariants,
        is_active: Boolean(form.is_active),
        is_demo: false,
      }

      let savedProduct
      if (editing) {
        const result = await supabase.from('products').update(payload).eq('id', product.id).select('*').single()
        if (result.error) throw result.error
        savedProduct = result.data
      } else {
        const result = await supabase.from('products').insert({ ...payload, slug: `${slugify(name)}-${Date.now().toString(36)}` }).select('*').single()
        if (result.error) throw result.error
        savedProduct = result.data
      }

      const keptExistingIds = media.filter(item => item.kind === 'existing').map(item => item.id)
      const removedImageIds = originalImageIds.filter(id => !keptExistingIds.includes(id))
      if (removedImageIds.length) {
        const removed = await supabase.from('product_images').delete().in('id', removedImageIds).eq('product_id', savedProduct.id)
        if (removed.error) throw removed.error
      }

      const finalImages = []
      for (let index = 0; index < media.length; index += 1) {
        const item = media[index]
        if (item.kind === 'existing') {
          const updated = await supabase.from('product_images').update({ sort_order: index, alt_text: name }).eq('id', item.id).eq('product_id', savedProduct.id).select('*').single()
          if (updated.error) throw updated.error
          finalImages.push(updated.data)
        } else {
          const uploaded = await uploadOneMarketImage(item.file, { folder: `one-market/products/${store.id}`, tags: ['one-market', 'seller-product'] })
          const inserted = await supabase.from('product_images').insert({ product_id: savedProduct.id, secure_url: uploaded.secureUrl, alt_text: name, sort_order: index }).select('*').single()
          if (inserted.error) throw inserted.error
          finalImages.push(inserted.data)
        }
      }

      const savedVariants = []
      const keptVariantIds = []
      for (const row of variantRows) {
        const attributes = {}
        if (row.size.trim()) attributes.size = row.size.trim()
        if (row.color.trim()) attributes.color = row.color.trim()
        if (row.option.trim()) attributes.option = row.option.trim()
        const variantPayload = {
          product_id: savedProduct.id,
          attributes,
          price: row.price === '' ? null : Number(row.price),
          stock_qty: Math.max(0, Math.trunc(Number(row.stock_qty) || 0)),
          is_active: Boolean(row.is_active),
        }

        if (row.id) {
          keptVariantIds.push(row.id)
          const updated = await supabase.from('product_variants').update(variantPayload).eq('id', row.id).eq('product_id', savedProduct.id).select('*').single()
          if (updated.error) throw updated.error
          savedVariants.push(updated.data)
        } else if (Object.keys(attributes).length) {
          const inserted = await supabase.from('product_variants').insert(variantPayload).select('*').single()
          if (inserted.error) throw inserted.error
          savedVariants.push(inserted.data)
        }
      }

      const removedVariantIds = originalVariantIds.filter(id => !keptVariantIds.includes(id))
      if (removedVariantIds.length) {
        const disabled = await supabase.from('product_variants').update({ is_active: false, stock_qty: 0 }).in('id', removedVariantIds).eq('product_id', savedProduct.id)
        if (disabled.error) throw disabled.error
      }

      const activeSavedVariants = savedVariants.filter(variant => variant.is_active)
      const finalStock = activeSavedVariants.length
        ? activeSavedVariants.reduce((sum, variant) => sum + Number(variant.stock_qty || 0), 0)
        : baseStock
      if (activeSavedVariants.length !== (savedProduct.has_variants ? 1 : 0) || Number(savedProduct.stock_qty) !== finalStock) {
        const normalized = await supabase.from('products').update({ has_variants: activeSavedVariants.length > 0, stock_qty: finalStock }).eq('id', savedProduct.id).select('*').single()
        if (!normalized.error) savedProduct = normalized.data
      }

      onSaved?.({ product: savedProduct, images: finalImages, variants: savedVariants })
    } catch (error) {
      setMessage(error?.message || 'Impossible d’enregistrer ce produit.')
      setSaving(false)
      return
    }

    setSaving(false)
  }

  return (
    <form className="seller-product-editor" onSubmit={save}>
      <div className="seller-product-editor-head"><div><span className="eyebrow">Catalogue</span><h2>{editing ? 'Modifier le produit' : 'Nouveau produit'}</h2><p>Informations, images Cloudinary, variantes et stock.</p></div><button type="button" className="seller-editor-close" onClick={onCancel}><X size={19}/></button></div>

      <div className="seller-product-editor-grid">
        <label>Nom du produit<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}/></label>
        <label>Catégorie<select value={form.category_id} onChange={event => setForm({ ...form, category_id: event.target.value })}><option value="">Sans catégorie</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Prix USD<input required type="number" min="0" step="0.01" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })}/></label>
        <label>Ancien prix <small>(facultatif)</small><input type="number" min="0" step="0.01" value={form.old_price} onChange={event => setForm({ ...form, old_price: event.target.value })}/></label>
        {!variantRows.some(row => row.is_active) && <label>Stock<input type="number" min="0" step="1" value={form.stock_qty} onChange={event => setForm({ ...form, stock_qty: event.target.value })}/></label>}
        <label className="wide">Description<textarea rows={5} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })}/></label>
        <label className="seller-checkbox wide"><input type="checkbox" checked={form.is_active} onChange={event => setForm({ ...form, is_active: event.target.checked })}/><span>Publier le produit dans la boutique</span></label>
      </div>

      <section className="seller-editor-section">
        <div className="seller-editor-section-head"><div><strong>Images du produit</strong><span>La première image est l’image principale. Maximum 8.</span></div><label className="button secondary"><ImagePlus size={17}/> Ajouter des images<input hidden multiple type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={addImages}/></label></div>
        <div className="seller-media-grid">
          {media.map((item, index) => <article key={item.id || item.src} className={index === 0 ? 'is-primary' : ''}><SmartImage src={item.src} fallback="OM" fit="contain" width={320}/><div><span>{index === 0 ? 'Image principale' : `Image ${index + 1}`}</span><div><button type="button" disabled={index === 0} onClick={() => makePrimary(index)} title="Définir comme principale">★</button><button type="button" disabled={index === 0} onClick={() => moveMedia(index, -1)}><ArrowUp size={15}/></button><button type="button" disabled={index === media.length - 1} onClick={() => moveMedia(index, 1)}><ArrowDown size={15}/></button><button type="button" className="danger" onClick={() => removeMedia(index)}><Trash2 size={15}/></button></div></div></article>)}
          {!media.length && <label className="seller-media-empty"><ImagePlus size={26}/><strong>Ajoute au moins une image</strong><span>JPG, PNG, WebP ou AVIF.</span><input hidden multiple type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={addImages}/></label>}
        </div>
      </section>

      <section className="seller-editor-section">
        <div className="seller-editor-section-head"><div><strong>Variantes</strong><span>Facultatif : taille, couleur ou autre option avec stock et prix propre.</span></div><button type="button" className="button secondary" onClick={() => setVariantRows(current => [...current, emptyVariant()])}><Plus size={17}/> Ajouter une variante</button></div>
        <div className="seller-variant-editor-list">
          {variantRows.map((row, index) => <article key={row.id || index} className={!row.is_active ? 'is-disabled' : ''}><label>Taille<input value={row.size} onChange={event => updateVariant(index, { size: event.target.value })} placeholder="S, M, L…"/></label><label>Couleur<input value={row.color} onChange={event => updateVariant(index, { color: event.target.value })} placeholder="Noir, bleu…"/></label><label>Autre option<input value={row.option} onChange={event => updateVariant(index, { option: event.target.value })} placeholder="128 Go, pack…"/></label><label>Prix USD <small>(vide = prix produit)</small><input type="number" min="0" step="0.01" value={row.price} onChange={event => updateVariant(index, { price: event.target.value })}/></label><label>Stock<input type="number" min="0" step="1" value={row.stock_qty} onChange={event => updateVariant(index, { stock_qty: event.target.value })}/></label><label className="seller-variant-active"><input type="checkbox" checked={row.is_active} onChange={event => updateVariant(index, { is_active: event.target.checked })}/><span>Active</span></label><button type="button" className="seller-variant-remove" onClick={() => setVariantRows(current => current.filter((_, i) => i !== index))}><Trash2 size={16}/></button></article>)}
          {!variantRows.length && <div className="seller-variant-empty">Pas de variante : le stock global du produit sera utilisé.</div>}
        </div>
      </section>

      {message && <div className="seller-feedback">{message}</div>}
      <div className="seller-product-editor-actions"><button type="button" className="button secondary" onClick={onCancel}>Annuler</button><button className="button primary" disabled={saving}><Save size={17}/>{saving ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Ajouter le produit'}</button></div>
    </form>
  )
}
