/**
 * DocumentationPage - User documentation with sticky left navigation
 * Loads Markdown files (FR/EN) and auto-generates navigation from headings
 */

import { useState, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTranslation } from '../../i18n/I18nContext'
import { BookOpen, ChevronRight, Copy, Check } from 'lucide-react'

interface Heading {
  id: string
  text: string
  level: number
}

// CodeBlock component with copy button
const CodeBlock = ({ children, className, inline }: any) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (inline) {
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">
        {children}
      </code>
    )
  }

  return (
    <pre className="relative group my-6 rounded-lg bg-muted overflow-hidden">
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20
          text-xs font-medium transition-all flex items-center gap-1.5 opacity-0 group-hover:opacity-100 z-10"
        title={copied ? 'Copié!' : 'Copier le code'}
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" />
            Copié
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            Copier
          </>
        )}
      </button>
      <code className={`${className} block p-4 pr-16 text-sm font-mono overflow-x-auto`}>
        {children}
      </code>
    </pre>
  )
}

// Helper function to generate consistent IDs from text
const generateId = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim()
}

export default function DocumentationPage() {
  const { language, t } = useTranslation()
  const [markdown, setMarkdown] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<string>('')

  // Load Markdown file based on current language
  useEffect(() => {
    setLoading(true)
    const fileName = language === 'fr' ? 'DOCUMENTATION.fr.md' : 'DOCUMENTATION.en.md'

    fetch(`/docs/${fileName}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load documentation')
        return res.text()
      })
      .then(text => {
        setMarkdown(text)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error loading documentation:', err)
        setMarkdown(`# ${t('documentation.error')}\n\n${err.message}`)
        setLoading(false)
      })
  }, [language, t])

  // Extract headings from Markdown for navigation
  const headings = useMemo<Heading[]>(() => {
    const lines = markdown.split('\n')
    const extracted: Heading[] = []

    lines.forEach(line => {
      const match = line.match(/^(##)\s+(.+)$/) // Only level 2 headings (##)
      if (match) {
        const text = match[2]
        const id = generateId(text)

        extracted.push({
          id,
          text,
          level: 2
        })
      }
    })

    return extracted
  }, [markdown])

  // Scroll spy with polling (works regardless of scroll container)
  useEffect(() => {
    if (!markdown) return

    let animationFrameId: number

    const checkActiveSection = () => {
      const h2Elements = document.querySelectorAll('.markdown-content h2')
      if (h2Elements.length === 0) {
        animationFrameId = requestAnimationFrame(checkActiveSection)
        return
      }

      // Find the section that's closest to the top of the viewport
      let currentSection = ''
      let minDistance = Infinity

      h2Elements.forEach((h2) => {
        const rect = h2.getBoundingClientRect()
        const distance = Math.abs(rect.top - 100)

        // Only consider sections that are visible (above the fold, within reasonable range)
        if (rect.top <= 300 && rect.top >= -200) {
          if (distance < minDistance) {
            minDistance = distance
            currentSection = h2.id
          }
        }
      })

      // Fallback: if no section in the sweet spot, find the first visible one
      if (!currentSection) {
        for (const h2 of Array.from(h2Elements)) {
          const rect = h2.getBoundingClientRect()
          if (rect.top >= 0 && rect.top <= window.innerHeight) {
            currentSection = h2.id
            break
          }
        }
      }

      if (currentSection) {
        setActiveSection(currentSection)
      }

      // Continue checking
      animationFrameId = requestAnimationFrame(checkActiveSection)
    }

    // Start checking
    const timer = setTimeout(() => {
      checkActiveSection()
    }, 300)

    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(animationFrameId)
    }
  }, [markdown])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-muted-foreground">{t('documentation.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-6" style={{ scrollBehavior: 'smooth' }}>
      {/* Left Navigation - Sticky */}
      <aside className="sticky top-6 h-[calc(100vh-8rem)] w-64 flex-shrink-0">
        <Card>
          <CardContent className="p-4">
            <div className="mb-4 flex items-center gap-2 border-b pb-3">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">{t('documentation.title')}</h2>
            </div>
            <ScrollArea className="h-[calc(100vh-14rem)]">
              <nav className="space-y-1">
                {headings.map((heading) => (
                  <a
                    key={heading.id}
                    href={`#${heading.id}`}
                    onClick={() => setActiveSection(heading.id)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-all hover:bg-accent no-underline ${
                      activeSection === heading.id
                        ? 'bg-accent font-bold text-accent-foreground border-primary'
                        : 'text-muted-foreground border-transparent'
                    }`}
                  >
                    <ChevronRight className={`h-4 w-4 flex-shrink-0 transition-transform ${
                      activeSection === heading.id ? 'rotate-90 text-primary' : ''
                    }`} />
                    <span className="truncate text-left">{heading.text}</span>
                  </a>
                ))}
              </nav>
            </ScrollArea>
          </CardContent>
        </Card>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <Card>
          <CardContent className="p-8">
            <div className="markdown-content prose prose-slate dark:prose-invert max-w-none
              prose-base
              prose-headings:font-bold
              prose-h1:text-3xl prose-h1:mb-6 prose-h1:mt-8 prose-h1:border-b prose-h1:pb-4
              prose-h2:text-2xl prose-h2:mb-4 prose-h2:mt-8 prose-h2:text-primary
              prose-h3:text-xl prose-h3:mb-3 prose-h3:mt-6
              prose-p:text-base prose-p:leading-7 prose-p:mb-4
              prose-li:text-base prose-li:leading-7
              prose-img:rounded-lg prose-img:shadow-md prose-img:my-8
              prose-code:text-sm
              prose-pre:my-6
              prose-a:text-primary prose-a:font-medium hover:prose-a:underline
              prose-strong:font-semibold
              prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic
            ">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                // Add IDs to h1
                h1: ({ children, ...props }) => {
                  return (
                    <h1 className="!text-3xl !font-bold !mb-6 !mt-8 !pb-4 !border-b" {...props}>
                      {children}
                    </h1>
                  )
                },
                // Add IDs to h2 for navigation linking
                h2: ({ children, ...props }) => {
                  // Extract text content from children (handles React elements)
                  const extractText = (node: any): string => {
                    if (typeof node === 'string') return node
                    if (Array.isArray(node)) return node.map(extractText).join('')
                    if (node?.props?.children) return extractText(node.props.children)
                    return ''
                  }

                  const text = extractText(children)
                  const id = generateId(text)

                  return (
                    <h2
                      id={id}
                      className="!text-2xl !font-bold !mb-4 !mt-8 !text-primary scroll-mt-24"
                      {...props}
                    >
                      {children}
                    </h2>
                  )
                },
                // Style h3
                h3: ({ children, ...props }) => {
                  return (
                    <h3 className="!text-xl !font-semibold !mb-3 !mt-6" {...props}>
                      {children}
                    </h3>
                  )
                },
                // Style paragraphs - avoid wrapping block elements
                p: ({ children, ...props }) => {
                  // Check if children contain block-level elements (code blocks, divs, etc.)
                  const hasBlockElement = Array.isArray(children) && children.some((child: any) =>
                    child?.type === 'pre' ||
                    child?.props?.className?.includes('group my-6') ||
                    (typeof child === 'object' && child?.type?.name === 'CodeBlock')
                  )

                  // If block elements detected, return fragment to avoid nesting issues
                  if (hasBlockElement) {
                    return <>{children}</>
                  }

                  return (
                    <p className="!text-base !leading-7 !mb-4" {...props}>
                      {children}
                    </p>
                  )
                },
                // Style code blocks with copy button
                code: CodeBlock,
                // Style images
                img: ({ src, alt, ...props }) => {
                  return (
                    <img
                      src={src}
                      alt={alt}
                      className="!rounded-lg !border !shadow-md !my-8 !w-[60%]"
                      loading="lazy"
                      {...props}
                    />
                  )
                },
                // Style links
                a: ({ children, href, ...props }) => {
                  return (
                    <a
                      href={href}
                      className="!text-primary hover:!underline !font-medium"
                      target={href?.startsWith('http') ? '_blank' : undefined}
                      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                      {...props}
                    >
                      {children}
                    </a>
                  )
                },
                // Style tables
                table: ({ children, ...props }) => {
                  return (
                    <div className="my-6 overflow-x-auto">
                      <table className="w-full border-collapse border border-border" {...props}>
                        {children}
                      </table>
                    </div>
                  )
                },
                th: ({ children, ...props }) => {
                  return (
                    <th className="border border-border bg-muted px-4 py-2 text-left font-semibold" {...props}>
                      {children}
                    </th>
                  )
                },
                td: ({ children, ...props }) => {
                  return (
                    <td className="border border-border px-4 py-2" {...props}>
                      {children}
                    </td>
                  )
                },
                // Style blockquotes
                blockquote: ({ children, ...props }) => {
                  return (
                    <blockquote className="!border-l-4 !border-primary !pl-4 !italic !my-6 !text-muted-foreground" {...props}>
                      {children}
                    </blockquote>
                  )
                },
                // Style lists
                ul: ({ children, ...props }) => {
                  return (
                    <ul className="!my-4 !list-disc !pl-6" {...props}>
                      {children}
                    </ul>
                  )
                },
                ol: ({ children, ...props }) => {
                  return (
                    <ol className="!my-4 !list-decimal !pl-6" {...props}>
                      {children}
                    </ol>
                  )
                }
              }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
