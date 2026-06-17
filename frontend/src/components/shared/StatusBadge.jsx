import { Badge } from '@/components/ui/badge'

export default function StatusBadge({ status }) {
  if (status === 'published') {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 font-medium">
        PUBLICADA
      </Badge>
    )
  }
  return (
    <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 font-medium">
      BORRADOR
    </Badge>
  )
}
