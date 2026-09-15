declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    /** Apps Script web app URL (…/exec) for the Google Sheets sync service. */
    GOOGLE_SHEETS_SYNC_URL?: string;
    /** Shared secret the Apps Script checks on every call. Server-side only. */
    GOOGLE_SHEETS_SYNC_SECRET?: string;
    /** Apps Script project id, used to link to the editor for first-time authorization. */
    GOOGLE_SHEETS_SCRIPT_ID?: string;
    /** Optional server-side market quote adapter. The browser never receives these values. */
    MARKET_DATA_API_URL?: string;
    MARKET_DATA_API_KEY?: string;
  }
}
