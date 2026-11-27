/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { Modifiers } from './utils/modifiers';

/**
 * Resolved site config from config service. Passed via pipeline state
 * @todo: generate from schema in config service
 */
export interface PipelineSiteConfig {
  contentBusId: string;
  owner: string;
  repo: string;
  ref: string;
  org: string;
  site: string;
  headers: ModifiersSheet;
  metadata: {
    preview: ModifiersSheet;
    live: ModifiersSheet;
  }
  head: {
    html: string;
  }
  cdn?: ProjectCDNConfig;
  access?: SiteAccessConfig;
  features?: SiteFeatures;
  limits?: SiteLimits;
  /**
   * ISO date string of when the site was created
   */
  created?: string;
}
export interface SiteFeatures {
  rendering?: {
    /**
     * Rendering version. Version 2 enables server-side section metadata processing and inlining.
     */
    version?: number;
    /**
     * Inline header content from nav metadata, falling back to /nav. Default: false.
     */
    inlineHeader?: boolean;
    /**
     * Inline footer content from footer metadata, falling back to /footer. Default: false.
     */
    inlineFooter?: boolean;
    /**
     * Inline fragment blocks with root-relative paths. Default: false.
     * Generic link-only paragraphs require /fragments/ in their root-relative path
     * and are normalized to fragment blocks before composition.
     * Standalone fragment blocks replace their parent section with fragment sections.
     * Shared blocks insert content from all fragment sections, preserving parent section metadata.
     * Shared fragment section wrappers and metadata are discarded; decoration wrappers may differ.
     * Nested fragment blocks and links embedded in prose or other blocks remain client-rendered.
     */
    inlineFragments?: boolean;
  };
}
export interface SiteLimits {
  rendering?: {
    /**
     * Maximum eligible fragment occurrences to inline per page, including generic links. Default: 10.
     * Non-negative integer; 0 disables fragment inlining. Headers/footer do not count.
     * Excess blocks remain client-rendered; failed loads still consume a slot.
     */
    maxFragments?: number;
  };
}
export interface ModifiersSheet {
  data: Modifiers;
}

/**
 * The CDN config
 */
export interface ProjectCDNConfig {
  prod: FastlyConfig | AkamaiConfig | CloudflareConfig | ManagedConfig;
  live?: {
    /**
     * Sidekick config to override the default preview host. it supports parameters $owner and $repo
     */
    host: string;
  };
  preview?: {
    /**
     * Sidekick config to override the default live host. it supports parameters $owner and $repo
     */
    host: string;
  };
}
/**
 * Production CDN configuration for Fastly
 */
export interface FastlyConfig {
  type: 'fastly';
  /**
   * production host
   */
  host: string;
  /**
   * Route or routes on the CDN that are rendered with Franklin
   */
  route: string | string[];
  /**
   * The Fastly Service ID
   */
  serviceId: string;
  /**
   * A Fastly token for purging
   */
  authToken: string;
}
export interface AkamaiConfig {
  type: 'akamai';
  /**
   * production host
   */
  host: string;
  /**
   * Route or routes on the CDN that are rendered with Franklin
   */
  route: string | string[];
  endpoint: string;
  clientSecret: string;
  clientToken: string;
  accessToken: string;
}
export interface CloudflareConfig {
  type: 'cloudflare';
  /**
   * production host
   */
  host: string;
  /**
   * Route or routes on the CDN that are rendered with Franklin
   */
  route: string | string[];
  origin: string;
  plan: string;
  zoneId: string;
  apiToken: string;
}
export interface ManagedConfig {
  type: 'managed';
  /**
   * production host
   */
  host: string;
  /**
   * Route or routes on the CDN that are rendered with Franklin
   */
  route: string | string[];
}
export interface SiteAccessConfig {
  preview?: AccessConfig;
  live?: AccessConfig;
}
/**
 * Access config specific to preview content
 */
export interface AccessConfig {
  /**
   * The email glob of the users that are allowed.
   */
  allow: string[];
  /**
   * the id of the API key(s). this is used to validate the API KEYS and allows to invalidate them.
   */
  apiKeyId: string[];
}
