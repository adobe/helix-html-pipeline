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

/**
 * virtual idp config for the admin service
 */
export default {
  name: 'admin',
  client: (state) => ({
    clientId: state.env.HLX_SITE_APP_AZURE_CLIENT_ID,
  }),
  validateIssuer: (iss) => iss === 'https://admin.hlx.page/',
  discovery: {
    jwks_uri: 'https://admin.hlx.page/auth/discovery/keys',
  },
};
