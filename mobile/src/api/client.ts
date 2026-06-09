import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL } from '../constants';
import { clearAll } from '../utils/storage';
import { enqueue, getQueue, removeFromQueue } from '../utils/offlineQueue';

let _onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void): void {
  _onUnauthorized = handler;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await clearAll();
      _onUnauthorized?.();
    } else if (!error.response) {
      // No internet — queue mutating requests for later retry
      const method = (error.config?.method ?? '').toLowerCase();
      if (['post', 'put', 'patch', 'delete'].includes(method)) {
        await enqueue({
          method: method as 'post' | 'put' | 'patch' | 'delete',
          url: error.config?.url ?? '',
          data: error.config?.data ? JSON.parse(error.config.data as string) : undefined,
        });
        throw new Error('QUEUED_OFFLINE');
      }
      throw new Error('No internet connection');
    }
    return Promise.reject(error);
  }
);

// Flush queued requests when the device comes back online
export function startOfflineFlush(): () => void {
  return NetInfo.addEventListener(async (state) => {
    if (!state.isConnected) return;

    const queue = await getQueue();
    if (queue.length === 0) return;

    const token = await AsyncStorage.getItem('access_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    for (const req of queue) {
      try {
        await axios({
          method: req.method,
          url: `${API_BASE_URL}${req.url}`,
          data: req.data,
          headers,
          timeout: 10000,
        });
        await removeFromQueue(req.id);
        console.log('Flushed queued request:', req.url);
      } catch (err) {
        console.warn('Failed to flush queued request:', req.url, err);
        // Leave it in the queue for next reconnect
        break;
      }
    }
  });
}
