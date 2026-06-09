import { apiClient } from './client';
import { Route } from '../types';
import * as FileSystem from 'expo-file-system/legacy';

export async function getMyRouteToday(): Promise<Route | null> {
  try {
    const { data } = await apiClient.get('/tms/routes/today');
    return data.data as Route;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

export async function startRoute(route_id: string): Promise<void> {
  await apiClient.post('/tms/routes/start', { route_id });
}

export async function pingGPS(
  route_id: string,
  latitude: number,
  longitude: number,
  speed_kmh?: number
): Promise<void> {
  await apiClient.post('/tms/gps', { route_id, latitude, longitude, speed_kmh });
}

export async function confirmDelivery(
  stop_id: string,
  notes?: string,
  photoUri?: string
): Promise<void> {
  let pod_photo_url: string | undefined;

  if (photoUri) {
    const base64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    pod_photo_url = `data:image/jpeg;base64,${base64}`;
  }

  await apiClient.post('/tms/deliveries/confirm', { stop_id, notes, pod_photo_url });
}

export async function submitFuelLog(
  route_id: string,
  vehicle_id: string,
  liters: number,
  distance_km: number
): Promise<void> {
  await apiClient.post('/tms/fuel-log', { route_id, vehicle_id, liters, distance_km });
}

export async function getAllRoutes(status?: string): Promise<Route[]> {
  const params: Record<string, string> = {};
  if (status) params['status'] = status;
  const { data } = await apiClient.get('/tms/routes', { params });
  return data.data as Route[];
}

export interface LiveGPSEntry {
  route_id: string;
  driver_id: string;
  driver_name: string;
  plate_number: string;
  route_date: string;
  latitude: number;
  longitude: number;
  speed_kmh: number;
  logged_at: string;
}

export async function getLiveGPS(): Promise<LiveGPSEntry[]> {
  const { data } = await apiClient.get('/tms/gps/live');
  return data.data as LiveGPSEntry[];
}
