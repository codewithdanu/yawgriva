const isServer = typeof window === "undefined";
const API_BASE = isServer
  ? (process.env.API_URL || "http://backend:8000")
  : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");


interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, token } = options;

  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}/api/v1${endpoint}`, config);

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      // Clear invalid session tokens and redirect to login
      localStorage.removeItem("yawgriva_token");
      localStorage.removeItem("yawgriva_user");
      document.cookie = "yawgriva_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "yawgriva_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      window.location.href = "/login";
    }
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new ApiError(error.detail || "Request failed", res.status);
  }

  return res.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ access_token: string; user: User }>("/auth/login", {
        method: "POST",
        body: { email, password },
      }),
    register: (data: RegisterData) =>
      request<{ access_token: string; user: User }>("/auth/register", {
        method: "POST",
        body: data,
      }),
    me: (token: string) =>
      request<User>("/auth/me", { token }),
    getProfile: (token: string) =>
      request<UserProfile>("/auth/profile", { token }),
    updateProfile: (token: string, data: Partial<UserProfileUpdateRequest>) =>
      request<UserProfile>("/auth/profile", {
        method: "PUT",
        body: data,
        token,
      }),
  },

  batches: {
    list: (token: string, status?: string) =>
      request<Batch[]>(`/batches${status ? `?status=${status}` : ""}`, { token }),
    create: (token: string, data: BatchCreate) =>
      request<Batch>("/batches", { method: "POST", body: data, token }),
    get: (token: string, id: string) =>
      request<Batch>(`/batches/${id}`, { token }),
    updateStatus: (token: string, id: string, status: string) =>
      request<Batch>(`/batches/${id}/status`, {
        method: "PATCH",
        body: { status },
        token,
      }),
    // Feature 1: Freshness Score
    getFreshness: (token: string, id: string) =>
      request<FreshnessResult>(`/batches/${id}/freshness`, { token }),
    // Feature 6: Carbon Footprint
    getCarbon: (token: string, id: string, distanceKm: number, vehicleType: string) =>
      request<CarbonResult>(`/batches/${id}/carbon?distance_km=${distanceKm}&vehicle_type=${vehicleType}`, { token }),
    getVehicleTypes: (token: string) =>
      request<VehicleOption[]>(`/batches/vehicle-types`, { token }),
    // Feature 2: Match Candidates
    getMatchCandidates: (token: string, id: string, lat: number, lon: number) =>
      request<MatchCandidate[]>(`/batches/${id}/match-candidates?batch_lat=${lat}&batch_lon=${lon}`, { token }),
  },

  checkpoints: {
    create: (token: string, data: CheckpointCreate) =>
      request<Checkpoint>("/checkpoints", { method: "POST", body: data, token }),
    // Feature 3: Photo upload (uses FormData, not JSON)
    uploadPhoto: async (token: string, checkpointId: string, file: File): Promise<VisualAnalysisResult> => {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch(`${API_BASE}/api/v1/checkpoints/${checkpointId}/photo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new ApiError(error.detail || "Upload failed", res.status);
      }
      return res.json();
    },
    getPhoto: (checkpointId: string) =>
      request<VisualAnalysisResult>(`/checkpoints/${checkpointId}/photo`),
    reanalyze: (token: string, checkpointId: string) =>
      request<VisualAnalysisResult>(`/checkpoints/${checkpointId}/reanalyze`, { method: "POST", token }),
  },

  trace: {
    get: (qrHash: string) =>
      request<TraceData>(`/trace/${qrHash}`),
  },

  prices: {
    get: (token: string, commodity: string) =>
      request<Price[]>(`/prices/${commodity}`, { token }),
    predict: (token: string, commodity: string, region: string) =>
      request<PricePrediction[]>(`/prices/${commodity}/predict?region=${region}`, { token }),
  },

  agents: {
    price: (token: string, commodity: string, region: string) =>
      request<AgentResponse>("/agents/price", {
        method: "POST",
        body: { commodity_name: commodity, region },
        token,
      }),
    route: (token: string, data: RouteRequest) =>
      request<RouteResponse>("/agents/route", {
        method: "POST",
        body: data,
        token,
      }),
    health: (token: string) =>
      request<AgentHealth[]>("/agents/health", { token }),
    logs: (token: string) =>
      request<AgentLog[]>("/agents/logs", { token }),
  },

  admin: {
    overview: (token: string) =>
      request<AdminOverview>("/admin/overview", { token }),
    users: (token: string) =>
      request<User[]>("/admin/users", { token }),
    alerts: (token: string) =>
      request<Alert[]>("/admin/alerts", { token }),
    triggerScan: (token: string) =>
      request<{ status: string; message: string; scanned_count: number; alerts_created: number }>("/admin/alerts/trigger-scan", { method: "POST", token }),
    resolveAlert: (token: string, id: string) =>
      request<Alert>(`/admin/alerts/${id}/resolve`, { method: "PATCH", token }),
    verifyUser: (token: string, userId: string, verified: boolean) =>
      request<User>(`/admin/users/${userId}/verify?verified=${verified}`, { method: "PATCH", token }),
    listOutliers: (token: string) =>
      request<CommunityPriceReport[]>("/admin/outliers", { token }),
    validateOutlier: (token: string, id: string) =>
      request<CommunityPriceReport>(`/admin/outliers/${id}/validate`, { method: "PATCH", token }),
    rejectOutlier: (token: string, id: string) =>
      request<CommunityPriceReport>(`/admin/outliers/${id}/reject`, { method: "PATCH", token }),
  },

  // Feature 2: Delivery Requests
  deliveryRequests: {
    create: (token: string, data: { batch_id: string; distributor_id: string; match_score?: number }) =>
      request<DeliveryRequest>("/delivery-requests", { method: "POST", body: data, token }),
    incoming: (token: string) =>
      request<DeliveryRequest[]>("/delivery-requests/incoming", { token }),
    accept: (token: string, id: string) =>
      request<DeliveryRequest>(`/delivery-requests/${id}/accept`, { method: "PATCH", token }),
    decline: (token: string, id: string) =>
      request<DeliveryRequest>(`/delivery-requests/${id}/decline`, { method: "PATCH", token }),
    list: (token: string, batchId?: string) =>
      request<DeliveryRequest[]>(`/delivery-requests${batchId ? `?batch_id=${batchId}` : ""}`, { token }),
  },

  // Feature 5: Community Prices
  communityPrices: {
    submit: (token: string, data: CommunityPriceSubmit) =>
      request<CommunityPriceReport>("/community-prices", { method: "POST", body: data, token }),
    getAggregate: (token: string, commodity: string, region?: string) =>
      request<CommunityPriceAggregate>(`/community-prices/${commodity}${region ? `?region=${region}` : ""}`, { token }),
    getAlerts: (token: string) =>
      request<PriceAlert[]>("/community-prices/alerts", { token }),
  },

  // Feature 4: Weekly Reports
  farmerReports: {
    list: (token: string) =>
      request<WeeklyReportItem[]>("/farmer/reports", { token }),
    get: (token: string, id: string) =>
      request<WeeklyReportDetail>(`/farmer/reports/${id}`, { token }),
  },
};

