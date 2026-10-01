import type { Locale } from "@/lib/i18n/locale";

/**
 * Message templates for every warning the linter produces. Kept separate from
 * `schemaLinter.ts` so the check logic doesn't get buried under prose in two
 * languages. `fix` snippets are SQL and are never localized.
 */
export interface LinterText {
  dangling: {
    title: string;
    messageMissingTable: (sourceRef: string, targetTable: string) => string;
    messageMissingColumn: (sourceRef: string, targetRef: string, targetTable: string) => string;
    suggestionMissingTable: (targetTable: string) => string;
    suggestionMissingColumn: (targetTable: string) => string;
  };
  typeMismatch: {
    title: string;
    message: (
      sourceTable: string,
      sourceColumn: string,
      sourceType: string,
      sourceFamily: string,
      targetTable: string,
      targetColumn: string,
      targetType: string,
      targetFamily: string,
    ) => string;
    suggestion: string;
  };
  typeNarrower: {
    title: string;
    message: (sourceTable: string, sourceColumn: string, sourceLength: number, targetTable: string, targetColumn: string, targetLength: number) => string;
    suggestion: (targetType: string) => string;
  };
  missingIndex: {
    title: string;
    message: (table: string, column: string) => string;
    suggestion: string;
  };
  implicitFk: {
    title: string;
    message: (table: string, column: string, target: string, targetColumn: string, typesDiffer: boolean) => string;
    suggestion: string;
  };
  circular: {
    titleSelf: string;
    titleCycle: string;
    messageSelf: (name: string) => string;
    messageCycle: (path: string) => string;
    suggestionSelf: string;
    suggestionBreakable: string;
    suggestionUnbreakable: string;
  };
  noPrimaryKey: {
    title: string;
    message: (table: string) => string;
    suggestion: string;
  };
  orphanTable: {
    title: string;
    message: (table: string) => string;
    suggestion: string;
  };
}

const en: LinterText = {
  dangling: {
    title: "Dangling foreign key reference",
    messageMissingTable: (sourceRef, targetTable) =>
      `${sourceRef} references table "${targetTable}", which is not defined in this schema.`,
    messageMissingColumn: (sourceRef, targetRef, targetTable) =>
      `${sourceRef} references column "${targetRef}", which does not exist on "${targetTable}".`,
    suggestionMissingTable: (targetTable) =>
      `Add the missing CREATE TABLE for "${targetTable}", or drop the constraint if the table was intentionally removed.`,
    suggestionMissingColumn: (targetTable) =>
      `Point the constraint at an existing column on "${targetTable}" — most likely its primary key.`,
  },
  typeMismatch: {
    title: "Foreign key type mismatch",
    message: (sourceTable, sourceColumn, sourceType, sourceFamily, targetTable, targetColumn, targetType, targetFamily) =>
      `${sourceTable}.${sourceColumn} is ${sourceType} (${sourceFamily}) but references ${targetTable}.${targetColumn}, which is ${targetType} (${targetFamily}).`,
    suggestion:
      "Mismatched families force an implicit cast on every join, which silently disables index usage and can fail outright on stricter engines. Align both sides on the parent's type.",
  },
  typeNarrower: {
    title: "Foreign key is narrower than its parent",
    message: (sourceTable, sourceColumn, sourceLength, targetTable, targetColumn, targetLength) =>
      `${sourceTable}.${sourceColumn} holds ${sourceLength} characters but ${targetTable}.${targetColumn} allows ${targetLength}.`,
    suggestion: (targetType) => `Widen the child column to ${targetType} so long parent keys cannot be truncated.`,
  },
  missingIndex: {
    title: "Unindexed foreign key",
    message: (table, column) => `${table}.${column} is a foreign key with no supporting index.`,
    suggestion:
      "Joins and parent-side deletes will fall back to a full scan of this table. Add an index whose leading column is the foreign key.",
  },
  implicitFk: {
    title: "Suggested relation — missing foreign key",
    message: (table, column, target, targetColumn, typesDiffer) =>
      `${table}.${column} looks like a reference to ${target}.${targetColumn}${
        typesDiffer ? " (though the column types differ)" : ""
      }, but no FOREIGN KEY constraint declares it.`,
    suggestion:
      "Without the constraint the database cannot stop orphaned rows, and tools that read the schema will not see this relationship. Declare it explicitly if the link is real.",
  },
  circular: {
    titleSelf: "Self-referencing table",
    titleCycle: "Circular dependency",
    messageSelf: (name) => `${name} references itself, forming a hierarchy.`,
    messageCycle: (path) => `Tables form a dependency cycle: ${path}.`,
    suggestionSelf:
      "Fine for trees and hierarchies — just make sure the column is nullable so root rows can be inserted, and that recursive queries are depth-limited.",
    suggestionBreakable:
      "Rows cannot be inserted in any single order without a deferrable constraint. At least one key on the cycle is nullable, so insert that side as NULL first and update it afterwards. Watch for cascade deletes looping.",
    suggestionUnbreakable:
      "Every key on this cycle is NOT NULL, so no insertion order satisfies all constraints. Make one of them nullable, mark it DEFERRABLE INITIALLY DEFERRED, or break the cycle with a join table.",
  },
  noPrimaryKey: {
    title: "Table has no primary key",
    message: (table) => `${table} declares no PRIMARY KEY, so rows cannot be addressed uniquely.`,
    suggestion:
      "Replication, upserts and most ORMs need a stable row identity. Add a surrogate key or promote an existing unique column.",
  },
  orphanTable: {
    title: "Isolated table",
    message: (table) => `${table} has no incoming or outgoing relationships.`,
    suggestion:
      "Expected for lookup, config or audit tables. Otherwise its links are probably enforced in application code rather than in the schema.",
  },
};

