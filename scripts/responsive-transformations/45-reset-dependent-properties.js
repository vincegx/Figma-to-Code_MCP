import traverse from '@babel/traverse';

const traverseDefault = traverse.default || traverse;

export const meta = {
  name: 'reset-dependent-properties',
  priority: 45,
  description: 'Reset layout properties (basis, grow, dimensions) when flex-direction changes (row→col)'
};

/**
 * PROBLÈME FIGMA → CODE:
 *
 * Figma crée des designs SÉPARÉS par breakpoint (Desktop/Tablet/Mobile).
 * Chaque design a ses propres propriétés CSS complètes.
 *
 * Quand on merge ces designs, on obtient:
 *   Desktop: flex-row basis-0 grow min-w-500 max-w-360
 *   Mobile:  flex-col basis-0 grow min-w-500 max-w-360
 *
 * Le système ajoute "max-md:flex-col" mais les autres propriétés
 * (basis-0, grow, min-w-500) deviennent OBSOLÈTES ou CASSÉES en flex-col.
 *
 * Cette transformation RÉINITIALISE automatiquement les propriétés
 * dépendantes quand flex-direction change.
 */

/**
 * Extract className from JSX element
 */
function extractClassName(jsxElement) {
  const classNameAttr = jsxElement?.openingElement?.attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name?.name === 'className'
  );

  if (!classNameAttr?.value) return null;

  if (classNameAttr.value.type === 'StringLiteral') {
    return classNameAttr.value.value.trim();
  }

  if (classNameAttr.value.type === 'JSXExpressionContainer' &&
      classNameAttr.value.expression.type === 'StringLiteral') {
    return classNameAttr.value.expression.value.trim();
  }

  return null;
}

/**
 * Update className on JSX element
 */
function updateClassName(jsxElement, newClassName) {
  const classNameAttr = jsxElement.openingElement.attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name?.name === 'className'
  );

  if (!classNameAttr) return;

  if (classNameAttr.value.type === 'StringLiteral') {
    classNameAttr.value.value = newClassName;
  } else if (classNameAttr.value.type === 'JSXExpressionContainer' &&
             classNameAttr.value.expression.type === 'StringLiteral') {
    classNameAttr.value.expression.value = newClassName;
  }
}

/**
 * Check if className has specific responsive class
 */
function hasResponsiveClass(className, pattern) {
  if (!className) return false;
  const classes = className.split(/\s+/);
  if (typeof pattern === 'string') {
    return classes.includes(pattern);
  }
  if (pattern instanceof RegExp) {
    return classes.some(c => pattern.test(c));
  }
  return false;
}

/**
 * Extract numeric value from custom dimension class
 * Example: "min-w-custom-500" → 500
 */
function extractCustomValue(className, prefix) {
  const regex = new RegExp(`${prefix}-(\\d+(?:dot\\d+)?)`);
  const match = className.match(regex);
  if (!match) return null;

  // Handle "dot" notation (133dot333 → 133.333)
  const value = match[1].replace('dot', '.');
  return parseFloat(value);
}

/**
 * Get all classes matching a pattern
 */
function getClassesByPattern(className, pattern) {
  if (!className) return [];
  return className.split(/\s+/).filter(c => pattern.test(c));
}

/**
 * RÈGLE 1: Flex Direction Change → Reset Flex Properties
 *
 * Si un élément change de flex-row → flex-col (ou inverse):
 * - basis-0 devient obsolète → basis-auto
 * - grow peut être problématique → grow-0
 * - shrink peut être problématique → shrink-1 (défaut)
 */
function resetFlexProperties(className) {
  const classes = className.split(/\s+/);
  const resets = [];

  // Détecter si flex-direction change en mobile
  const hasFlexColMobile = classes.includes('max-md:flex-col');
  const hasFlexRowMobile = classes.includes('max-md:flex-row');

  if (hasFlexColMobile || hasFlexRowMobile) {
    // Reset basis-* → basis-auto
    if (classes.some(c => c.startsWith('basis-') && !c.startsWith('max-md:basis-'))) {
      resets.push('max-md:basis-auto');
    }

    // Reset grow → grow-0 (souvent nécessaire en flex-col)
    if (classes.includes('grow') && !classes.includes('max-md:grow-0')) {
      resets.push('max-md:grow-0');
    }

    // Reset shrink si présent
    if (classes.some(c => c.startsWith('shrink-') && !c.startsWith('max-md:shrink-'))) {
      // On garde shrink-1 par défaut (comportement normal)
      // Pas de reset nécessaire sauf si shrink-0
      if (classes.includes('shrink-0')) {
        resets.push('max-md:shrink-1');
      }
    }
  }

  return resets;
}

