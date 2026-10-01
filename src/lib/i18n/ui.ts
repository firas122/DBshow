import type { LayoutMode } from "@/lib/graph/layouts";
import type { Locale } from "@/lib/i18n/locale";
import type { SchemaSource } from "@/lib/types";

export interface UiStrings {
  hero: {
    badge: string;
    titlePrefix: string;
    titleEmphasis: string;
    subtitle: string;
  };

  sourceLabel: Record<SchemaSource, string>;
  defaultNames: { pasted: string; baseline: string; remote: string };

  upload: {
    tabs: { file: string; paste: string; url: string };
    file: {
      dropPrompt: string;
      parsing: string;
      hint: string;
    };
    paste: {
      jsonSeparator: string;
      parsing: string;
      submit: string;
    };
    url: {
      placeholder: string;
      description: string;
      fetching: string;
      submit: string;
    };
    divider: string;
  };

  samples: Record<string, { label: string; description: string }>;

  layout: Record<LayoutMode, string>;

  titleBlock: {
    tablesRelations: (tables: number, relations: number) => string;
    health: string;
    legend: { pk: string; fk: string; suggested: string; error: string };
  };

  dock: {
    load: string;
    search: string;
    searchAria: string;
    layoutTitle: (label: string) => string;
    reflow: string;
    frameAll: string;
    particles: string;
    edgeLabels: string;
    autoRotate: string;
    compare: string;
    viewDiff: string;
    copyLink: string;
    health: string;
  };

  palette: {
    placeholder: string;
    noMatches: (query: string) => string;
  };

  compareBanner: {
    viewDiff: string;
    exit: string;
  };

  keyboardHint: { orbit: string; zoom: string; focus: string; pressPrefix: string; search: string };

  loading: string;

  localeToggle: { switchTo: (label: string) => string };

  importDrawer: { title: string; closeAria: string };

  ticker: {
    tooltip: string;
    allHealthy: string;
    allMuted: string;
  };

  severityLabel: { error: string; warning: string; info: string };
  kindLabel: {
    "type-mismatch": string;
    "implicit-fk": string;
    "missing-index": string;
    "circular-dependency": string;
    "dangling-reference": string;
    "no-primary-key": string;
    "orphan-table": string;
  };

  warningsDrawer: {
    title: string;
    closeAria: string;
    schemaHealth: string;
    errors: string;
    warnings: string;
    notes: string;
    filters: { all: string; errors: string; warnings: string; notes: string; muted: string };
    copyFixes: (n: number) => string;
    exportReport: string;
    emptyNoIssues: string;
    emptyNoIssuesSub: string;
    emptyFilter: string;
    emptyFilterSub: string;
    parserNotes: string;
    mutedBadge: string;
    muteTooltip: string;
    unmuteTooltip: string;
    whyItMatters: string;
    suggestedFix: string;
    copy: string;
    copied: string;
    showIn3d: string;
  };

  inspector: {
    summary: (columns: number, out: number, incoming: number) => string;
    focusAria: string;
    closeAria: string;
    sections: { warnings: string; columns: string; relationships: string; indexes: string };
    badges: { suggested: string; dangling: string; noIndex: string; notNull: string; unique: string };
  };

  compareDrawer: {
    title: string;
    closeAria: string;
    description: (name: string) => string;
    bundledBaseline: string;
    orBringOwn: string;
    uploadPrompt: string;
    reading: string;
    orPaste: string;
    comparing: string;
    compare: string;
    readError: string;
  };

  report: {
    heading: (name: string) => string;
    score: (score: number, errors: number, warnings: number, info: number) => string;
    tablesRelations: (tables: number, relations: number) => string;
    mutedExcluded: (n: number) => string;
    where: string;
    issue: string;
    whyItMatters: string;
    suggestedFix: string;
    noIssues: string;
  };

  diffDrawer: {
    title: string;
    closeAria: string;
    stats: { tablesAdded: string; tablesRemoved: string; modified: string; relsAdded: string; relsRemoved: string };
    sections: {
      addedTables: string;
      removedTables: string;
      modifiedTables: string;
      relationsAdded: string;
      relationsRemoved: string;
    };
    emptyTitle: string;
    emptySub: string;
    changeBaseline: string;
    exitComparison: string;
  };
}