const fr: LinterText = {
  dangling: {
    title: "Référence de clé étrangère orpheline",
    messageMissingTable: (sourceRef, targetTable) =>
      `${sourceRef} référence la table « ${targetTable} », qui n'est pas définie dans ce schéma.`,
    messageMissingColumn: (sourceRef, targetRef, targetTable) =>
      `${sourceRef} référence la colonne « ${targetRef} », qui n'existe pas sur « ${targetTable} ».`,
    suggestionMissingTable: (targetTable) =>
      `Ajoutez le CREATE TABLE manquant pour « ${targetTable} », ou supprimez la contrainte si la table a été retirée intentionnellement.`,
    suggestionMissingColumn: (targetTable) =>
      `Faites pointer la contrainte vers une colonne existante de « ${targetTable} » — probablement sa clé primaire.`,
  },
  typeMismatch: {
    title: "Incompatibilité de type sur une clé étrangère",
    message: (sourceTable, sourceColumn, sourceType, sourceFamily, targetTable, targetColumn, targetType, targetFamily) =>
      `${sourceTable}.${sourceColumn} est de type ${sourceType} (${sourceFamily}) mais référence ${targetTable}.${targetColumn}, qui est de type ${targetType} (${targetFamily}).`,
    suggestion:
      "Des familles incompatibles forcent une conversion implicite à chaque jointure, ce qui désactive silencieusement l'utilisation des index et peut échouer franchement sur des moteurs plus stricts. Alignez les deux côtés sur le type du parent.",
  },
  typeNarrower: {
    title: "La clé étrangère est plus étroite que son parent",
    message: (sourceTable, sourceColumn, sourceLength, targetTable, targetColumn, targetLength) =>
      `${sourceTable}.${sourceColumn} contient ${sourceLength} caractères mais ${targetTable}.${targetColumn} en autorise ${targetLength}.`,
    suggestion: (targetType) =>
      `Élargissez la colonne enfant vers ${targetType} pour que les clés parentes longues ne soient pas tronquées.`,
  },
  missingIndex: {
    title: "Clé étrangère sans index",
    message: (table, column) => `${table}.${column} est une clé étrangère sans index pour la soutenir.`,
    suggestion:
      "Les jointures et les suppressions côté parent se rabattront sur un parcours complet de cette table. Ajoutez un index dont la colonne de tête est la clé étrangère.",
  },
  implicitFk: {
    title: "Relation suggérée — clé étrangère manquante",
    message: (table, column, target, targetColumn, typesDiffer) =>
      `${table}.${column} ressemble à une référence vers ${target}.${targetColumn}${
        typesDiffer ? " (bien que les types de colonnes diffèrent)" : ""
      }, mais aucune contrainte FOREIGN KEY ne la déclare.`,
    suggestion:
      "Sans la contrainte, la base ne peut pas empêcher les lignes orphelines, et les outils qui lisent le schéma ne verront pas cette relation. Déclarez-la explicitement si le lien est réel.",
  },
  circular: {
    titleSelf: "Table auto-référencée",
    titleCycle: "Dépendance circulaire",
    messageSelf: (name) => `${name} se référence elle-même, formant une hiérarchie.`,
    messageCycle: (path) => `Les tables forment un cycle de dépendances : ${path}.`,
    suggestionSelf:
      "Adapté aux arbres et hiérarchies — assurez-vous simplement que la colonne est nullable pour permettre l'insertion des lignes racines, et que les requêtes récursives ont une profondeur limitée.",
    suggestionBreakable:
      "Les lignes ne peuvent être insérées dans aucun ordre sans contrainte différable. Au moins une clé du cycle est nullable : insérez ce côté à NULL d'abord, puis mettez-le à jour. Attention aux suppressions en cascade qui boucleraient.",
    suggestionUnbreakable:
      "Chaque clé de ce cycle est NOT NULL, donc aucun ordre d'insertion ne satisfait toutes les contraintes. Rendez l'une d'elles nullable, marquez-la DEFERRABLE INITIALLY DEFERRED, ou cassez le cycle avec une table de jonction.",
  },
  noPrimaryKey: {
    title: "La table n'a pas de clé primaire",
    message: (table) => `${table} ne déclare aucune PRIMARY KEY, les lignes ne peuvent donc pas être identifiées de façon unique.`,
    suggestion:
      "La réplication, les upserts et la plupart des ORM ont besoin d'une identité de ligne stable. Ajoutez une clé de substitution ou promouvez une colonne unique existante.",
  },
  orphanTable: {
    title: "Table isolée",
    message: (table) => `${table} n'a aucune relation entrante ou sortante.`,
    suggestion:
      "Normal pour une table de référence, de configuration ou d'audit. Sinon, ses liens sont probablement gérés dans le code applicatif plutôt que dans le schéma.",
  },
};

const LINTER_TEXT: Record<Locale, LinterText> = { en, fr };

export function getLinterText(locale: Locale): LinterText {
  return LINTER_TEXT[locale];
}