/**
 * RÈGLE 2: Dimension Resets pour Mobile
 *
 * Problèmes typiques:
 * - min-w-custom-500 sur écran 420px → Débordement
 * - max-w-custom-360 sur écran 420px → Trop étroit (86%)
 * - min-w-custom-181 avec basis-0 grow → Trop rigide
 */
function resetDimensionProperties(className) {
  const classes = className.split(/\s+/);
  const resets = [];

  const hasFlexColMobile = classes.includes('max-md:flex-col');
  const hasFlexWrap = classes.includes('flex-wrap');

  // min-w-custom-*
  const minWidthClasses = getClassesByPattern(className, /^min-w-custom-(\d+(?:dot\d+)?)/);
  for (const minWClass of minWidthClasses) {
    const value = extractCustomValue(minWClass, 'min-w-custom');

    if (value !== null) {
      // Si min-width > 180px sur un écran mobile 420px, reset
      if (value > 180) {
        resets.push('max-md:min-w-0');
        break; // Un seul reset suffit
      }
      // Si min-width entre 150-180px et flex-wrap, on garde mais surveille
      // Si min-width < 150px, OK pour mobile
    }
  }

  // max-w-custom-*
  const maxWidthClasses = getClassesByPattern(className, /^max-w-custom-(\d+(?:dot\d+)?)/);
  for (const maxWClass of maxWidthClasses) {
    const value = extractCustomValue(maxWClass, 'max-w-custom');

    if (value !== null && hasFlexColMobile) {
      // En flex-col sur mobile, les cartes doivent pouvoir être full-width
      // max-w-custom-360 limite à 360px sur écran 420px → Reset
      if (value < 400) {
        resets.push('max-md:max-w-full');
        break;
      }
    }
  }

  // min-h-px (1px minimum) → Reset en flex-col
  if (classes.includes('min-h-px') && hasFlexColMobile) {
    resets.push('max-md:min-h-0');
  }

  return resets;
}

/**
 * RÈGLE 3: Width Properties Conflicts
 *
 * Cas typique:
 *   Desktop: w-custom-133 (largeur fixe)
 *   Mobile: max-md:basis-0 max-md:grow (largeur flexible)
 *
 * Le w-custom-133 entre en conflit avec basis-0 grow
 * Solution: w-auto permet à flexbox de contrôler la largeur
 */
function resetWidthConflicts(className) {
  const classes = className.split(/\s+/);
  const resets = [];

  // Si on a max-md:basis-0 et max-md:grow (layout flexible)
  const hasFlexibleMobile = classes.includes('max-md:basis-0') && classes.includes('max-md:grow');

  if (hasFlexibleMobile) {
    // Chercher w-custom-* (largeur fixe) sans override mobile
    const hasFixedWidth = classes.some(c =>
      c.startsWith('w-custom-') && !c.startsWith('max-md:w-')
    );

    if (hasFixedWidth) {
      // w-auto permet à flex-basis et flex-grow de contrôler la largeur
      // Permet plusieurs éléments par ligne avec flex-wrap
      resets.push('max-md:w-auto');
    }
  }

  return resets;
}

/**
 * RÈGLE 4: Prevent Over-Constraining on Mobile
 *
 * Si un élément a PLUSIEURS contraintes de dimension:
 *   w-custom-133 + min-w-custom-181 + max-w-custom-360 + basis-0 + grow
 *
 * Sur mobile, cela crée un layout sur-contraint. On simplifie:
 *   max-md:w-full max-md:min-w-0 max-md:basis-auto
 */
function simplifyMobileConstraints(className) {
  const classes = className.split(/\s+/);
  const resets = [];

  // Compter les contraintes de dimension
  const hasWidth = classes.some(c => c.startsWith('w-') && !c.startsWith('max-md:'));
  const hasMinWidth = classes.some(c => c.startsWith('min-w-') && !c.startsWith('max-md:'));
  const hasMaxWidth = classes.some(c => c.startsWith('max-w-') && !c.startsWith('max-md:'));
  const hasBasis = classes.some(c => c.startsWith('basis-') && !c.startsWith('max-md:'));
  const hasGrow = classes.includes('grow');

  const constraintCount = [hasWidth, hasMinWidth, hasMaxWidth, hasBasis, hasGrow].filter(Boolean).length;

  // Si 3+ contraintes et flex-col mobile, simplifier
  const hasFlexColMobile = classes.includes('max-md:flex-col');

  if (constraintCount >= 3 && hasFlexColMobile) {
    // Stratégie de simplification:
    // - Largeur: full-width par défaut
    // - Pas de minimum (min-w-0)
    // - Pas de basis contraignant (basis-auto)

    if (!classes.includes('max-md:w-full') && !classes.includes('max-md:w-auto')) {
      resets.push('max-md:w-full');
    }

    if (hasMinWidth && !classes.includes('max-md:min-w-0')) {
      resets.push('max-md:min-w-0');
    }

    if (hasBasis && !classes.includes('max-md:basis-auto')) {
      resets.push('max-md:basis-auto');
    }
  }

  return resets;
}

