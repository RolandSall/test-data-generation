import type { Row } from './feed.js';

export interface FeedOptions {
  access?: 'sequential' | 'random' | 'shuffle';
  onEnd?: 'fail' | 'cycle';
  where?: (row: Row) => boolean;
  unmatched?: 'fail' | 'ignore';
}
