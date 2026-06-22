import {
  Baby,
  Briefcase,
  Building2,
  GraduationCap,
  Heart,
  MapPin,
  MessageCircle,
} from 'lucide-react'
import { ProfileAvatar } from '@/components/shared/ProfileAvatar'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import type { Graduate } from '@/types'

interface GraduateCardProps {
  graduate: Graduate
}

export function GraduateCard({ graduate }: GraduateCardProps) {
  const evlilikTone =
    graduate.evlilikDurumu === 'Evli'
      ? 'danger'
      : graduate.evlilikDurumu === 'Bekar'
        ? 'primary'
        : 'default'

  return (
    <Card className="group overflow-hidden border-slate-200/80 p-0 transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lg dark:border-slate-800">
      <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-800 px-5 py-4 text-white">
        <div className="flex items-center gap-4">
          <ProfileAvatar
            name={graduate.adSoyad}
            photoUrl={graduate.photoUrl}
            size="md"
            className="rounded-2xl ring-2 ring-white/30"
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold">{graduate.adSoyad}</h3>
            {graduate.bolum ? (
              <p className="mt-0.5 truncate text-sm text-primary-100">{graduate.bolum}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-3 p-5">
        <div className="flex flex-wrap gap-2">
          {graduate.evlilikDurumu ? (
            <Badge tone={evlilikTone}>
              <Heart className="mr-1 inline h-3 w-3" />
              {graduate.evlilikDurumu}
            </Badge>
          ) : null}
          {graduate.cocukSayisi !== undefined && graduate.cocukSayisi > 0 ? (
            <Badge tone="warning">
              <Baby className="mr-1 inline h-3 w-3" />
              {graduate.cocukSayisi} çocuk
            </Badge>
          ) : null}
          {graduate.mezuniyetYili ? (
            <Badge tone="success">
              <GraduationCap className="mr-1 inline h-3 w-3" />
              {graduate.mezuniyetYili} mezun
            </Badge>
          ) : null}
        </div>

        {graduate.gorev ? (
          <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
            <span>{graduate.gorev}</span>
          </div>
        ) : null}

        {graduate.calistigiYer ? (
          <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
            <span>{graduate.calistigiYer}</span>
          </div>
        ) : null}

        {graduate.sehir ? (
          <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>{graduate.sehir}</span>
          </div>
        ) : null}

        {graduate.notlar ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <MessageCircle className="mb-1 h-4 w-4 text-primary-500" />
            {graduate.notlar}
          </div>
        ) : null}

        {graduate.iletisim ? (
          <p className="text-xs font-medium text-slate-500">{graduate.iletisim}</p>
        ) : null}

        {graduate.sosyalMedya ? (
          <a
            href={graduate.sosyalMedya.startsWith('http') ? graduate.sosyalMedya : `https://${graduate.sosyalMedya}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-xs font-semibold text-primary-700 hover:underline dark:text-primary-300"
          >
            Sosyal medya / bağlantı
          </a>
        ) : null}
      </div>
    </Card>
  )
}
