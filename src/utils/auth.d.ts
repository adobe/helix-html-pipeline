/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */


import {AdminContext} from "../index";

/**
 * Path Info
 */
export declare interface AccessDeniedError extends Error {}

export declare interface OAuthClientConfig {
  clientID: string;
  clientSecret: string;
}

export declare interface IDPConfig {
  name:string;
  scope:string;
  mountType:string;
  client(state: PipelineState):OAuthClientConfig;
  validateIssuer?(issuer: string): boolean;
  discoveryUrl:string;
  loginPrompt:string;
  discovery:any;
  routes:AuthRoutes;
}

export declare interface UserProfile {
  email:string;
  // hlx_hash:string;
  // picture:string;
  iss:string;
}

export declare class AuthInfo {
  /**
   * Flag indicating of the request is authenticated
   */
  authenticated:boolean;

  profile?:UserProfile;

  expired?:boolean;

  loginHint?:string;

  idp?:IDPConfig;

  /**
   * Flag indicating that the auth cookie is invalid.
   */
  cookieInvalid?:boolean;

  /**
   * Sets a redirect (302) response to the IDPs login endpoint
   *
   * @param {PipelineState} state
   * @param {PipelineRequest} req
   * @param {PipelineResponse} res
   */
  redirectToLogin(state, req, res);

  /**
   * Performs a token exchange from the code flow and redirects to the root page
   *
   * @param {PipelineState} state
   * @param {PipelineRequest} req
   * @param {PipelineResponse} res
   */
  async exchangeToken(state, req, res);
}
