/**
 * LanguageSwitcher - Composant pour changer de langue
 */

import { useTranslation } from '../i18n/I18nContext'

export default function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLanguage('fr')}
        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
          language === 'fr'
            ? 'bg-white text-purple-600 shadow-sm'
            : 'bg-white/10 text-white/90 hover:bg-white/20'
        }`}
        title="Français"
      >
        🇫🇷 FR
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
          language === 'en'
            ? 'bg-white text-purple-600 shadow-sm'
            : 'bg-white/10 text-white/90 hover:bg-white/20'
        }`}
        title="English"
      >
        🇬🇧 EN
      </button>
    </div>
  )
}