// User context interface for chat personalization
export interface ChatUserContext {
  name?: string;
  role?: string;
  region?: string | null;
  farm_location?: string | null;
  land_area?: string | null;
  phone?: string | null;
}

export function streamChat(
  token: string,
  message: string,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (error: Error) => void,
  userContext?: ChatUserContext,
  signal?: AbortSignal,
  onStatus?: (status: string) => void,
) {
  fetch(`${API_BASE}/api/v1/agents/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message, user_context: userContext || null }),
    signal,
  })
    .then((res) => {
      if (!res.ok) throw new Error("Chat request failed");
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
 
      function read() {
        reader?.read().then(({ done, value }) => {
          if (done) {
            onDone();
            return;
          }
          const text = decoder.decode(value);
          const lines = text.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                onDone();
                return;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.chunk) onChunk(parsed.chunk);
                if (parsed.status && onStatus) onStatus(parsed.status);
              } catch {
                // Skip invalid JSON
              }
            }
          }
          read();
        });
      }
      read();
    })
    .catch(onError);
}


// Types used in API client
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  region: string | null;
  is_verified: boolean;
  created_at: string;
}

export interface FarmerProfile {
  farm_name: string | null;
  farm_address: string | null;
  latitude: number | null;
  longitude: number | null;
  land_area_ha: number | null;
  commodities: string[] | null;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  region: string | null;
  created_at: string;
  farmer_profile?: FarmerProfile | null;
}

export interface UserProfileUpdateRequest {
  name?: string;
  phone?: string | null;
  region?: string | null;
  farm_name?: string | null;
  farm_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  land_area_ha?: number | null;
  commodities?: string[] | null;
}

interface RegisterData {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: string;
  region?: string;
}

interface Batch {
  id: string;
  farmer_id: string;
  commodity_name: string;
  quantity_kg: number;
  harvest_date: string;
  qr_code_hash: string;
  status: string;
  created_at: string;
  checkpoints?: Checkpoint[];
}

interface BatchCreate {
  commodity_name: string;
  quantity_kg: number;
  harvest_date: string;
}

interface Checkpoint {
  id: string;
  batch_id: string;
  scanned_by: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  temp_celsius: number | null;
  scanned_at: string;
  photo_url?: string | null;
  visual_condition?: string | null;
  visual_summary?: string | null;
  visual_confidence?: number | null;
}

interface CheckpointCreate {
  batch_id: string;
  location_name: string;
  latitude?: number;
  longitude?: number;
  temp_celsius?: number;
}

interface TraceData {
  batch: Batch;
  farmer_name: string;
  farm_region: string | null;
  checkpoints: Checkpoint[];
  total_journey_hours: number | null;
}

interface Price {
  id: string;
  commodity_name: string;
  market_name: string;
  price_per_kg: number;
  recorded_at: string;
  source: string;
}

interface PricePrediction {
  id: string;
  commodity_name: string;
  region: string;
  predicted_price: number;
  confidence: number;
  predicted_for: string;
  generated_at: string;
}

interface AgentResponse {
  reply: string;
  agent_type: string;
  model_used: string;
  confidence: number | null;
}

interface RouteRequest {
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  batch_id: string;
}

interface RouteResponse {
  recommended_route: string;
  estimated_duration_min: number;
  distance_km: number;
  freshness_score: number;
  tips: string[];
}

export interface AgentHealth {
  agent_type: string;
  status: string;
  primary_model: string;
  fallback_model: string;
  avg_latency_ms: number | null;
  total_calls_today: number;
}

export interface AgentLog {
  id: string;
  agent_type: string;
  output_summary: string | null;
  tokens_used: number | null;
  latency_ms: number | null;
  model_used: string | null;
  created_at: string;
}

export interface AdminOverview {
  total_users: number;
  total_batches: number;
  active_alerts: number;
}

export interface Alert {
  id: string;
  batch_id: string;
  alert_type: string;
  severity: string;
  message: string;
  resolved_at: string | null;
  created_at: string;
  commodity_name?: string | null;
  farmer_name?: string | null;
}

// ─── Feature 1: Freshness Score ───────────────────────────────────────────
export interface FreshnessResult {
  batch_id: string;
  score: number;
  label: string;
  label_color: "green" | "yellow" | "orange" | "red";
  hours_elapsed: number;
  shelf_life_hours: number;
  time_decay: number;
  temp_penalty: number;
  delay_penalty: number;
}

// ─── Feature 2: Matching System ───────────────────────────────────────────
export interface MatchCandidate {
  distributor_id: string;
  distributor_name: string;
  distance_km: number;
  match_score: number;
  avg_freshness_score: number | null;
  total_deliveries: number;
  is_available: boolean;
  distance_score: number;
  performance_score: number;
  availability_score: number;
}

export interface DeliveryRequest {
  id: string;
  batch_id: string;
  distributor_id: string;
  match_score: number | null;
  status: "pending" | "accepted" | "declined" | "expired";
  expires_at: string | null;
  created_at: string;
  commodity_name: string | null;
  quantity_kg: number | null;
  distributor_name: string | null;
}

// ─── Feature 3: Visual Analysis ───────────────────────────────────────────
export interface VisualAnalysisResult {
  checkpoint_id: string;
  photo_url: string | null;
  visual_condition: "excellent" | "good" | "fair" | "poor" | "unknown" | null;
  condition_id: string | null;
  visual_summary: string | null;
  visual_issues: string[] | null;
  visual_confidence: number | null;
  condition_color: "green" | "blue" | "orange" | "red" | "gray" | null;
}

// ─── Feature 4: Weekly Reports ────────────────────────────────────────────
export interface WeeklyReportItem {
  id: string;
  week_start: string;
  week_end: string;
  summary: string | null;
  created_at: string;
}

export interface WeeklyReportDetail {
  id: string;
  week_start: string;
  week_end: string;
  report_text: string;
  summary: string | null;
  created_at: string;
}

// ─── Feature 5: Community Prices ──────────────────────────────────────────
export interface CommunityPriceSubmit {
  commodity_name: string;
  price_per_kg: number;
  market_name?: string;
  region: string;
  transaction_type: "tengkulak" | "pasar" | "langsung";
}

export interface CommunityPriceReport {
  id: string;
  commodity_name: string;
  price_per_kg: number;
  market_name: string | null;
  region: string;
  transaction_type: string;
  status: string;
  reporter_weight: number;
  reported_at: string;
}

export interface CommunityPriceAggregate {
  commodity_name: string;
  region: string;
  community_price: number | null;
  official_price: number | null;
  gap_percent: number | null;
  report_count: number;
  alert_level: "normal" | "medium" | "high";
  aggregated_for: string;
  today_report_count: number;
}

export interface PriceAlert {
  commodity_name: string;
  region: string;
  gap_percent: number;
  alert_level: "normal" | "medium" | "high";
  community_price: number | null;
  official_price: number | null;
  report_count: number;
}

// ─── Feature 6: Carbon Footprint ──────────────────────────────────────────
export interface CarbonResult {
  batch_id: string;
  actual_kg_co2: number;
  baseline_kg_co2: number;
  saving_kg_co2: number;
  saving_percent: number;
  equivalent_trees: number;
  distance_km: number;
  vehicle_type: string;
  quantity_kg: number;
  summary_text: string;
}

export interface VehicleOption {
  value: string;
  label: string;
}