const en: UiStrings = {
  hero: {
    badge: "Parsed in your browser — nothing is uploaded",
    titlePrefix: "See your database in ",
    titleEmphasis: "three dimensions",
    subtitle:
      "Drop a SQL dump, a SQLite file or a JSON schema. DBShow maps every table and foreign key into an animated 3D diagram, then flags the relationships that look wrong.",
  },

  sourceLabel: { sql: "SQL DDL", sqlite: "SQLite", json: "JSON", sample: "Sample" },
  defaultNames: { pasted: "Pasted schema", baseline: "Baseline schema", remote: "Remote schema" },

  upload: {
    tabs: { file: "Upload", paste: "Paste", url: "Link" },
    file: {
      dropPrompt: "Drop a schema file, or click to browse",
      parsing: "Parsing schema…",
      hint: ".sql · .ddl · .sqlite · .sqlite3 · .db · .json — parsed entirely in your browser",
    },
    paste: {
      jsonSeparator: "— or JSON —",
      parsing: "Parsing…",
      submit: "Visualise schema",
    },
    url: {
      placeholder: "https://example.com/schema.sql",
      description:
        "Points at a hosted .sql, .json or .sqlite file. Live connection strings (postgres://…) cannot be opened from a browser — export the schema first.",
      fetching: "Fetching…",
      submit: "Fetch & visualise",
    },
    divider: "or",
  },

  samples: {
    ecommerce: {
      label: "Load E-Commerce Sample DB",
      description: "13 tables with intentional schema warnings to exercise the linter",
    },
    blog: {
      label: "Load Blog Platform Sample",
      description: "Post-migration schema (v2) — compare it against the bundled v1 to try schema diffing",
    },
    saas: {
      label: "Load SaaS Platform Sample",
      description: "29 tables across auth, projects, billing & support — stress-tests layout at scale",
    },
    library: {
      label: "Load Library Catalog Sample",
      description: "A normal-sized, fully healthy schema — Health 100, nothing in the ticker",
    },
  },

  layout: { force: "Force", sphere: "Sphere", grid: "Layered" },

  titleBlock: {
    tablesRelations: (tables, relations) => `${tables} tables · ${relations} relations`,
    health: "Health",
    legend: { pk: "Primary key", fk: "Foreign key", suggested: "Suggested", error: "Error" },
  },

  dock: {
    load: "Load another schema",
    search: "Search tables & columns",
    searchAria: "Open command palette",
    layoutTitle: (label) => `${label} layout`,
    reflow: "Re-run layout",
    frameAll: "Frame all tables",
    particles: "Data flow particles",
    edgeLabels: "Edge labels",
    autoRotate: "Auto-rotate",
    compare: "Compare schemas",
    viewDiff: "View schema diff",
    copyLink: "Copy shareable link",
    health: "Health & warnings",
  },

  palette: {
    placeholder: "Jump to a table or column…",
    noMatches: (query) => `No table or column matches “${query}”`,
  },

  compareBanner: { viewDiff: "View diff", exit: "Exit" },

  keyboardHint: {
    orbit: "Drag to orbit",
    zoom: "scroll to zoom",
    focus: "click a table to focus",
    pressPrefix: "press",
    search: "to search",
  },

  loading: "Parsing schema…",

  localeToggle: { switchTo: (label) => `Switch to ${label}` },

  importDrawer: { title: "Load another schema", closeAria: "Close importer" },

  ticker: {
    tooltip: "Click to inspect · double-click to mute",
    allHealthy: "All relations look healthy — no issues detected.",
    allMuted: "Every issue here is muted — double-click a warning in the Health drawer to bring it back.",
  },

  severityLabel: { error: "Error", warning: "Warning", info: "Note" },
  kindLabel: {
    "type-mismatch": "Type mismatch",
    "implicit-fk": "Suggested relation",
    "missing-index": "Missing index",
    "circular-dependency": "Circular dependency",
    "dangling-reference": "Dangling reference",
    "no-primary-key": "No primary key",
    "orphan-table": "Isolated table",
  },

  warningsDrawer: {
    title: "Relations Health & Warnings",
    closeAria: "Close health report",
    schemaHealth: "Schema health",
    errors: "errors",
    warnings: "warnings",
    notes: "notes",
    filters: { all: "All", errors: "Errors", warnings: "Warnings", notes: "Notes", muted: "Muted" },
    copyFixes: (n) => `Copy ${n} fix${n === 1 ? "" : "es"}`,
    exportReport: "Export report",
    emptyNoIssues: "No issues detected",
    emptyNoIssuesSub: "Every foreign key resolves, matches its parent's type and is indexed.",
    emptyFilter: "Nothing in this filter",
    emptyFilterSub: "Try a different severity filter.",
    parserNotes: "Parser notes",
    mutedBadge: "Muted",
    muteTooltip: "Mute — hide from the ticker and score",
    unmuteTooltip: "Unmute — bring back into the ticker and score",
    whyItMatters: "Why it matters",
    suggestedFix: "Suggested fix",
    copy: "Copy",
    copied: "Copied",
    showIn3d: "Show in 3D",
  },

  inspector: {
    summary: (columns, out, incoming) => `${columns} columns · ${out} out · ${incoming} in`,
    focusAria: "Focus camera on table",
    closeAria: "Close inspector",
    sections: {
      warnings: "Warnings",
      columns: "Columns",
      relationships: "Relationships",
      indexes: "Indexes",
    },
    badges: {
      suggested: "suggested",
      dangling: "dangling",
      noIndex: "no idx",
      notNull: "NOT NULL",
      unique: "unique",
    },
  },

  compareDrawer: {
    title: "Compare schemas",
    closeAria: "Close compare",
    description: (name) =>
      `Pick an earlier version of ${name} to diff against what's loaded now. Added, removed and modified tables & relations get tinted in the 3D view — green for added, violet for modified, rose (dashed) for removed.`,
    bundledBaseline: "Bundled baseline",
    orBringOwn: "or bring your own",
    uploadPrompt: "Upload the earlier schema file",
    reading: "Reading…",
    orPaste: "…or paste it",
    comparing: "Comparing…",
    compare: "Compare",
    readError: "Could not read that schema.",
  },

  report: {
    heading: (name) => `Schema health report — ${name}`,
    score: (score, errors, warnings, info) =>
      `**Score:** ${score}/100 — ${errors} error(s) · ${warnings} warning(s) · ${info} note(s)`,
    tablesRelations: (tables, relations) => `${tables} tables · ${relations} relations`,
    mutedExcluded: (n) => `${n} muted warning(s) excluded from the score above.`,
    where: "Where",
    issue: "Issue",
    whyItMatters: "Why it matters",
    suggestedFix: "Suggested fix",
    noIssues: "No issues detected — every relation resolves, matches its parent's type and is indexed.",
  },

  diffDrawer: {
    title: "Change order",
    closeAria: "Close diff",
    stats: {
      tablesAdded: "tables +",
      tablesRemoved: "tables −",
      modified: "modified",
      relsAdded: "rels +",
      relsRemoved: "rels −",
    },
    sections: {
      addedTables: "Added tables",
      removedTables: "Removed tables",
      modifiedTables: "Modified tables",
      relationsAdded: "Relations added",
      relationsRemoved: "Relations removed",
    },
    emptyTitle: "No structural changes",
    emptySub: "Every table, column and relation matches between the two schemas.",
    changeBaseline: "Change baseline",
    exitComparison: "Exit comparison",
  },
};

