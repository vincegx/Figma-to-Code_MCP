/**
 * I18nContext - Contexte d'internationalisation simple
 * Gère les traductions FR/EN sans bibliothèque externe
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import fr from './fr.json'
import en from './en.json'

type Language = 'fr' | 'en'

type Translations = typeof fr

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, params?: Record<string, string | number>) => string
  translations: Translations
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

const translations: Record<Language, Translations> = {
  fr,
  en
}

// Fonction utilitaire pour accéder aux traductions imbriquées
// Ex: 'home.loading_tests' -> translations.home.loading_tests
function getNestedTranslation(obj: any, path: string): string {
  const keys = path.split('.')
  let result = obj

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key]
    } else {
      return path // Retourne la clé si non trouvée
    }
  }

  return typeof result === 'string' ? result : path
}

// Fonction pour remplacer les paramètres dans les traductions
// Ex: "Hello {{name}}" avec {name: 'John'} -> "Hello John"
function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text

  return Object.entries(params).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
  }, text)
}

interface I18nProviderProps {
  children: ReactNode
}

export function I18nProvider({ children }: I18nProviderProps) {
  // Initialiser avec la langue du navigateur ou FR par défaut
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('language') as Language | null
    if (stored && (stored === 'fr' || stored === 'en')) {
      return stored
    }
    // Détection automatique de la langue du navigateur
    const browserLang = navigator.language.toLowerCase()
    return browserLang.startsWith('fr') ? 'fr' : 'en'
  })

  // Sauvegarder la langue dans le localStorage
  useEffect(() => {
    localStorage.setItem('language', language)
  }, [language])

  // Fonction de traduction
  const t = (key: string, params?: Record<string, string | number>): string => {
    const translation = getNestedTranslation(translations[language], key)
    return interpolate(translation, params)
  }

  // Fonction pour changer de langue
  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
  }

  const value: I18nContextType = {
    language,
    setLanguage,
    t,
    translations: translations[language]
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// Hook personnalisé pour utiliser les traductions
export function useTranslation() {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error('useTranslation must be used within an I18nProvider')
  }
  return context
}
