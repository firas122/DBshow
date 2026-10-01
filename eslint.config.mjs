import next from "eslint-config-next";

const config = [
  { ignores: [".next/**", "node_modules/**", ".venv/**", "public/**", "scripts/**"] },
  ...next,
];

export default config;