const fr: UiStrings = {
  hero: {
    badge: "Analysé dans votre navigateur — rien n'est envoyé en ligne",
    titlePrefix: "Visualisez votre base de données en ",
    titleEmphasis: "trois dimensions",
    subtitle:
      "Déposez un dump SQL, un fichier SQLite ou un schéma JSON. DBShow place chaque table et chaque clé étrangère dans un diagramme 3D animé, puis signale les relations suspectes.",
  },

  sourceLabel: { sql: "DDL SQL", sqlite: "SQLite", json: "JSON", sample: "Exemple" },
  defaultNames: { pasted: "Schéma collé", baseline: "Schéma de référence", remote: "Schéma distant" },

  upload: {
    tabs: { file: "Importer", paste: "Coller", url: "Lien" },
    file: {
      dropPrompt: "Déposez un fichier de schéma, ou cliquez pour parcourir",
      parsing: "Analyse du schéma…",
      hint: ".sql · .ddl · .sqlite · .sqlite3 · .db · .json — analysé entièrement dans votre navigateur",
    },
    paste: {
      jsonSeparator: "— ou JSON —",
      parsing: "Analyse…",
      submit: "Visualiser le schéma",
    },
    url: {
      placeholder: "https://exemple.com/schema.sql",
      description:
        "Pointe vers un fichier .sql, .json ou .sqlite hébergé. Les chaînes de connexion en direct (postgres://…) ne peuvent pas être ouvertes depuis un navigateur — exportez d'abord le schéma.",
      fetching: "Récupération…",
      submit: "Récupérer et visualiser",
    },
    divider: "ou",
  },

  samples: {
    ecommerce: {
      label: "Charger l'exemple e-commerce",
      description: "13 tables avec des anomalies volontaires pour tester l'analyseur",
    },
    blog: {
      label: "Charger l'exemple plateforme de blog",
      description: "Schéma post-migration (v2) — comparez-le à la v1 fournie pour essayer le diff de schéma",
    },
    saas: {
      label: "Charger l'exemple plateforme SaaS",
      description: "29 tables (auth, projets, facturation, support) — teste la disposition à grande échelle",
    },
    library: {
      label: "Charger l'exemple catalogue de bibliothèque",
      description: "Un schéma de taille normale, entièrement sain — Santé 100, rien dans le bandeau",
    },
  },

  layout: { force: "Forces", sphere: "Sphère", grid: "Étagé" },

  titleBlock: {
    tablesRelations: (tables, relations) => `${tables} tables · ${relations} relations`,
    health: "Santé",
    legend: { pk: "Clé primaire", fk: "Clé étrangère", suggested: "Suggérée", error: "Erreur" },
  },

  dock: {
    load: "Charger un autre schéma",
    search: "Rechercher des tables et des colonnes",
    searchAria: "Ouvrir la palette de commandes",
    layoutTitle: (label) => `Disposition ${label.toLowerCase()}`,
    reflow: "Relancer la disposition",
    frameAll: "Cadrer toutes les tables",
    particles: "Particules de flux de données",
    edgeLabels: "Étiquettes des relations",
    autoRotate: "Rotation automatique",
    compare: "Comparer des schémas",
    viewDiff: "Voir le diff du schéma",
    copyLink: "Copier le lien de partage",
    health: "Santé et anomalies",
  },

  palette: {
    placeholder: "Aller à une table ou une colonne…",
    noMatches: (query) => `Aucune table ni colonne ne correspond à « ${query} »`,
  },

  compareBanner: { viewDiff: "Voir le diff", exit: "Quitter" },

  keyboardHint: {
    orbit: "Glisser pour orbiter",
    zoom: "molette pour zoomer",
    focus: "cliquer une table pour la cibler",
    pressPrefix: "appuyez sur",
    search: "pour rechercher",
  },

  loading: "Analyse du schéma…",

  localeToggle: { switchTo: (label) => `Passer en ${label}` },

  importDrawer: { title: "Charger un autre schéma", closeAria: "Fermer l'import" },

  ticker: {
    tooltip: "Cliquer pour inspecter · double-clic pour masquer",
    allHealthy: "Toutes les relations sont saines — aucune anomalie détectée.",
    allMuted: "Toutes les anomalies sont masquées — double-cliquez sur une anomalie dans le panneau Santé pour la restaurer.",
  },

  severityLabel: { error: "Erreur", warning: "Avertissement", info: "Note" },
  kindLabel: {
    "type-mismatch": "Incompatibilité de type",
    "implicit-fk": "Relation suggérée",
    "missing-index": "Index manquant",
    "circular-dependency": "Dépendance circulaire",
    "dangling-reference": "Référence orpheline",
    "no-primary-key": "Pas de clé primaire",
    "orphan-table": "Table isolée",
  },

  warningsDrawer: {
    title: "Santé des relations et anomalies",
    closeAria: "Fermer le rapport de santé",
    schemaHealth: "Santé du schéma",
    errors: "erreurs",
    warnings: "avertissements",
    notes: "notes",
    filters: { all: "Tout", errors: "Erreurs", warnings: "Avertissements", notes: "Notes", muted: "Masquées" },
    copyFixes: (n) => `Copier ${n} correctif${n === 1 ? "" : "s"}`,
    exportReport: "Exporter le rapport",
    emptyNoIssues: "Aucune anomalie détectée",
    emptyNoIssuesSub: "Chaque clé étrangère se résout, correspond au type de son parent et est indexée.",
    emptyFilter: "Rien dans ce filtre",
    emptyFilterSub: "Essayez un autre niveau de gravité.",
    parserNotes: "Notes de l'analyseur",
    mutedBadge: "Masquée",
    muteTooltip: "Masquer — retirer du bandeau et du score",
    unmuteTooltip: "Afficher — remettre dans le bandeau et le score",
    whyItMatters: "Pourquoi c'est important",
    suggestedFix: "Correctif suggéré",
    copy: "Copier",
    copied: "Copié",
    showIn3d: "Afficher en 3D",
  },

  inspector: {
    summary: (columns, out, incoming) => `${columns} colonnes · ${out} sortantes · ${incoming} entrantes`,
    focusAria: "Centrer la caméra sur la table",
    closeAria: "Fermer l'inspecteur",
    sections: {
      warnings: "Anomalies",
      columns: "Colonnes",
      relationships: "Relations",
      indexes: "Index",
    },
    badges: {
      suggested: "suggérée",
      dangling: "orpheline",
      noIndex: "sans index",
      notNull: "NOT NULL",
      unique: "unique",
    },
  },

  compareDrawer: {
    title: "Comparer des schémas",
    closeAria: "Fermer la comparaison",
    description: (name) =>
      `Choisissez une version antérieure de ${name} à comparer avec celle chargée actuellement. Les tables et relations ajoutées, supprimées et modifiées sont teintées dans la vue 3D — vert pour les ajouts, violet pour les modifications, rose (pointillé) pour les suppressions.`,
    bundledBaseline: "Référence fournie",
    orBringOwn: "ou utilisez la vôtre",
    uploadPrompt: "Importer le fichier de schéma antérieur",
    reading: "Lecture…",
    orPaste: "…ou collez-le",
    comparing: "Comparaison…",
    compare: "Comparer",
    readError: "Impossible de lire ce schéma.",
  },

  report: {
    heading: (name) => `Rapport de santé du schéma — ${name}`,
    score: (score, errors, warnings, info) =>
      `**Score :** ${score}/100 — ${errors} erreur(s) · ${warnings} avertissement(s) · ${info} note(s)`,
    tablesRelations: (tables, relations) => `${tables} tables · ${relations} relations`,
    mutedExcluded: (n) => `${n} anomalie(s) masquée(s) exclue(s) du score ci-dessus.`,
    where: "Où",
    issue: "Problème",
    whyItMatters: "Pourquoi c'est important",
    suggestedFix: "Correctif suggéré",
    noIssues: "Aucune anomalie détectée — chaque relation se résout, correspond au type de son parent et est indexée.",
  },

  diffDrawer: {
    title: "Ordre de modification",
    closeAria: "Fermer le diff",
    stats: {
      tablesAdded: "tables +",
      tablesRemoved: "tables −",
      modified: "modifiées",
      relsAdded: "rel. +",
      relsRemoved: "rel. −",
    },
    sections: {
      addedTables: "Tables ajoutées",
      removedTables: "Tables supprimées",
      modifiedTables: "Tables modifiées",
      relationsAdded: "Relations ajoutées",
      relationsRemoved: "Relations supprimées",
    },
    emptyTitle: "Aucun changement structurel",
    emptySub: "Chaque table, colonne et relation correspond entre les deux schémas.",
    changeBaseline: "Changer de référence",
    exitComparison: "Quitter la comparaison",
  },
};

export const UI_STRINGS: Record<Locale, UiStrings> = { en, fr };
