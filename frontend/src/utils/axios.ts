/**
 * Public API surface for HTTP: prefer `request()` for new code; default export is the Axios instance
 * for existing Minimals call sites (`import axios from 'src/utils/axios'`).
 */
import { apiClient } from 'src/lib/api/http-client';

export { request } from 'src/lib/api/request';
export { API_ENDPOINTS } from 'src/lib/api/endpoints';

export { apiClient };
export default apiClient;
