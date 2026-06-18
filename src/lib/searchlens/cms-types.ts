// CMS connection types — credentials shape per target. Encrypted at rest
// with the existing EMAIL_ENCRYPTION_KEY (AES-256-GCM via lib/email/encryption).

export type CmsTarget = "wordpress" | "webflow" | "shopify" | "custom";

export interface WordPressCreds {
  base_url: string;       // https://example.com
  username: string;
  app_password: string;   // WordPress application password
}

export interface WebflowCreds {
  api_token: string;
  site_id: string;
}

export interface ShopifyCreds {
  shop: string;           // mystore.myshopify.com
  admin_access_token: string;
}

export interface CustomCreds {
  endpoint_url: string;
  bearer_token?: string;
}

export type CmsCreds = WordPressCreds | WebflowCreds | ShopifyCreds | CustomCreds;

export interface CmsConnection {
  id: string;
  org_id: string;
  target: CmsTarget;
  site_url: string;
  label: string;
  meta_json: Record<string, unknown>;
  last_used_at: string | null;
  last_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface CmsConnectionWithCreds extends CmsConnection {
  creds: CmsCreds;
}
