/**
 * LanguageSwitcher - Composant pour changer de langue
 */

import { useTranslation } from '../../i18n/I18nContext'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export default function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation()

  return (
    <ToggleGroup type="single" value={language} onValueChange={(value: string) => value && setLanguage(value as 'fr' | 'en')}>
      <ToggleGroupItem value="fr" aria-label="Français">
        🇫🇷 FR
      </ToggleGroupItem>
      <ToggleGroupItem value="en" aria-label="English">
        🇬🇧 EN
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
