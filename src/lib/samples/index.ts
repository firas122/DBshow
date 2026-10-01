import { BLOG_SAMPLE_V1_SQL, BLOG_SAMPLE_V2_SQL } from "@/lib/samples/blog";
import { ECOMMERCE_SAMPLE_SQL } from "@/lib/samples/ecommerce";

export interface SampleDefinition {
  key: string;
  label: string;
  description: string;
  sql: string;
  name: string;
  /** When set, "Compare schemas" offers this as a one-click built-in baseline. */
  compareBaseline?: { sql: string; name: string };
}

export const SAMPLES: SampleDefinition[] = [
  {
    key: "ecommerce",
    label: "Load E-Commerce Sample DB",
    description: "13 tables with intentional schema warnings to exercise the linter",
    sql: ECOMMERCE_SAMPLE_SQL,
    name: "Neon Commerce (sample)",
  },
  {
    key: "blog",
    label: "Load Blog Platform Sample",
    description: "Post-migration schema (v2) — compare it against the bundled v1 to try schema diffing",
    sql: BLOG_SAMPLE_V2_SQL,
    name: "Blog Platform v2 (sample)",
    compareBaseline: { sql: BLOG_SAMPLE_V1_SQL, name: "Blog Platform v1 (sample)" },
  },
];

export function findSample(key: string): SampleDefinition | undefined {
  return SAMPLES.find((sample) => sample.key === key);
}