/**
 * RÈGLE 5: Flex-wrap Special Case
 *
 * Cas Quickactions:
 *   Desktop: flex-wrap + w-custom-133 (9 cartes fixes)
 *   Mobile: flex-wrap + basis-0 grow + min-w-custom-181 (2 colonnes flexibles)
 *
 * Problème: min-w-custom-181 est trop large (181px sur 420px = 43%)
 *
 * Solution: Réduire le minimum ou le supprimer
 */
function handleFlexWrapMobile(className) {
  const classes = className.split(/\s+/);
  const resets = [];

  const hasFlexWrap = classes.includes('flex-wrap');
  const hasFlexibleMobile = classes.includes('max-md:basis-0') && classes.includes('max-md:grow');

  if (hasFlexWrap && hasFlexibleMobile) {
    // Chercher min-w-custom-* sur mobile
    const mobileMinWidthClasses = classes.filter(c => c.startsWith('max-md:min-w-custom-'));

    for (const minWClass of mobileMinWidthClasses) {
      const value = extractCustomValue(minWClass, 'max-md:min-w-custom');

      if (value !== null && value > 150) {
        // 181px est trop large pour 2 colonnes sur 420px
        // On suggère 120px (420/2 - gaps - padding = ~190px, min 120 laisse 37% de flex)

        // Supprimer le min-w-custom-181 existant (sera remplacé)
        const idx = classes.indexOf(minWClass);
        if (idx !== -1) {
          classes.splice(idx, 1);
        }

        // Ajouter un minimum plus raisonnable OU le supprimer
        // Option 1: min-w-custom-120 (plus flexible)
        // Option 2: min-w-0 (totalement flexible)

        // On choisit Option 2: min-w-0 pour maximum de flexibilité
        resets.push('max-md:min-w-0');
        break;
      }
    }
  }

  return resets;
}

/**
 * RÈGLE 6: Parent Context - Reset Children
 *
 * Quand un PARENT a max-md:flex-col, ses ENFANTS directs avec basis-0/grow
 * doivent aussi être réinitialisés, même s'ils n'ont pas max-md:flex-col eux-mêmes.
 */
function resetChildrenOfFlexColParents(className, parentHasFlexCol) {
  const classes = className.split(/\s+/);
  const resets = [];

  // Si le parent a max-md:flex-col, réinitialiser les propriétés flex des enfants
  if (parentHasFlexCol) {
    // Reset basis-*
    if (classes.some(c => c.startsWith('basis-') && !c.startsWith('max-md:basis-'))) {
      resets.push('max-md:basis-auto');
    }

    // Reset shrink si présent
    if (classes.includes('shrink-0') && !classes.includes('max-md:shrink-1')) {
      resets.push('max-md:shrink-1');
    }

    // Reset min-h-px en flex-col
    if (classes.includes('min-h-px') && !classes.includes('max-md:min-h-0')) {
      resets.push('max-md:min-h-0');
    }

    // Reset max-w pour permettre full-width
    const maxWidthClasses = classes.filter(c => /^max-w-custom-/.test(c));
    for (const maxWClass of maxWidthClasses) {
      const value = extractCustomValue(maxWClass, 'max-w-custom');
      if (value !== null && value < 400) {
        resets.push('max-md:max-w-full');
        break;
      }
    }

    // NOTE: Flex grow/basis resets are now handled in 40-merge-desktop-first.js
    // CRITICAL FIX 2 section, which properly detects when these properties
    // disappear between breakpoints (Desktop → Mobile)
  }

  return resets;
}

/**
 * RÈGLE 7: Reset Flexbox Properties for Fixed Width on Mobile
 *
 * Cas scroll horizontal (People liste):
 *   Desktop: basis-0 grow w-full (layout flexible)
 *   Mobile: w-custom-54dot286 (largeur fixe pour scroll horizontal)
 *
 * Problème: basis-0 + grow restent actifs et overrident la largeur fixe
 *
 * Solution: Quand mobile a max-md:w-custom-X, reset basis et grow
 * IMPORTANT: Ne PAS modifier shrink - si desktop a shrink-0, mobile doit garder shrink-0
 *            pour le scroll horizontal (items ne doivent pas rétrécir)
 */
