module.exports = {
  singleQuote: true,
  proseWrap: 'always',
  printWidth: 120,
  tabWidth: 2,
  plugins: ['@trivago/prettier-plugin-sort-imports'],
  importOrder: ['module-alias/register', 'dotenv', 'react', '<THIRD_PARTY_MODULES>'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
};
