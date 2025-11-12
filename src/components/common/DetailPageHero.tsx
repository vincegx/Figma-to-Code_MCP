/**
 * DetailPageHero - Hero section réutilisable pour les pages de détail
 * Utilisé par ExportFigmaDetailPage et ResponsiveMergeDetailPage
 */

import { ReactNode } from 'react'
import { LucideIcon, Clock, Maximize2, MoreVertical } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export interface HeroBadge {
  label: string
  variant?: 'default' | 'outline' | 'secondary' | 'destructive'
  icon?: LucideIcon
}

export interface HeroActionDropdownItem {
  label: string
  href: string
  icon?: LucideIcon
  target?: string
  rel?: string
}

export interface HeroAction {
  label: string
  href?: string
  onClick?: () => void
  icon?: LucideIcon
  variant?: 'default' | 'outline' | 'secondary' | 'destructive'
  download?: string
  target?: string
  rel?: string
  /** Custom className for button styling */
  className?: string
  /** Si présent, l'action devient un dropdown avec ces items */
  dropdownItems?: HeroActionDropdownItem[]
}

export interface HeroStat {
  label: string
  value: number | string
  icon: LucideIcon
  visible?: boolean
}

export interface DetailPageHeroProps {
  /** Titre principal */
  title: string
  /** Badges à afficher après le titre */
  badges?: HeroBadge[]
  /** Timestamp (string ou number) */
  timestamp?: string | number
  /** Dimensions (optionnel, pour afficher width x height) */
  dimensions?: {
    width: number
    height: number
  }
  /** Actions buttons */
  actions?: HeroAction[]
  /** Stats cards */
  stats?: HeroStat[]
  /** Métadonnées additionnelles à afficher après timestamp/dimensions dans le bloc flex-1 */
  additionalMetadata?: ReactNode
  /** Contenu additionnel à afficher dans la hero section */
  children?: ReactNode
}

function formatDate(timestamp: string | number) {
  const dateValue = typeof timestamp === 'number' && timestamp < 10000000000
    ? timestamp * 1000
    : timestamp

  return new Date(dateValue).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function DetailPageHero({
  title,
  badges = [],
  timestamp,
  dimensions,
  actions = [],
  stats = [],
  additionalMetadata,
  children
}: DetailPageHeroProps) {
  return (
    <div className="border-b bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
      <div className="w-full px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Title & Metadata */}
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                {title}
              </h1>
              {badges.map((badge, index) => (
                <Badge
                  key={index}
                  variant={badge.variant || 'outline'}
                  className="font-mono text-xs flex items-center gap-1"
                >
                  {badge.icon && <badge.icon className="h-3 w-3" />}
                  {badge.label}
                </Badge>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {timestamp && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {formatDate(timestamp)}
                </span>
              )}
              {dimensions && (
                <span className="flex items-center gap-1.5">
                  <Maximize2 className="h-4 w-4" />
                  {dimensions.width} × {dimensions.height}
                </span>
              )}
            </div>

            {/* Additional metadata */}
            {additionalMetadata && additionalMetadata}
          </div>

          {/* Actions & Stats - Right side */}
          <div className="flex flex-col gap-3">
            {/* Actions - Desktop */}
            {actions.length > 0 && (
              <div className="hidden sm:flex items-center gap-2">
                {actions.map((action, index) => {
                  const Icon = action.icon

                  // Action Dropdown
                  if (action.dropdownItems && action.dropdownItems.length > 0) {
                    return (
                      <DropdownMenu key={index}>
                        <DropdownMenuTrigger asChild>
                          <Button variant={action.variant || 'outline'} size="sm" className={action.className}>
                            {Icon && <Icon className="mr-2 h-4 w-4" />}
                            {action.label}
                            <MoreVertical className="ml-2 h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {action.dropdownItems.map((item, itemIndex) => {
                            const ItemIcon = item.icon
                            return (
                              <DropdownMenuItem key={itemIndex} asChild>
                                <a
                                  href={item.href}
                                  target={item.target}
                                  rel={item.rel}
                                  className="flex items-center"
                                >
                                  {ItemIcon && <ItemIcon className="mr-2 h-4 w-4" />}
                                  {item.label}
                                </a>
                              </DropdownMenuItem>
                            )
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  }

                  // Action normale (Button ou Link)
                  const buttonContent = (
                    <>
                      {Icon && <Icon className="mr-2 h-4 w-4" style={{ color: action.variant === 'default' ? 'white' : undefined }} />}
                      {action.label}
                    </>
                  )

                  if (action.href) {
                    // Build className - combine default with custom
                    const combinedClassName = [
                      action.variant === 'default' ? '[&]:dark:text-white [&>svg]:dark:text-white' : '',
                      action.className || ''
                    ].filter(Boolean).join(' ')

                    return (
                      <Button
                        key={index}
                        variant={action.variant || 'default'}
                        size="sm"
                        asChild
                        className={combinedClassName}
                        style={action.variant === 'default' ? { color: 'white' } : undefined}
                      >
                        <a
                          href={action.href}
                          download={action.download}
                          target={action.target}
                          rel={action.rel}
                        >
                          {buttonContent}
                        </a>
                      </Button>
                    )
                  }

                  return (
                    <Button
                      key={index}
                      variant={action.variant || 'default'}
                      size="sm"
                      onClick={action.onClick}
                      className={action.className}
                    >
                      {buttonContent}
                    </Button>
                  )
                })}
              </div>
            )}

            {/* Actions - Mobile (Dropdown) */}
            {actions.length > 0 && (
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {actions.map((action, index) => {
                      const Icon = action.icon

                      // Si l'action a un dropdown, afficher ses items
                      if (action.dropdownItems && action.dropdownItems.length > 0) {
                        return action.dropdownItems.map((item, itemIndex) => {
                          const ItemIcon = item.icon
                          return (
                            <DropdownMenuItem key={`${index}-${itemIndex}`} asChild>
                              <a
                                href={item.href}
                                target={item.target}
                                rel={item.rel}
                                className="flex items-center"
                              >
                                {ItemIcon && <ItemIcon className="mr-2 h-4 w-4" />}
                                {item.label}
                              </a>
                            </DropdownMenuItem>
                          )
                        })
                      }

                      // Action normale
                      const menuContent = (
                        <>
                          {Icon && <Icon className="mr-2 h-4 w-4" />}
                          {action.label}
                        </>
                      )

                      if (action.href) {
                        return (
                          <DropdownMenuItem key={index} asChild>
                            <a
                              href={action.href}
                              download={action.download}
                              target={action.target}
                              rel={action.rel}
                              className="flex items-center"
                            >
                              {menuContent}
                            </a>
                          </DropdownMenuItem>
                        )
                      }

                      return (
                        <DropdownMenuItem key={index} onClick={action.onClick}>
                          {menuContent}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Stats Bar */}
            {stats.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {stats
                  .filter(stat => stat.visible !== false)
                  .map((stat, index) => {
                    const Icon = stat.icon
                    return (
                      <Card key={index} className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="rounded-md bg-primary/10 p-1.5">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="flex items-baseline gap-1">
                            <p className="text-lg font-bold">{stat.value}</p>
                            <p className="text-[10px] text-muted-foreground whitespace-nowrap">{stat.label}</p>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Children (optional additional content) */}
        {children}
      </div>
    </div>
  )
}