function resetFlexboxForFixedWidth(className) {
  const classes = className.split(/\s+/);
  const resets = [];

  // Détecter si mobile a une largeur fixe explicite
  const hasMobileFixedWidth = classes.some(c => c.startsWith('max-md:w-custom-'));

  if (hasMobileFixedWidth) {
    // Si desktop a basis-*, reset sur mobile
    if (classes.some(c => c.startsWith('basis-') && !c.startsWith('max-md:'))) {
      if (!classes.includes('max-md:basis-auto')) {
        resets.push('max-md:basis-auto');
      }
    }

    // Si desktop a grow, reset sur mobile
    if (classes.includes('grow')) {
      if (!classes.includes('max-md:grow-0')) {
        resets.push('max-md:grow-0');
      }
    }

    // NE PAS modifier shrink - important pour horizontal scroll
    // Si desktop a shrink-0 et mobile a largeur fixe, garder shrink-0 sur mobile
  }

  return resets;
}

/**
 * Main execution function - TWO PASS APPROACH
 *
 * PASSE 1: Collecter tous les parents avec max-md:flex-col
 * PASSE 2: Traiter tous les éléments ET leurs enfants
 */
export function execute(context) {
  const { desktopAST } = context;

  let elementsProcessed = 0;
  let totalResetsAdded = 0;
  const resetsByRule = {
    flexProperties: 0,
    dimensions: 0,
    widthConflicts: 0,
    simplification: 0,
    flexWrap: 0,
    childrenReset: 0
  };

  // PASSE 1: Identifier tous les parents avec max-md:flex-col ou max-md:flex-row
  const parentsWithFlexChange = new Set();

  traverseDefault(desktopAST, {
    JSXElement(path) {
      const className = extractClassName(path.node);
      if (!className) return;

      if (hasResponsiveClass(className, 'max-md:flex-col') ||
          hasResponsiveClass(className, 'max-md:flex-row')) {
        parentsWithFlexChange.add(path.node);
      }
    }
  });

  // PASSE 2: Traiter tous les éléments avec contexte parent
  traverseDefault(desktopAST, {
    JSXElement(path) {
      const dataNameAttr = path.node.openingElement.attributes.find(
        attr => attr.type === 'JSXAttribute' && attr.name?.name === 'data-name'
      );

      const dataName = dataNameAttr?.value?.value;
      const currentClassName = extractClassName(path.node);

      if (!currentClassName) return;

      // Vérifier si le parent direct a un changement de flex-direction
      const parent = path.parent?.type === 'JSXElement' ? path.parent : null;
      const parentHasFlexCol = parent ? parentsWithFlexChange.has(parent) : false;

      // Appliquer toutes les règles
      const allResets = [
        ...resetFlexProperties(currentClassName),
        ...resetDimensionProperties(currentClassName),
        ...resetWidthConflicts(currentClassName),
        ...simplifyMobileConstraints(currentClassName),
        ...handleFlexWrapMobile(currentClassName),
        ...resetChildrenOfFlexColParents(currentClassName, parentHasFlexCol),
        ...resetFlexboxForFixedWidth(currentClassName)
      ];

      // Dédupliquer et filtrer les resets déjà présents
      const classes = currentClassName.split(/\s+/);
      const uniqueResets = [...new Set(allResets)].filter(reset => !classes.includes(reset));

      if (uniqueResets.length > 0) {
        // Ajouter les resets à la fin du className
        const newClassName = `${currentClassName} ${uniqueResets.join(' ')}`;
        updateClassName(path.node, newClassName);

        elementsProcessed++;
        totalResetsAdded += uniqueResets.length;

        // Track stats by rule type
        uniqueResets.forEach(reset => {
          if (reset.includes('basis') || reset.includes('grow') || reset.includes('shrink')) {
            if (parentHasFlexCol) {
              resetsByRule.childrenReset++;
            } else {
              resetsByRule.flexProperties++;
            }
          } else if (reset.includes('min-w') || reset.includes('max-w') || reset.includes('min-h')) {
            resetsByRule.dimensions++;
          } else if (reset.includes('w-full') || reset.includes('w-auto')) {
            resetsByRule.widthConflicts++;
          }
        });
      }
    }
  });

  return {
    elementsProcessed,
    totalResetsAdded,
    resetsByRule
  };
}
