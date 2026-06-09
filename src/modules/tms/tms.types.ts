export interface CreateStopInput {
  so_id?: string;
  stop_sequence: number;
  address: string;
  recipient_name?: string;
  recipient_phone?: string;
}

export interface CreateRouteBody {
  route_date: string;
  vehicle_id: string;
  driver_id: string;
  stops: CreateStopInput[];
}

export interface StartRouteBody {
  route_id: string;
}

export interface GPSPingBody {
  route_id: string;
  latitude: number;
  longitude: number;
  speed_kmh?: number;
}

export interface ConfirmDeliveryBody {
  stop_id: string;
  pod_photo_url?: string;
  signature_url?: string;
  notes?: string;
}

export interface FuelLogBody {
  route_id: string;
  vehicle_id: string;
  liters: number;
  distance_km: number;
}

export interface VehicleRow {
  id: string;
  plate_number: string;
  type: string;
  fuel_capacity: number | null;
  status: string;
  created_at: string;
}

export interface RouteRow {
  id: string;
  route_date: string;
  vehicle_id: string;
  driver_id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  plate_number?: string;
  vehicle_type?: string;
  driver_name?: string;
}

export interface DeliveryStopRow {
  id: string;
  route_id: string;
  so_id: string | null;
  stop_sequence: number;
  address: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  status: string;
  pod_photo_url: string | null;
  signature_url: string | null;
  notes: string | null;
  delivered_at: string | null;
  created_at: string;
  so_number?: string;
}

export interface RouteWithStops extends RouteRow {
  stops: DeliveryStopRow[];
}

export interface GPSLogRow {
  id: string;
  route_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  logged_at: string;
  driver_name?: string;
  plate_number?: string;
  route_date?: string;
}

export interface FuelLogRow {
  id: string;
  route_id: string;
  driver_id: string;
  vehicle_id: string;
  liters: number;
  distance_km: number;
  logged_at: string;
  driver_name?: string;
  plate_number?: string;
}
