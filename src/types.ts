import type * as v from 'valibot';
import type { ConfigSchema } from './config.ts';

// -- ChangedSource ADT --

export type ChangedSource =
  | { readonly type: 'untracked' }
  | { readonly type: 'unstaged' }
  | { readonly type: 'staged' }
  | { readonly type: 'branch'; readonly name: string }
  | { readonly type: 'sha'; readonly sha: string };

// -- Config --

export type CheckConfig = {
  readonly pattern: string;
  readonly command: string;
  readonly group: string;
  readonly changedFiles?: {
    readonly separator?: string;
    readonly path?: 'relative' | 'absolute';
  };
};

export type Config = v.InferOutput<typeof ConfigSchema>;

// -- Check Result ADT --

export type CheckResult =
  | { readonly status: 'skip'; readonly name: string; readonly group: string }
  | {
      readonly status: 'passed';
      readonly name: string;
      readonly group: string;
      readonly command: string;
    }
  | {
      readonly status: 'failed';
      readonly name: string;
      readonly group: string;
      readonly command: string;
      readonly exitCode: number;
      readonly stdout: string;
      readonly stderr: string;
    };
