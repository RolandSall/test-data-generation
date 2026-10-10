import type { FixtureOverrides } from './contracts.js';
export interface OnlyProvidedOverrides<Model> extends Omit<FixtureOverrides<Model>, 'onlyProvided'> {
  onlyProvided: true;
}
