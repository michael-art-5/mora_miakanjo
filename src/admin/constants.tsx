import type { MessageStatus, OrderStatus } from '../lib/types'
import { Badge } from './ui'

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: 'gold' | 'blue' | 'green' | 'neutral' | 'red' }> = {
  nouvelle: { label: 'Nouvelle', tone: 'gold' },
  confirmee: { label: 'Confirmée', tone: 'blue' },
  prete: { label: 'Prête à retirer', tone: 'green' },
  terminee: { label: 'Terminée', tone: 'neutral' },
  annulee: { label: 'Annulée', tone: 'red' },
}

export const MESSAGE_STATUS: Record<MessageStatus, { label: string; tone: 'gold' | 'blue' | 'green' | 'neutral' }> = {
  nouveau: { label: 'Nouveau', tone: 'gold' },
  lu: { label: 'Lu', tone: 'blue' },
  traite: { label: 'Traité', tone: 'green' },
  archive: { label: 'Archivé', tone: 'neutral' },
}

export const ORDER_SOURCES: Record<string, string> = {
  site: 'Site web',
  boutique: 'En boutique',
  telephone: 'Téléphone',
  whatsapp: 'WhatsApp',
  reseaux: 'Réseaux sociaux',
}

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => (
  <Badge tone={ORDER_STATUS[status].tone}>{ORDER_STATUS[status].label}</Badge>
)

export const MessageStatusBadge = ({ status }: { status: MessageStatus }) => (
  <Badge tone={MESSAGE_STATUS[status].tone}>{MESSAGE_STATUS[status].label}</Badge>
)
